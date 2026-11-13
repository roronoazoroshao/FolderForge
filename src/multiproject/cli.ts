import { openSync, readFileSync, closeSync, fstatSync, constants } from "node:fs";
import { isAbsolute } from "node:path";
import { createProjectGateway, type ProjectGatewayOptions } from "./project-gateway.js";
import { spawnProjectWorker } from "./project-worker.js";

interface Manifest {
  parentRoot: string;
  port: number;
  maxWorkers?: number;
  maxSessions?: number;
  projects: Array<{ id: string; root: string }>;
}

export function loadProjectGatewaySpec(
  filePath: string,
  environment: Record<string, string | undefined> = process.env,
): ProjectGatewayOptions {
  if (!isAbsolute(filePath)) throw new Error("Gateway config path must be absolute");
  const token = environment.FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN;
  if (!token || Buffer.byteLength(token) < 32) {
    throw new Error("FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN must be at least 32 bytes");
  }
  let fd: number;
  try {
    fd = openSync(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error &&
      error.code === "ELOOP") {
      throw new Error("Gateway config symlink is forbidden");
    }
    throw error;
  }
  let raw: string;
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || (st.mode & 0o022) !== 0) {
      throw new Error("Gateway config must be a regular file without group/world write permission");
    }
    raw = readFileSync(fd, "utf8");
  } finally {
    closeSync(fd);
  }
  const manifest = JSON.parse(raw) as Manifest;
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error("Gateway config must be a JSON object");
  }
  if ("host" in manifest) {
    throw new Error("Project gateway must remain loopback-only; host override refused");
  }
  const allowed = new Set(["parentRoot", "port", "maxWorkers", "maxSessions", "projects"]);
  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) throw new Error("Unknown gateway configuration key: " + key);
  }
  if (typeof manifest.parentRoot !== "string" || !Array.isArray(manifest.projects) ||
    typeof manifest.port !== "number" ||
    !manifest.projects.every((project) => project && typeof project.id === "string" &&
      typeof project.root === "string" && Object.keys(project).every((key) => key === "id" || key === "root"))) {
    throw new Error("Invalid gateway projects manifest");
  }
  return {
    parentRoot: manifest.parentRoot,
    projects: manifest.projects,
    host: "127.0.0.1",
    port: manifest.port,
    token,
    ...(manifest.maxWorkers !== undefined ? { maxWorkers: manifest.maxWorkers } : {}),
    ...(manifest.maxSessions !== undefined ? { maxSessions: manifest.maxSessions } : {}),
  };
}

/** Opt-in; does not modify or restart the existing OpenAI/Cloudflare tunnel. */
export async function executeMultiProjectCli(argv: string[]): Promise<void> {
  if (argv.length !== 3 || argv[0] !== "serve" || argv[1] !== "--config" || !argv[2]) {
    throw new Error("Usage: folderforge multi-project serve --config /absolute/path/projects.json");
  }
  const options = loadProjectGatewaySpec(argv[2]);
  const gateway = await createProjectGateway(options, spawnProjectWorker);
  const addr = gateway.server.address();
  if (!addr || typeof addr === "string") throw new Error("Gateway listener missing");
  process.stdout.write(
    "Authenticated project gateway listening on loopback 127.0.0.1:" + addr.port +
    " for " + options.projects.length + " individually approved projects\n",
  );
  let shutdownPending = false;
  const shutdown = () => {
    if (shutdownPending) return;
    shutdownPending = true;
    void gateway.close().catch(() => { process.exitCode = 1; });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
