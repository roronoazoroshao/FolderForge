# Configuration and environment reference

Baseline `main@8c00b15`. **Do not** paste actual tokens, signing URLs, env values or private keys into docs/issues.

## Precedence and defaults
1. CLI explicit config/project arguments, then `FOLDERFORGE_CONFIG`, then `folderforge.yaml` / `.folderforge.yaml` / `.folderforge/config.yaml` in the project; first existing config is merged with defaults (`src/runtime/config.ts:312-339`). YAML parse failure logs a warning and defaults are used (`src/runtime/config.ts:327-334`).
2. Environment overrides and HTTP-auth defaults are applied **after** file config (`src/runtime/config.ts:339-340`).
3. Defaults include stdio, HTTP loopback `127.0.0.1:7331`, Dashboard `127.0.0.1:7332`, project-only allowed root, `safe` policy, approvals and quota (`src/runtime/config.ts:202-267`).
4. The Dashboard owner flow and managed Control CLI use a **per-project** state; `--project` must be explicit in automation (`README.md:145-149`; `src/control/cli.ts:1350`).

## User-facing environment variables, exact source references

| Variable | Purpose / accepted type | Sensitivity / scope | Evidence |
|---|---|---|---|
| `FOLDERFORGE_CONFIG` | Alternate YAML config file path | Operator path | `src/runtime/config.ts:316-322` |
| `FOLDERFORGE_HTTP_AUTH` | `none` / `token` / `oauth` | Security-sensitive | `src/runtime/config.ts:60-69` |
| `FOLDERFORGE_HTTP_TOKEN` | Static MCP bearer token; consumed and deleted from env | **Secret** | `src/runtime/config.ts:70-73` |
| `FOLDERFORGE_HTTP_API_KEYS` | CSV API keys | **Secrets** | `src/runtime/config.ts:74-75` |
| `FOLDERFORGE_ALLOW_UNAUTHENTICATED_TUNNEL` | Explicit unsafe tunnel override | Critical approval, don't use casually | `src/main.ts:590`; `src/server/transports/http.ts:256` |
| `FOLDERFORGE_HTTP_GATEWAY_TOKEN` | Upstream gateway bearer | **Secret** | `src/main.ts:536-541` |
| `FOLDERFORGE_HTTP_GATEWAY_HEADER` | Upstream gateway header name | Validate routing | `src/main.ts:538-541` |
| `FOLDERFORGE_OAUTH_RESOURCE` | OAuth protected resource identifier | Public URL/identity | `src/runtime/config.ts:61-65` |
| `FOLDERFORGE_OAUTH_METADATA_URL` | Auth metadata URL | Network trust | `src/runtime/config.ts:62-65` |
| `FOLDERFORGE_OAUTH_ISSUER` | Issuer URL | Token issuer trust | `src/runtime/config.ts:63-65` |
| `FOLDERFORGE_OAUTH_SCOPES` | CSV scopes | Least privilege | `src/runtime/config.ts:64-65` |
| `FOLDERFORGE_OAUTH_READ_SCOPE` | Read scope name | Auth policy | `src/runtime/config.ts:87-89` |
| `FOLDERFORGE_OAUTH_WRITE_SCOPE` | Write scope name | Auth policy | `src/runtime/config.ts:90-92` |
| `FOLDERFORGE_OAUTH_CLIENT_REGISTRATION` | Registration policy | OAuth high-risk | `src/runtime/config.ts:93-95` |
| `FOLDERFORGE_OAUTH_JWKS_URI` | JWKS key URL | Signing trust | `src/runtime/config.ts:96-98` |
| `FOLDERFORGE_OAUTH_TRUSTED_JWKS_HOSTS` | CSV allowlist hosts | Security-critical | `src/runtime/config.ts:99-101` |
| `FOLDERFORGE_OAUTH_ALGORITHMS` | CSV allowed asymmetric JWT algorithms | Security-critical | `src/runtime/config.ts:102-104` |
| `FOLDERFORGE_OAUTH_ALLOW_INSECURE_HTTP` | Development-only boolean | **Unsafe in prod** | `src/runtime/config.ts:105-107` |
| `FOLDERFORGE_AUDIT_DURABILITY` | Audit durability policy | Prefer required for critical ops | `src/runtime/config.ts:47-50` |
| `FOLDERFORGE_AUDIT_REQUIRE_HIGH_RISK` | Boolean risk-gated audit | Security control | `src/runtime/config.ts:51-52` |
| `FOLDERFORGE_AUDIT_REQUIRE_AUTHENTICATED_HTTP` | Boolean auth-gated audit | Security control | `src/runtime/config.ts:53-58` |
| `FOLDERFORGE_APPROVALS_PATH` | Override approval storage location | Protected operator state | `src/policy/policy-engine.ts:51` |
| `FOLDERFORGE_LOG_LEVEL` | Pino log verbosity | Redact secrets | `src/core/logger.ts:8` |
| `FOLDERFORGE_RESPONSES_WORKFLOW_ID` | Workflow backing Responses route | Governance | `src/main.ts:681` |
| `FOLDERFORGE_AUTH0_CLI_JS` | Auth0 CLI JS location | External command trust | `src/chatgpt/cli.ts:686` |
| `CONTROL_PLANE_API_KEY` | OpenAI tunnel credential env name, used by examples | **Secret; source access is dynamic, validate usage** | `README.md:111-115,139-142`; `src/chatgpt/openai-tunnel.ts` |
| `NODE_ENV`, `PATH`, `DISPLAY`, `WAYLAND_DISPLAY` | Runtime/process UI environment | System context; not FolderForge config knobs | `src/control/cli.ts:1374`; `src/operator/local-owner-launcher.ts:24` |

