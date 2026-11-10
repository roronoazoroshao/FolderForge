import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectGateway, type ProjectGateway } from "../../src/multiproject/project-gateway.js";
import { spawnProjectWorker } from "../../src/multiproject/project-worker.js";

const token = "integration-gateway-static-test-0123456789";
const projectDirs: string[] = [];
const gateways: ProjectGateway[] = [];
afterEach(async () => {
  await Promise.all(gateways.splice(0).map((g) => g.close()));
  projectDirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "ff-multiproject-real-"));
  projectDirs.push(parent);
  for (const id of ["a", "b"]) {
    mkdirSync(join(parent, id));
    writeFileSync(join(parent, id, "identifier.txt"), "marker-" + id);
  }
  return parent;
}
async function rpc(url: string, project: string, sessionId: string | undefined, method: string, params: unknown, id?: number) {
  const res = await fetch(url + "/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : { "x-folderforge-project": project }),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...(id ? { id } : {}), method, params }),
  });
  const raw = await res.text();
  const events = raw.split(/\r?\n/).filter((line) => line.startsWith("data:"));
  const body = raw ? JSON.parse(events.length ? events.at(-1)!.slice(5).trim() : raw) as any : null;
  return { status: res.status, session: res.headers.get("mcp-session-id"), body };
}
describe("F14 real process boundary", () => {
  it("starts separate MCP child processes and keeps pathless workspace state within each project", async () => {
    const parent = fixture();
    const g = await createProjectGateway({
      parentRoot: parent, host: "127.0.0.1", port: 0, token,
      projects: [{ id: "a", root: join(parent, "a") }, { id: "b", root: join(parent, "b") }],
    }, spawnProjectWorker);
    gateways.push(g);
    const address = g.server.address();
    if (!address || typeof address === "string") throw new Error("gateway port missing");
    const url = "http://127.0.0.1:" + address.port;
    const init = {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "multiproject-test", version: "1" },
    };
    const [a, b] = await Promise.all([
      rpc(url, "a", undefined, "initialize", init, 1),
      rpc(url, "b", undefined, "initialize", init, 2),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.session).toBeTruthy();
    expect(b.session).toBeTruthy();
    expect(a.session).not.toBe(b.session);
    await Promise.all([
      rpc(url, "a", a.session!, "notifications/initialized", {}),
      rpc(url, "b", b.session!, "notifications/initialized", {}),
    ]);
    const [ar, br] = await Promise.all([
      rpc(url, "a", a.session!, "tools/call", { name: "workspace_status", arguments: {} }, 3),
      rpc(url, "b", b.session!, "tools/call", { name: "workspace_status", arguments: {} }, 4),
    ]);
    expect(ar.status).toBe(200);
    expect(br.status).toBe(200);
    const aText = JSON.stringify(ar.body);
    const bText = JSON.stringify(br.body);
    expect(aText).toContain(join(parent, "a"));
    expect(aText).not.toContain(join(parent, "b"));
    expect(bText).toContain(join(parent, "b"));
    expect(bText).not.toContain(join(parent, "a"));
    const forbidden = await rpc(url, "a", a.session!, "tools/call", {
      name: "file_read", arguments: { path: join(parent, "b", "identifier.txt") },
    }, 5);
    expect(forbidden.body?.result?.isError).toBe(true);
  }, 40000);
});
