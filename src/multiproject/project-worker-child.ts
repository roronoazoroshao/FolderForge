import { realpathSync, lstatSync } from "node:fs";
import { defaultConfig } from "../runtime/config.js";
import { readFolderForgeVersion } from "../core/version.js";
import { Container } from "../runtime/container.js";
import { buildRegistry, resolveActiveTools } from "../tools/index.js";
import { createMcpServer } from "../server/mcp-server.js";
import { createModernMcpServer } from "../server/protocol/modern-adapter.js";
import { startHttpTransport } from "../server/transports/http.js";
import { withExecutionContext } from "../core/principal.js";
import { stopManagedProcessTrees } from "../runtime/shutdown.js";
import type { ToolPrincipal } from "../core/types.js";
import type { Server } from "node:http";

interface StartMessage { type: "start"; projectRoot: string; rootIdentity: string; token: string }
let started = false;
let closing = false;
let server: Server | undefined;
let container: Container | undefined;

async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  if (container) await stopManagedProcessTrees(container);
  process.exitCode = 0;
  if (process.connected) process.disconnect?.();
}
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
process.on("disconnect", () => { void shutdown(); });
process.on("message", (data: unknown) => {
  if (typeof data !== "object" || data === null || !("type" in data)) return;
  if (data.type === "stop") { void shutdown(); return; }
  if (started || data.type !== "start") return;
  started = true;
  void (async () => {
    const message = data as StartMessage;
    if (!message.projectRoot || !message.token || message.token.length < 32 ||
      realpathSync(message.projectRoot) !== message.projectRoot ||
      message.rootIdentity !== String(lstatSync(message.projectRoot).dev) + ":" +
        String(lstatSync(message.projectRoot).ino)) throw new Error("Invalid worker root identity");
    // Deliberately load trusted defaults, not project-supplied YAML that could
    // broaden allowed roots, enable danger mode or silently loosen approvals.
    const config = defaultConfig(message.projectRoot);
    config.workspace.defaultProject = message.projectRoot;
    config.workspace.allowedDirectories = [message.projectRoot];
    config.server.transport = "http";
    config.server.mcpProtocol = { mode: "dual" };
    config.server.dashboard.enabled = false;
    config.policy.defaultMode = "safe";
    config.audit.durability = "required";
    const localContainer = new Container(config);
    container = localContainer;
    const registry = buildRegistry(localContainer);
    const active = resolveActiveTools(registry, { preset: "vibe" });
    if (active) registry.setActive(active);
    const makeServer = (principal: ToolPrincipal) =>
      createMcpServer(registry, {
        name: "folderforge-project-worker", version: readFolderForgeVersion(),
        principal: withExecutionContext(principal, message.projectRoot),
        roots: [message.projectRoot], container: localContainer,
      });
    const allowedToolNames = new Set(registry.listAgentActive().map((tool) => tool.name));
    server = await startHttpTransport(makeServer, {
      host: "127.0.0.1", port: 0, path: "/mcp",
      protocolMode: "dual", authMode: "token", token: message.token,
      requireAuth: true, corsOrigins: [],
      modernServerFactory: (principal) =>
        createModernMcpServer(registry, {
          name: "folderforge-project-worker", version: readFolderForgeVersion(),
          principal: withExecutionContext(principal, message.projectRoot),
          container: localContainer, allowedToolNames,
        }),
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Worker listener missing");
    process.send?.({ type: "ready", port: address.port });
  })().catch(() => {
    process.send?.({ type: "error", code: "worker_start_failed" }, () => {
      if (process.connected) process.disconnect?.();
    });
    process.exitCode = 1;
  });
});
