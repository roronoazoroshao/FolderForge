import { createServer, request as httpRequest, type Server, type ServerResponse } from "node:http";
import { lstatSync, realpathSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface ProjectSpec {
  id: string;
  root: string;
  /** Canonical dev:ino identity assigned by the trusted gateway; never from user manifests. */
  rootIdentity?: string;
}
export interface ProjectWorker {
  port: number;
  token: string;
  close(): Promise<void>;
  onExit?(callback: () => void): void;
}
export type ProjectWorkerFactory = (project: ProjectSpec) => Promise<ProjectWorker>;
export interface ProjectGatewayOptions {
  parentRoot: string;
  projects: ProjectSpec[];
  host: "127.0.0.1" | "::1";
  port: number;
  token: string;
  maxWorkers?: number;
  sessionTtlMs?: number;
  maxBodyBytes?: number;
}
export interface ProjectGateway {
  server: Server;
  close(): Promise<void>;
}
const PROJECT_ID = /^[a-z][a-z0-9_-]{0,47}$/;
const SESSION_ID = /^[a-zA-Z0-9._~-]{1,200}$/;

function json(res: ServerResponse, status: number, error: string): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify({ error }));
}
function exactToken(value: string | undefined, expected: string): boolean {
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function guardedRoot(path: string, parentRoot: string): string {
  if (!isAbsolute(path)) throw new Error("Project root must be absolute");
  const root = resolve(path);
  const rel = relative(parentRoot, root);
  if (!rel || rel.startsWith(".." + sep) || rel === ".." || isAbsolute(rel)) {
    throw new Error("Project root must be a direct or nested child of the approved parent root");
  }
  let part = parentRoot;
  for (const item of rel.split(sep)) {
    part = resolve(part, item);
    const info = lstatSync(part);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error("Project root contains a symlink or non-directory component");
    }
  }
  if (realpathSync(root) !== root) throw new Error("Project root is not canonical");
  return root;
}
function validate(options: ProjectGatewayOptions): Map<string, ProjectSpec> {
  if (options.host !== "127.0.0.1" && options.host !== "::1") {
    throw new Error("Project gateway must bind to loopback only");
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error("Gateway port is invalid");
  }
  if (typeof options.token !== "string" || Buffer.byteLength(options.token) < 32) {
    throw new Error("Project gateway token must be at least 32 bytes");
  }
  if (!isAbsolute(options.parentRoot)) throw new Error("Parent root must be absolute");
  const parent = resolve(options.parentRoot);
  if (realpathSync(parent) !== parent || lstatSync(parent).isSymbolicLink()) {
    throw new Error("Parent root must be canonical and not a symlink");
  }
  if (!options.projects.length || options.projects.length > 32) {
    throw new Error("Project allowlist must contain between 1 and 32 entries");
  }
  if (options.maxWorkers !== undefined &&
    (!Number.isInteger(options.maxWorkers) || options.maxWorkers < 1 || options.maxWorkers > 32)) {
    throw new Error("Maximum workers must be between 1 and 32");
  }
  const found = new Map<string, ProjectSpec>();
  const roots = new Set<string>();
  for (const item of options.projects) {
    if (!PROJECT_ID.test(item.id) || found.has(item.id)) {
      throw new Error("Invalid or duplicate project ID");
    }
    const root = guardedRoot(item.root, parent);
    if (roots.has(root)) throw new Error("Duplicate project root");
    roots.add(root);
    const st = lstatSync(root);
    found.set(item.id, { id: item.id, root, rootIdentity: String(st.dev) + ":" + String(st.ino) });
  }
  return found;
}

interface SessionAffinity {
  projectId: string;
  expiresAt: number;
}

/**
 * Explicit, opt-in gateway: an authenticated MCP endpoint multiplexes ONLY
 * pre-authorized independent project workers, never a process-global workspace
 * switch. The worker factory is injectable for deterministic network tests.
 */