Complete **static** environment reference covering 38 tracked source/script names: [ENV_REFERENCE.md](audit/ENV_REFERENCE.md). Unknown dynamic names or CI-scoped variables are **[UNVERIFIED]**; do not treat this list as a secret-safe environment dump.

## Security and runtime bounds

| Config item | Effective default | Evidence |
|---|---|---|
| Workspace allowed roots | Project root only | `src/runtime/config.ts:211-215` |
| Policy mode | `safe`; CRITICAL in danger off | `src/runtime/config.ts:216-229` |
| Audit | `best-effort`; require high risk/auth HTTP | `src/runtime/config.ts:230-234` |
| Capsule enforcement | `optional` | `src/runtime/config.ts:235-239` |
| Terminal sandbox mode | `process`; require sandbox in danger | `src/runtime/config.ts:240-248` |
| Tool call default | 60 calls / 10s | `src/runtime/config.ts:255-259` |
| `shell_exec` | 20 calls / 10s, 1000/day | `src/runtime/config.ts:260-266` |
| Optional child servers | Serena, Playwright, Desktop Commander, Godot disabled by default | `src/runtime/config.ts:274-278` |
| D1 Configuration inventory | **4 allowlisted read-only descriptors**, source provenance unknown | `src/operator/config-descriptors.ts:4-60` |
| D2 Web quota editor | Only parent `shell_exec` and three bounded integer values; revision required | `src/operator/rate-limit-settings.ts:20-30,51-55,184-196` |

**Critical caveat:** the Dashboard does not expose a generic editable configuration object. No settings UI action grants OS root or bypasses owner auth (`src/operator/config-descriptors.ts:18-24`; `src/operator/rate-limit-settings.ts:64-70`).

## Configuration lifecycle and safe verification
- Use `folderforge --project <dir> --stdio` or `folderforge control start --project <dir> --auth token --no-open`; do not assume running services pick up a changed config automatically (`src/main.ts:98-155`; `src/control/cli.ts:1350`; `README.md:23-61`).
- Inspect `GET /operator/config` and `GET /operator/config/quota` with authenticated owner credentials; validate/revise via `POST /operator/config/validate` and `POST /operator/config/apply`, **only** for bounded quota (`src/dashboard/server.ts:2899-2972`).
- Never put a signed Dashboard link in shell history, logs, screenshots, or public docs (`README.md:31-36`).
- For production, verify actual process identity and host access separately; `docs/r14-kernel-registry-fence-migration.md:40-72` is the migration contract, not a run command.
