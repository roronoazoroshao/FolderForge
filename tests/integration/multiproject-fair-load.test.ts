import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProjectGateway, type ProjectWorker, type ProjectGateway } from "../../src/multiproject/project-gateway.js";

const bearer = "load-fixture-only-gateway-token-0123456789";
const servers: Server[] = [];
const gateways: ProjectGateway[] = [];
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(gateways.splice(0).map((g) => g.close()));
  await Promise.all(servers.splice(0).map(
    (server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe("F15 bounded fair multi-project HTTP load", () => {
  it("handles 3 projects x 2 clients x 200 calls with isolated project identities and no 429/503", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ff-f15-load-")));
    dirs.push(root);
    const ids = ["alpha", "bravo", "charlie"];
    const workerRequests = new Map<string, number>();
    for (const id of ids) mkdirSync(join(root, id));
    const workerFactory = async ({ id }: { id: string }): Promise<ProjectWorker> => {
      const server = createServer((_req, res) => {
        workerRequests.set(id, (workerRequests.get(id) ?? 0) + 1);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ project: id }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      servers.push(server);
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("worker socket");
      return { port: address.port, token: "test-internal-worker-" + id, close: async () => undefined };
    };
    const gateway = await createProjectGateway({
      parentRoot: root, host: "127.0.0.1", port: 0, token: bearer,
      projects: ids.map((id) => ({ id, root: join(root, id) })),
      scheduling: {
        globalConcurrency: 4, perProjectConcurrency: 2,
        maxQueuedPerProject: 24, maxQueuedBytes: 1024 * 1024,
        maxRequestsPerProject: 500, maxRequestsGlobal: 1500,
        queueTimeoutMs: 15000,
      },
    }, workerFactory);
    gateways.push(gateway);
    const address = gateway.server.address();
    if (!address || typeof address === "string") throw new Error("gateway socket");
    const url = "http://127.0.0.1:" + address.port + "/mcp";
    const latencies: number[] = [];
    const started = performance.now();
    await Promise.all(ids.flatMap((id) =>
      Array.from({ length: 2 }, async () => {
        for (let index = 0; index < 200; index++) {
          const callStart = performance.now();
          const result = await fetch(url, {
            method: "POST",
            headers: {
              authorization: "Bearer " + bearer,
              "x-folderforge-project": id,
              "content-type": "application/json",
            },
            body: JSON.stringify({ jsonrpc: "2.0", id: index, method: "initialize" }),
          });
          expect(result.status).toBe(200);
          expect((await result.json() as { project: string }).project).toBe(id);
          latencies.push(performance.now() - callStart);
        }
      }),
    ));
    const elapsed = performance.now() - started;
    const sorted = latencies.sort((a, b) => a - b);
    const p95 = sorted[Math.floor((sorted.length - 1) * .95)]!;
    // Benchmarks must report observed values, not enforce a meaningless
    // cross-machine absolute-latency threshold in PR CI.
    console.info(JSON.stringify({
      feature: "F15", scenario: "3projects_2clients_200calls",
      count: latencies.length, observedP95Ms: Math.round(p95 * 100) / 100,
      elapsedMs: Math.round(elapsed),
    }));
    expect(latencies.length).toBe(1200);
    for (const id of ids) expect(workerRequests.get(id)).toBe(400);
    expect(gateway.snapshot()).toMatchObject({
      active: 0, queued: 0, queuedBytes: 0, accepted: 1200, rejected: 0,
    });
  }, 45000);
});
