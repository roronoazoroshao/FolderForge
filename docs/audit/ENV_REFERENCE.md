# Environment-variable source reference (static inventory)

Baseline `main@8c00b15` (2026-11-10). Enumerates `process.env.NAME` and bracketed `process.env["NAME"]` references in **tracked source/scripts**, excluding tests and the SPA source. Presence in this catalog is not evidence that an end user should set the variable: some are internal process flags, CI-only or provider-specific. Runtime descriptions and safe defaults in [CONFIGURATION.md](../CONFIGURATION.md). Dynamic env lookups and subprocess-injected vars may be missed: **[UNVERIFIED]** exhaustive runtime environment.

| Name | Representative evidence | Context |
|---|---|---|
| `BENCHMARK_ALLOWED` | `benchmarks/fixtures/sandbox-plugin/server.mjs:36` | process / dev / CI (verify before use) |
| `CONTENT_DIR` | `examples/content-mcp/src/index.ts:33` | process / dev / CI (verify before use) |
| `DISPLAY` | `src/control/cli.ts:1374`, `src/operator/local-owner-launcher.ts:24` | process / dev / CI (verify before use) |
| `FOLDERFORGE_ALLOW_UNAUTHENTICATED_TUNNEL` | `src/main.ts:590`, `src/server/transports/http.ts:256` | main runtime / auth |
| `FOLDERFORGE_APPROVALS_PATH` | `src/policy/policy-engine.ts:51` | main runtime / auth |
| `FOLDERFORGE_AUDIT_CONCURRENCY_EVIDENCE` | `scripts/test-audit-concurrency.mjs:159` | main runtime / auth |
| `FOLDERFORGE_AUDIT_DURABILITY` | `src/runtime/config.ts:47` | main runtime / auth |
| `FOLDERFORGE_AUDIT_REQUIRE_AUTHENTICATED_HTTP` | `src/runtime/config.ts:54` | main runtime / auth |
| `FOLDERFORGE_AUDIT_REQUIRE_HIGH_RISK` | `src/runtime/config.ts:51` | main runtime / auth |
| `FOLDERFORGE_AUTH0_CLI_JS` | `src/chatgpt/auth0-management.ts:108`, `src/chatgpt/cli.ts:686` | main runtime / auth |
| `FOLDERFORGE_BENCHMARK_UNDECLARED_SECRET` | `benchmarks/fixtures/sandbox-plugin/server.mjs:35` | main runtime / auth |
| `FOLDERFORGE_CONFIG` | `src/runtime/config.ts:318` | main runtime / auth |
| `FOLDERFORGE_HTTP_API_KEYS` | `src/runtime/config.ts:74` | main runtime / auth |
| `FOLDERFORGE_HTTP_AUTH` | `src/runtime/config.ts:60` | main runtime / auth |
| `FOLDERFORGE_HTTP_GATEWAY_HEADER` | `src/main.ts:538`, `src/main.ts:541` | main runtime / auth |
| `FOLDERFORGE_HTTP_GATEWAY_TOKEN` | `src/main.ts:536`, `src/main.ts:540` | main runtime / auth |
| `FOLDERFORGE_HTTP_TOKEN` | `src/runtime/config.ts:70`, `src/runtime/config.ts:71`, `src/runtime/config.ts:72` | main runtime / auth |
| `FOLDERFORGE_LOG_LEVEL` | `src/core/logger.ts:8` | main runtime / auth |
| `FOLDERFORGE_OAUTH_ALGORITHMS` | `src/runtime/config.ts:102`, `src/runtime/config.ts:103` | main runtime / auth |
| `FOLDERFORGE_OAUTH_ALLOW_INSECURE_HTTP` | `src/runtime/config.ts:105`, `src/runtime/config.ts:106` | main runtime / auth |
| `FOLDERFORGE_OAUTH_CLIENT_REGISTRATION` | `src/runtime/config.ts:93`, `src/runtime/config.ts:94` | main runtime / auth |
| `FOLDERFORGE_OAUTH_ISSUER` | `src/runtime/config.ts:63` | main runtime / auth |
| `FOLDERFORGE_OAUTH_JWKS_URI` | `src/runtime/config.ts:96`, `src/runtime/config.ts:97` | main runtime / auth |
| `FOLDERFORGE_OAUTH_METADATA_URL` | `src/runtime/config.ts:62` | main runtime / auth |
| `FOLDERFORGE_OAUTH_READ_SCOPE` | `src/runtime/config.ts:87`, `src/runtime/config.ts:88` | main runtime / auth |
| `FOLDERFORGE_OAUTH_RESOURCE` | `src/runtime/config.ts:61` | main runtime / auth |
| `FOLDERFORGE_OAUTH_SCOPES` | `src/runtime/config.ts:64` | main runtime / auth |
| `FOLDERFORGE_OAUTH_TRUSTED_JWKS_HOSTS` | `src/runtime/config.ts:99`, `src/runtime/config.ts:100` | main runtime / auth |
| `FOLDERFORGE_OAUTH_WRITE_SCOPE` | `src/runtime/config.ts:90`, `src/runtime/config.ts:91` | main runtime / auth |
| `FOLDERFORGE_REQUIRE_SSH_E2E` | `scripts/verify-ssh-operator-feasibility.mjs:10` | main runtime / auth |
| `FOLDERFORGE_RESPONSES_WORKFLOW_ID` | `src/main.ts:681` | main runtime / auth |
| `FOLDERFORGE_SANDBOX_IMAGE` | `scripts/smoke-sandbox.mjs:14` | main runtime / auth |
| `FOLDERFORGE_SANDBOX_RUNTIME` | `scripts/smoke-sandbox.mjs:9` | main runtime / auth |
| `FOLDERFORGE_STRESS_RUNS` | `scripts/stress-child-mcp.mjs:7` | main runtime / auth |
| `NODE_ENV` | `src/chatgpt/auth0-management.ts:107`, `src/chatgpt/cli.ts:685` | process / dev / CI (verify before use) |
| `NPM_CONFIG_CACHE` | `scripts/publish-release.mjs:9`, `scripts/run-release-check.mjs:9` | process / dev / CI (verify before use) |
| `PATH` | `src/plugins/plugin-manager.ts:485` | process / dev / CI (verify before use) |
| `WAYLAND_DISPLAY` | `src/control/cli.ts:1374`, `src/operator/local-owner-launcher.ts:24` | process / dev / CI (verify before use) |

**Security:** Environment variables may carry secrets. Never paste actual values, tokens, API keys or signed owner links into bug reports. Source `src/runtime/config.ts:70-73` consumes the HTTP token and deletes it from the process environment after loading.
