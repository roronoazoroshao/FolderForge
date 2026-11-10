import { fork, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ProjectSpec, ProjectWorker } from "./project-gateway.js";

interface WorkerReady {
  type: "ready";
  port: number;
}
interface WorkerError {
  type: "error";
  code: string;
}
type WorkerMessage = WorkerReady | WorkerError;

function isWorkerMessage(value: unknown): value is WorkerMessage {
  return typeof value === "object" && value !== null &&
    "type" in value && (value.type === "ready" || value.type === "error");
}

/**
 * Launches ONLY the project worker created by this gateway. No shell, execArgv,
 * caller credentials or inherited NODE_OPTIONS. Root authorization happens in
 * the gateway before this function; a worker's own config is further narrowed.
 */
export async function spawnProjectWorker(project: ProjectSpec): Promise<ProjectWorker> {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG",
    "SYSTEMROOT", "WINDIR", "APPDATA", "LOCALAPPDATA"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  const childPath = fileURLToPath(new URL("../../dist/multiproject/project-worker-child.js", import.meta.url));
  const child: ChildProcess = fork(childPath, [], {
    cwd: project.root, env, execArgv: [],
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const token = randomBytes(32).toString("hex");
  try {
    const port = await new Promise<number>((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error("worker_start_timeout")), 15000);
      timer.unref();
      const cleanup = () => {
        clearTimeout(timer);
        child.off("message", onMessage);
        child.off("error", onError);
        child.off("exit", onExit);
      };
      const fail = (code: string) => { cleanup(); reject(new Error(code)); };
      const onError = () => fail("worker_process_error");
      const onExit = () => fail("worker_exited_before_ready");
      const onMessage = (message: unknown) => {
        if (!isWorkerMessage(message)) return;
        if (message.type === "error") { fail("worker_initialization_failed"); return; }
        if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65535) {
          fail("worker_invalid_port"); return;
        }
        cleanup();
        resolveReady(message.port);
      };
      child.on("message", onMessage);
      child.once("error", onError);
      child.once("exit", onExit);
      child.send({ type: "start", projectRoot: project.root, rootIdentity: project.rootIdentity, token }, (error) => {
        if (error) fail("worker_ipc_start_failed");
      });
    });
    return {
      port, token,
      onExit(callback) {
        if (child.exitCode !== null || child.signalCode !== null) {
          queueMicrotask(callback);
          return;
        }
        child.once("exit", callback);
        child.once("error", callback);
      },
      async close() {
        if (child.exitCode !== null || child.signalCode !== null) return;
        await new Promise<void>((resolveExit) => {
          const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
          timer.unref();
          child.once("exit", () => { clearTimeout(timer); resolveExit(); });
          child.send({ type: "stop" }, () => {
            if (!child.connected) child.kill("SIGTERM");
          });
        });
      },
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    throw error;
  }
}
