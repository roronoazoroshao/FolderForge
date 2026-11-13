import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, renameSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectGateway, type ProjectWorker } from "../../src/multiproject/project-gateway.js";

const secret = "test-only-gateway-bearer-0123456789abcdef";
const created: Server[] = [];
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(created.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  roots.splice(0).forEach((x) => rmSync(x, { recursive: true, force: true }));
});

function projects() {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "ff-project-router-")));
  roots.push(parent);
  mkdirSync(join(parent, "frontend"));
  mkdirSync(join(parent, "backend"));
  return { parent, frontend: join(parent, "frontend"), backend: join(parent, "backend") };
}
async function fakeWorker(id: string): Promise<ProjectWorker> {
  const server = createServer((req, res) => {
    if (req.headers.authorization !== "Bearer internal-" + id) {
      res.writeHead(401); res.end(); return;
    }
    const session = req.headers["mcp-session-id"];
    if (req.method === "POST" && !session) {
      res.setHeader("mcp-session-id", "session-" + id);
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id, session: session ?? null }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  created.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("test listener");
  return { port: addr.port, token: "internal-" + id, close: async () => undefined };
}
async function gateway(projectRoots: ReturnType<typeof projects>, options: { maxWorkers?: number } = {}) {
  const starts: string[] = [];
  const g = await createProjectGateway({
    parentRoot: projectRoots.parent, host: "127.0.0.1", port: 0,
    token: secret, maxWorkers: options.maxWorkers ?? 2,
    projects: [
      { id: "frontend", root: projectRoots.frontend },
      { id: "backend", root: projectRoots.backend },
    ],
  }, async ({ id }) => { starts.push(id); return fakeWorker(id); });
  created.push(g.server);
  const address = g.server.address();
  if (!address || typeof address === "string") throw new Error("gateway listener");
  return { url: "http://127.0.0.1:" + address.port, starts };
}
async function call(url: string, path: string, headers: Record<string, string> = {}) {
  const res = await fetch(url + path, {
    method: "POST", headers: { authorization: "Bearer " + secret, "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
  });
  return { status: res.status, body: await res.json() as { id?: string; error?: string; session?: string }, session: res.headers.get("mcp-session-id") };
}

describe("F14 approved independent-project gateway (test-first)", () => {
  it("separates project request quotas at the authenticated HTTP gateway", async () => {
    const p = projects();
    const started: string[] = [];
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "frontend", root: p.frontend }, { id: "backend", root: p.backend }],
      scheduling: {
        globalConcurrency: 2, perProjectConcurrency: 1,
        maxRequestsPerProject: 1, maxRequestsGlobal: 10,
      },
    }, async ({ id }) => {
      started.push(id);
      return fakeWorker(id);
    });
    created.push(g.server);
    const address = g.server.address();
    if (!address || typeof address === "string") throw new Error("gateway listener");
    const url = "http://127.0.0.1:" + address.port;
    const results = await Promise.all([
      call(url, "/mcp", { "x-folderforge-project": "frontend" }),
      call(url, "/mcp", { "x-folderforge-project": "frontend" }),
      call(url, "/mcp", { "x-folderforge-project": "backend" }),
    ]);
    expect(results.slice(0, 2).map((r) => r.status).sort()).toEqual([200, 429]);
    expect(results[2]!.status).toBe(200);
    expect(started.sort()).toEqual(["backend", "frontend"]);
    expect(g.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it("does not starve child B behind child A when both have queued HTTP calls", async () => {
    const p = projects();
    const seen: string[] = [];
    let allowA!: () => void;
    let allowB!: () => void;
    const holdA = new Promise<void>((resolve) => { allowA = resolve; });
    const holdB = new Promise<void>((resolve) => { allowB = resolve; });
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "frontend", root: p.frontend }, { id: "backend", root: p.backend }],
      scheduling: { globalConcurrency: 1, perProjectConcurrency: 1, queueTimeoutMs: 3000 },
    }, async ({ id }) => {
      const server = createServer(async (_req, res) => {
        seen.push(id);
        if (id === "frontend" && seen.filter((item) => item === id).length === 1) await holdA;
        if (id === "backend") await holdB;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      created.push(server);
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("worker address");
      return { port: addr.port, token: "internal-test-" + id, close: async () => undefined };
    });
    created.push(g.server);
    const addr = g.server.address();
    if (!addr || typeof addr === "string") throw new Error("gateway address");
    const url = "http://127.0.0.1:" + addr.port;
    async function until(condition: () => boolean): Promise<void> {
      const deadline = Date.now() + 1500;
      while (!condition() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
      expect(condition()).toBe(true);
    }
    try {
      const a1 = call(url, "/mcp", { "x-folderforge-project": "frontend" });
      await until(() => seen.length === 1);
      const a2 = call(url, "/mcp", { "x-folderforge-project": "frontend" });
      await until(() => g.snapshot().queued === 1);
      const b1 = call(url, "/mcp", { "x-folderforge-project": "backend" });
      await until(() => g.snapshot().queued === 2);
      allowA();
      expect((await a1).status).toBe(200);
      await until(() => seen.length === 2);
      expect(seen).toEqual(["frontend", "backend"]);
      expect(g.snapshot().queued).toBe(1);
      allowB();
      expect((await b1).status).toBe(200);
      expect((await a2).status).toBe(200);
      expect(seen).toEqual(["frontend", "backend", "frontend"]);
      expect(g.snapshot()).toMatchObject({ active: 0, queued: 0 });
    } finally {
      allowA();
      allowB();
    }
  });

  it("returns a bounded HTTP overload instead of starting a queued worker after deadline", async () => {
    const p = projects();
    let releaseA!: () => void;
    const delayA = new Promise<void>((resolve) => { releaseA = resolve; });
    let startedA = false;
    const started: string[] = [];
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "frontend", root: p.frontend }, { id: "backend", root: p.backend }],
      scheduling: { globalConcurrency: 1, perProjectConcurrency: 1,
        queueTimeoutMs: 40, maxQueuedPerProject: 4 },
    }, async ({ id }) => {
      started.push(id);
      const server = createServer(async (_req, res) => {
        if (id === "frontend") {
          startedA = true;
          await delayA;
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ id }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      created.push(server);
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("worker address");
      return { port: addr.port, token: "internal-test-" + id, close: async () => undefined };
    });
    created.push(g.server);
    const addr = g.server.address();
    if (!addr || typeof addr === "string") throw new Error("gateway address");
    const url = "http://127.0.0.1:" + addr.port;
    try {
      const a = call(url, "/mcp", { "x-folderforge-project": "frontend" });
      const deadline = Date.now() + 1000;
      while (!startedA && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
      expect(startedA).toBe(true);
      const b = await fetch(url + "/mcp", {
        method: "POST", headers: {
          authorization: "Bearer " + secret,
          "x-folderforge-project": "backend",
          "content-type": "application/json",
        }, body: JSON.stringify({ jsonrpc: "2.0", method: "initialize" }),
      });
      expect(b.status).toBe(503);
      expect(b.headers.get("retry-after")).toBe("1");
      expect((await b.json() as { error: string }).error).toBe("queue_timeout");
      expect(started).toEqual(["frontend"]);
      releaseA();
      expect((await a).status).toBe(200);
      expect(g.snapshot()).toMatchObject({ active: 0, queued: 0 });
    } finally {
      releaseA();
    }
  });

  it("serializes twenty same-project HTTP calls without exceeding one active worker request", async () => {
    const p = projects();
    let active = 0;
    let maxActive = 0;
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "frontend", root: p.frontend }],
      scheduling: { globalConcurrency: 4, perProjectConcurrency: 1,
        maxQueuedPerProject: 32, maxRequestsPerProject: 40 },
    }, async ({ id }) => {
      const server = createServer((_req, res) => {
        active++;
        maxActive = Math.max(maxActive, active);
        setTimeout(() => {
          active--;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id }));
        }, 4);
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      created.push(server);
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("worker address");
      return { port: addr.port, token: "internal-test-" + id, close: async () => undefined };
    });
    created.push(g.server);
    const addr = g.server.address();
    if (!addr || typeof addr === "string") throw new Error("gateway address");
    const url = "http://127.0.0.1:" + addr.port;
    const replies = await Promise.all(Array.from({ length: 20 },
      () => call(url, "/mcp", { "x-folderforge-project": "frontend" })));
    expect(replies.every((reply) => reply.status === 200)).toBe(true);
    expect(maxActive).toBe(1);
    expect(g.snapshot()).toMatchObject({ active: 0, queued: 0 });
  });

  it("routes 500 interleaved requests to separate workers without cross-project context", async () => {
    const p = projects();
    const { url, starts } = await gateway(p);
    const [first, second] = await Promise.all([
      call(url, "/mcp", { "x-folderforge-project": "frontend" }),
      call(url, "/mcp", { "x-folderforge-project": "backend" }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect([first.session, second.session]).toEqual(["session-frontend", "session-backend"]);
    const results = await Promise.all(Array.from({ length: 500 }, (_, i) => {
      const id = i % 2 === 0 ? "frontend" : "backend";
      return call(url, "/mcp", { "mcp-session-id": "session-" + id });
    }));
    results.forEach((r, i) => {
      expect(r.status).toBe(200);
      expect(r.body.id).toBe(i % 2 === 0 ? "frontend" : "backend");
    });
    expect(starts.sort()).toEqual(["backend", "frontend"]);
  });

  it("requires authentication, an unambiguous authorized project, and pinned session affinity", async () => {
    const p = projects();
    const { url, starts } = await gateway(p);
    const denied = await fetch(url + "/mcp", { method: "POST", headers: { "x-folderforge-project": "frontend" } });
    expect(denied.status).toBe(401);
    expect((await call(url, "/mcp")).status).toBe(400);
    expect((await call(url, "/mcp", { "x-folderforge-project": "unapproved" })).status).toBe(404);
    expect((await call(url, "/mcp", { origin: "https://attacker.invalid", "x-folderforge-project": "frontend" })).status).toBe(403);
    expect(starts).toEqual([]);
    expect((await call(url, "/mcp", { "x-folderforge-project": "frontend" })).status).toBe(200);
    const swapped = await call(url, "/mcp", { "x-folderforge-project": "backend", "mcp-session-id": "session-frontend" });
    expect(swapped.status).toBe(409);
    const missing = await call(url, "/mcp", { "mcp-session-id": "session-forged" });
    expect(missing.status).toBe(404);
    expect(starts).toEqual(["frontend"]);
  });

  it("rejects a replaced project directory even if the new directory has the same absolute path", async () => {
    const p = projects();
    const { url, starts } = await gateway(p);
    renameSync(p.frontend, p.frontend + "-old");
    mkdirSync(p.frontend);
    const result = await call(url, "/mcp", { "x-folderforge-project": "frontend" });
    expect(result.status).toBe(503);
    expect(starts).toEqual([]);
  });

  it("caps authenticated MCP session identities and reclaims expired sessions", async () => {
    const p = projects();
    let counter = 0;
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "frontend", root: p.frontend }],
      maxSessions: 2, sessionTtlMs: 1000,
    }, async ({ id }) => {
      const server = createServer((_req, res) => {
        res.setHeader("content-type", "application/json");
        res.setHeader("mcp-session-id", "session-" + id + "-" + (++counter));
        res.end(JSON.stringify({ id }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      created.push(server);
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("test listener");
      return { port: addr.port, token: "internal-" + id, close: async () => undefined };
    });
    created.push(g.server);
    const addr = g.server.address();
    if (!addr || typeof addr === "string") throw new Error("gateway address");
    const url = "http://127.0.0.1:" + addr.port;
    const first = await call(url, "/mcp");
    const second = await call(url, "/mcp");
    expect(first.session).toBe("session-frontend-1");
    expect(second.session).toBe("session-frontend-2");
    expect((await call(url, "/mcp")).status).toBe(503);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const afterExpiration = await call(url, "/mcp");
    expect(afterExpiration.status).toBe(200);
    expect(afterExpiration.session).toBe("session-frontend-3");
    expect((await call(url, "/mcp", { "mcp-session-id": first.session! })).status).toBe(404);
  }, 10000);

  it("refuses invalid session-capacity settings before gateway bind", async () => {
    const p = projects();
    for (const maxSessions of [0, -1, 100000, 1.5]) {
      await expect(createProjectGateway({
        parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
        maxSessions, projects: [{ id: "frontend", root: p.frontend }],
      }, fakeWorker)).rejects.toThrow(/session|capacity/i);
    }
  });

  it("rejects symlink-backed project roots and never starts workers during discovery", async () => {
    const p = projects();
    symlinkSync(p.frontend, join(p.parent, "alias"), "dir");
    await expect(createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret,
      projects: [{ id: "alias", root: join(p.parent, "alias") }],
    }, async () => { throw new Error("must not spawn"); })).rejects.toThrow(/symlink|canonical|root/i);
  });

  it("forgets a dead worker's session and releases its worker slot for an authorized project", async () => {
    const p = projects();
    const exit: Array<() => void> = [];
    const starts: string[] = [];
    const g = await createProjectGateway({
      parentRoot: p.parent, host: "127.0.0.1", port: 0, token: secret, maxWorkers: 1,
      projects: [{ id: "frontend", root: p.frontend }, { id: "backend", root: p.backend }],
    }, async ({ id }) => {
      starts.push(id);
      const worker = await fakeWorker(id);
      return { ...worker, onExit: (listener: () => void) => { exit.push(listener); } };
    });
    created.push(g.server);
    const addr = g.server.address();
    if (!addr || typeof addr === "string") throw new Error("gateway listener");
    const url = "http://127.0.0.1:" + addr.port;
    expect((await call(url, "/mcp", { "x-folderforge-project": "frontend" })).status).toBe(200);
    exit[0]!();
    expect((await call(url, "/mcp", { "mcp-session-id": "session-frontend" })).status).toBe(404);
    expect((await call(url, "/mcp", { "x-folderforge-project": "backend" })).status).toBe(200);
    expect(starts).toEqual(["frontend", "backend"]);
  });

  it("refuses public binds, weak gateway tokens, and more than the allowed worker count", async () => {
    const p = projects();
    const base = { parentRoot: p.parent, port: 0, token: secret, projects: [{ id: "frontend", root: p.frontend }] };
    await expect(createProjectGateway({ ...base, host: "0.0.0.0" }, fakeWorker)).rejects.toThrow(/loopback/i);
    await expect(createProjectGateway({ ...base, host: "127.0.0.1", token: "short" }, fakeWorker)).rejects.toThrow(/token/i);
    const { url, starts } = await gateway(p, { maxWorkers: 1 });
    expect((await call(url, "/mcp", { "x-folderforge-project": "frontend" })).status).toBe(200);
    expect((await call(url, "/mcp", { "x-folderforge-project": "backend" })).status).toBe(503);
    expect(starts).toEqual(["frontend"]);
  });
});
