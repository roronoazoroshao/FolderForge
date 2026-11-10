import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectGatewaySpec } from "../../src/multiproject/cli.js";

const scratch: string[] = [];
afterEach(() => scratch.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "ff-projects-config-"));
  scratch.push(parent);
  mkdirSync(join(parent, "frontend"));
  const configPath = join(parent, "projects.json");
  writeFileSync(configPath, JSON.stringify({
    parentRoot: parent, port: 7339,
    projects: [{ id: "frontend", root: join(parent, "frontend") }],
  }), { mode: 0o600 });
  return { parent, configPath };
}
const token = "test-config-token-is-long-enough-01234567";
describe("F14 multi-project operator allowlist", () => {
  it("requires an explicit owner-controlled file and token without persisting or logging the credential", () => {
    const f = fixture();
    const resolved = loadProjectGatewaySpec(f.configPath, { FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN: token });
    expect(resolved.projects).toEqual([{ id: "frontend", root: join(f.parent, "frontend") }]);
    expect(resolved.host).toBe("127.0.0.1");
    expect(resolved.port).toBe(7339);
    expect(resolved.token).toBe(token);
    expect(() => loadProjectGatewaySpec(f.configPath, {})).toThrow(/token/i);
    expect(() => loadProjectGatewaySpec(f.configPath, { FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN: "weak" })).toThrow(/token/i);
  });

  it("rejects writable/symlink allowlists, unknown configuration keys and public binds", () => {
    const f = fixture();
    const env = { FOLDERFORGE_MULTI_PROJECT_GATEWAY_TOKEN: token };
    const json = { parentRoot: f.parent, port: 7339, projects: [{ id: "frontend", root: join(f.parent, "frontend") }] };
    writeFileSync(f.configPath, JSON.stringify(json), { mode: 0o600, flag: "w" });
    writeFileSync(join(f.parent, "other.json"), JSON.stringify(json), { mode: 0o600 });
    symlinkSync(join(f.parent, "other.json"), join(f.parent, "alias.json"));
    expect(() => loadProjectGatewaySpec(join(f.parent, "alias.json"), env)).toThrow(/symlink/i);
    writeFileSync(f.configPath, JSON.stringify({ ...json, host: "0.0.0.0" }));
    expect(() => loadProjectGatewaySpec(f.configPath, env)).toThrow(/loopback/i);
    writeFileSync(f.configPath, JSON.stringify({ ...json, rootOverride: "/tmp" }));
    expect(() => loadProjectGatewaySpec(f.configPath, env)).toThrow(/unknown/i);
  });
});
