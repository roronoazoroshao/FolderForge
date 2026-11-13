# Dashboard and MCP HTTP route inventory

Baseline `main@8c00b15` (2026-11-10). **Static extraction** from `src/dashboard/server.ts:936-3024`, not a generated OpenAPI definition. Inputs and output JSON schemas are not centralized; inspect the cited handler (normally the next 20–70 lines) before calling. Methods and exact patterns in the source win over this extract. For remote MCP, see `src/server/transports/http.ts:595-715` and `src/openai/responses-http.ts:97-134`.

**Authorization:** Dashboard owner/auth checks are middleware- and route-dependent; never infer that GET is public or that a POST is safe. Privileged Fleet owner endpoints require verified bearer/loopback origin or SSH proof (`src/dashboard/server.ts:950-1028`). Policy/approvals apply to governed tool invocation (`src/tools/registry.ts:529-600`). For exact request bodies, response codes and identity constraints inspect source. This catalog does not grant an endpoint any permission.

## Explicit path comparisons

| Method | Path | Side effect class | Input / output | Evidence |
|---|---|---|---|---|
| GET | `/fleet/owner-capability` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:950` |
| GET | `/app` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1240` |
| GET | `/app/` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1248` |
| POST | `/fs/browse` | read-only directory listing via POST; bounded by allowed roots | JSON `path?` -> `{path,parent,root,directories,canGoUp}`; control auth as configured | `src/dashboard/server.ts:1254-1297` |
| POST | `/fs/mkdir` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1300` |
| GET | `/` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1339` |
| GET | `/status` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1346` |
| GET | `/responses/status` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1375` |
| POST | `/responses/config` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1413` |
| GET | `/mission-control` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1449` |
| GET | `/agent-loops` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1460` |
| POST | `/agent-loops` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1469` |
| POST | `/mission-control/write-freeze` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1701` |
| GET | `/fleet` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1789` |
| POST | `/fleet` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1795` |
| GET | `/plugins` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1921` |
| GET | `/marketplace` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1936` |
| GET | `/tools` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1967` |
| GET | `/workspaces` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:1998` |
| POST | `/workspaces/switch` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2013` |
| POST | `/workspaces/activate` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2033` |
| GET | `/cloudflare/status` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2053` |
| POST | `/cloudflare/config` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2057` |
| DELETE | `/cloudflare/config` | delete or revoke / high risk | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2105` |
| GET | `/openai-tunnel/status` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2114` |
| POST | `/openai-tunnel/config` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2139` |
| DELETE | `/openai-tunnel/config` | delete or revoke / high risk | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2192` |
| POST | `/openai-tunnel/verify` | external credential verification; no config persistence in this branch | Body -> validation result; authenticated operator required | `src/dashboard/server.ts:2209` |
| POST | `/openai-tunnel/start` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2257` |
| POST | `/openai-tunnel/stop` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2349` |
| GET | `/tunnels` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2368` |
| POST | `/tunnels` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2383` |
| GET | `/chatgpt/status` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2449` |
| GET | `/chatgpt/logs` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2453` |
| GET | `/audit` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2491` |
| GET | `/processes` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2500` |
| GET | `/isolations` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2504` |
| POST | `/isolations` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2511` |
| GET | `/approvals` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2766` |
| GET | `/capsules` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2773` |
| POST | `/capsules` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2780` |
| GET | `/operator/config/quota` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2899` |
| POST | `/operator/config/apply` | owner-only validated quota operation; `validate` is read-only; `apply` writes | JSON `{scope,key,value,expectedRevision}` -> validation or updated quota; signed owner and same-Origin | `src/dashboard/server.ts:2904-2965` |
| POST | `/operator/config/validate` | owner-only validated quota operation; `validate` is read-only; `apply` writes | JSON `{scope,key,value,expectedRevision}` -> validation or updated quota; signed owner and same-Origin | `src/dashboard/server.ts:2904-2965` |
| GET | `/operator/config` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2967` |
| GET | `/runtime/settings` | read / static | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2975` |
| POST | `/runtime/settings` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:2979` |
| POST | `/policy/mode` | mutation / owner or policy gate | Path/query + JSON body if POST; response JSON or SPA per handler | `src/dashboard/server.ts:3024` |

## Parameterized match routes

These match variable path segments. The method, request-schema and response are conditional on the specific handler branch; inspect the same file at the indicated position.

| Match variable | Regex path expression (source notation) | Body/response/permissions | Evidence |
|---|---|---|---|
| `profileRoute` | `\/fleet\/(flt_[0-9a-f]{8})\/profile-intents(?:\/(req_[A-Za-z0-9_-]{3,72})(?:\/(apply))?)?` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:963` |
| `authorityRoute` | `\/fleet\/(flt_[0-9a-f]{8})\/execution-authority` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:964` |
| `oneClickRoute` | `\/fleet\/(flt_[0-9a-f]{8})\/one-click-trusted-host` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:965` |
| `quickStartRoute` | `/fleet/quickstart` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:968` |
| `missionTaskMatch` | `\/mission-control\/tasks\/([^/]+)\/(pause\|cancel)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1724` |
| `missionProcessMatch` | `\/mission-control\/processes\/([^/]+)\/(stop\|kill)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1745` |
| `missionCapsuleMatch` | `\/mission-control\/capsules\/([^/]+)\/revoke` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1760` |
| `missionIsolationMatch` | `\/mission-control\/isolations\/([^/]+)\/(rollback\|discard)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1774` |
| `fleetAutoRestartMatch` | `\/fleet\/([^/]+)\/auto-restart` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1871` |
| `fleetPresetMatch` | `\/fleet\/([^/]+)\/preset` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:1894` |
| `tunnelStopMatch` | `\/tunnels\/([^/]+)\/stop` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2415` |
| `chatGptActionMatch` | `\/chatgpt\/actions\/([^/]+)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2478` |
| `isolationActionMatch` | `\/isolations\/([^/]+)\/(apply\|rollback\|discard)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2539` |
| `fleetPolicyMatch` | `\/fleet\/([^/]+)\/policy` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2556` |
| `fleetTerminalMatch` | `\/fleet\/([^/]+)\/terminal` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2573` |
| `fleetAuthMatch` | `\/fleet\/([^/]+)\/auth` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2587` |
| `fleetOpenAiTunnelMatch` | `\/fleet\/([^/]+)\/openai-tunnel\/(start\|stop)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2629` |
| `fleetOpenAiTunnelLogsMatch` | `\/fleet\/([^/]+)\/openai-tunnel\/logs` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2659` |
| `fleetTunnelMatch` | `\/fleet\/([^/]+)\/tunnel` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2677` |
| `fleetLogsMatch` | `\/fleet\/([^/]+)\/logs` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2735` |
| `capsuleMatch` | `\/capsules\/([^/]+)\/revoke` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2849` |
| `approvalMatch` | `\/approvals\/([^/]+)\/(approve\|deny)` | Handler method guards, JSON body/result and owner/policy checks apply | `src/dashboard/server.ts:2863` |

## Transport and provider endpoints

| Endpoint | Method and behavior | Evidence |
|---|---|---|
| `/healthz` | HTTP GET health check; service-specific | `src/server/transports/http.ts:613-619` |
| `/mcp` (configured MCP path) | GET/POST/DELETE depending protocol/session; authenticated governed MCP | `src/server/transports/http.ts:595-715` |
| OAuth protected-resource metadata | GET protected-resource discovery; configured paths | `src/server/transports/http.ts:636-650` |
| `/v1/models` | GET Responses-compatible model discovery | `src/openai/responses-http.ts:106-109` |
| `/v1/responses` | POST Responses-compatible execution | `src/openai/responses-http.ts:134` |
| `/v1/responses/{id}` | GET status; cancellation route in same handler | `src/openai/responses-http.ts:111-133` |

**Counts:** 48 explicit route comparisons, 22 parameterized route declarations from static extraction; dynamic proxy paths and extension routes may not all be captured. **[UNVERIFIED]** completeness as an OpenAPI contract. Needed feature: generate typed route schemas directly from source and test them.