export async function createProjectGateway(
  options: ProjectGatewayOptions,
  startWorker: ProjectWorkerFactory,
): Promise<ProjectGateway> {
  const projects = validate(options);
  const parent = resolve(options.parentRoot);
  const maxWorkers = options.maxWorkers ?? 8;
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 60_000;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 8 * 1024 * 1024) {
    throw new Error("Invalid request body limit");
  }
  if (!Number.isFinite(sessionTtlMs) || sessionTtlMs < 1000) {
    throw new Error("Invalid session lifetime");
  }
  const workers = new Map<string, Promise<ProjectWorker>>();
  const sessions = new Map<string, SessionAffinity>();
  let shuttingDown = false;

  async function getWorker(project: ProjectSpec): Promise<ProjectWorker> {
    guardedRoot(project.root, parent);
    const st = lstatSync(project.root);
    if (project.rootIdentity !== String(st.dev) + ":" + String(st.ino)) {
      throw new Error("project_root_identity_changed");
    }
    let worker = workers.get(project.id);
    if (worker) return worker;
    if (workers.size >= maxWorkers) throw new Error("worker_capacity");
    worker = Promise.resolve().then(() => startWorker(project)).then((ready) => {
      if (!Number.isInteger(ready.port) || ready.port < 1 || ready.port > 65535 ||
        typeof ready.token !== "string" || ready.token.length < 16) {
        throw new Error("Invalid project worker readiness receipt");
      }
      ready.onExit?.(() => {
        if (workers.get(project.id) === worker) workers.delete(project.id);
        for (const [id, binding] of sessions) {
          if (binding.projectId === project.id) sessions.delete(id);
        }
      });
      return ready;
    }).catch((err: unknown) => {
      workers.delete(project.id);
      throw err;
    });
    workers.set(project.id, worker);
    return worker;
  }

  const server = createServer((req, res) => {
    void (async () => {
      const uri = new URL(req.url ?? "/", "http://localhost");
      if (uri.pathname === "/healthz" && req.method === "GET") {
        json(res, 200, "ok"); return;
      }
      if (uri.pathname !== "/mcp" && !/^\/projects\/[a-z][a-z0-9_-]{0,47}\/mcp$/.test(uri.pathname)) {
        json(res, 404, "not_found"); return;
      }
      if (req.headers.origin) { json(res, 403, "origin_not_allowed"); return; }
      const header = req.headers.authorization;
      const bearer = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
      if (!exactToken(bearer, options.token)) { json(res, 401, "unauthorized"); return; }
      if (!["POST", "GET", "DELETE"].includes(req.method ?? "")) {
        json(res, 405, "method_not_allowed"); return;
      }
      const sessionId = req.headers["mcp-session-id"];
      if (sessionId !== undefined && (typeof sessionId !== "string" || !SESSION_ID.test(sessionId))) {
        json(res, 400, "invalid_session"); return;
      }
      const selector = req.headers["x-folderforge-project"];
      if (selector !== undefined && (typeof selector !== "string" || !PROJECT_ID.test(selector))) {
        json(res, 400, "invalid_project"); return;
      }
      const selectedInPath = uri.pathname.startsWith("/projects/") ? uri.pathname.split("/")[2] : undefined;
      if (selector && selectedInPath && selector !== selectedInPath) {
        json(res, 409, "project_mismatch"); return;
      }
      const selected = selector || selectedInPath;
      let pinned = sessionId ? sessions.get(sessionId) : undefined;
      if (pinned && pinned.expiresAt <= Date.now()) {
        sessions.delete(sessionId as string);
        pinned = undefined;
      }
      if (sessionId && !pinned) { json(res, 404, "unknown_session"); return; }
      if (pinned && selected && selected !== pinned.projectId) {
        json(res, 409, "session_project_mismatch"); return;
      }
      const projectId = pinned?.projectId ?? selected ?? (projects.size === 1 ? projects.keys().next().value : undefined);
      if (!projectId) { json(res, 400, "project_required"); return; }
      const project = projects.get(projectId);
      if (!project) { json(res, 404, "unknown_project"); return; }
      if (req.headers["content-length"] && Number(req.headers["content-length"]) > maxBodyBytes) {
        json(res, 413, "body_too_large"); return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        total += bytes.length;
        if (total > maxBodyBytes) { json(res, 413, "body_too_large"); return; }
        chunks.push(bytes);
      }
      if (shuttingDown) { json(res, 503, "gateway_shutting_down"); return; }
      let worker: ProjectWorker;
      try {
        worker = await getWorker(project);
      } catch {
        json(res, 503, "worker_unavailable"); return;
      }
      // Limit the proxy header set. Never send gateway credential, client cookies
      // or client-selected internal headers to the worker.
      const safeHeaders: Record<string, string> = {
        authorization: "Bearer " + worker.token,
      };
      for (const key of ["accept", "content-type", "mcp-protocol-version", "mcp-session-id",
        "last-event-id", "mcp-method", "mcp-name"]) {
        const value = req.headers[key];
        if (typeof value === "string") safeHeaders[key] = value;
      }
      if (chunks.length) safeHeaders["content-length"] = String(total);
      const upstream = httpRequest({
        hostname: "127.0.0.1", port: worker.port,
        path: "/mcp" + uri.search, method: req.method, headers: safeHeaders,
      });
      let completed = false;
      upstream.on("response", (workerResponse) => {
        const workerSessionId = workerResponse.headers["mcp-session-id"];
        if (typeof workerSessionId === "string") {
          if (!SESSION_ID.test(workerSessionId) ||
            (sessions.has(workerSessionId) && sessions.get(workerSessionId)?.projectId !== projectId)) {
            workerResponse.destroy();
            json(res, 502, "invalid_worker_session");
            return;
          }
          sessions.set(workerSessionId, { projectId, expiresAt: Date.now() + sessionTtlMs });
        }
        if (sessionId && pinned) pinned.expiresAt = Date.now() + sessionTtlMs;
        const responseHeaders: Record<string, string> = { "cache-control": "no-store" };
        for (const key of ["content-type", "mcp-session-id", "mcp-protocol-version", "retry-after"]) {
          const value = workerResponse.headers[key];
          if (typeof value === "string") responseHeaders[key] = value;
        }
        res.writeHead(workerResponse.statusCode ?? 502, responseHeaders);
        workerResponse.pipe(res);
        workerResponse.on("end", () => {
          completed = true;
          if (req.method === "DELETE" && sessionId) sessions.delete(sessionId);
        });
      });
      upstream.on("error", () => {
        if (!completed) json(res, 502, "worker_transport_error");
      });
      res.on("close", () => {
        if (!res.writableFinished) upstream.destroy();
      });
      upstream.end(Buffer.concat(chunks));
    })().catch(() => json(res, 500, "internal_error"));
  });
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, () => {
        server.off("error", reject);
        resolveListen();
      });
    });
  } catch (error) {
    server.close();
    throw error;
  }

  return {
    server,
    async close() {
      shuttingDown = true;
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await Promise.allSettled([...workers.values()].map(async (p) => (await p).close()));
      workers.clear();
      sessions.clear();
    },
  };
}
