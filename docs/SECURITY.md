# Security Baseline

## Secrets Handling

### Required Rules
- **Never** put secrets in `NEXT_PUBLIC_*` env vars — they are bundled into client JS.
- **Never** commit `.env.local` — it is gitignored.
- All server-only secrets live in `.env.local` (dev) or Vercel environment variables (prod).
- Copy `.env.local.example` when onboarding; never share real keys over chat or email.

### Server-only secrets
| Variable | Risk if leaked |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — full DB read/write |
| `OPENAI_API_KEY` | Unlimited AI spend |
| `RESEND_API_KEY` | Send email as the platform |
| `GITHUB_TOKEN` | Push to vault repo |
| `DOCUSEAL_API_KEY` | Create/cancel document submissions |
| `DOCUSEAL_WEBHOOK_SECRET` | Forge webhook events |
| `CRON_SECRET` | Trigger any cron route externally |

### Rotation Protocol
1. Generate a new key from the provider dashboard.
2. Update the secret in Vercel (or `.env.local` locally).
3. Redeploy.
4. Revoke the old key in the provider dashboard.
5. Update `docs/ENVIRONMENT.md` if the variable name changed.

---

## Dependency Scanning

### Local Dev
```bash
npm audit                   # scan for known CVEs
npm audit --fix             # auto-fix safe patches
npm audit --audit-level=high  # CI exit-code on high/critical only
```

### CI/CD (Vercel auto-deploy)
- Vercel surfaces npm audit warnings in build logs.
- Run `npm audit --audit-level=high` in a pre-deploy GitHub Action to block on high/critical.

### Cadence
- **Weekly**: run `npm audit` locally and address high/critical immediately.
- **Monthly**: update minor versions (`npm update`), verify build passes.
- **On new dependency**: audit before merging the PR.

### Current Known Issues (last checked 2026-04-04)
| Package | Severity | CVE | Status |
|---|---|---|---|
| `next` | moderate | (pending CVE detail) | Monitor — update to latest patch when available |

---

## Auth & Session Hardening Checklist

### Supabase Auth (SSR pattern)
- [x] `@supabase/ssr` used for server/client session management.
- [x] Middleware calls `supabase.auth.getUser()` on every non-public request.
- [x] Cookie refresh handled in middleware via `setAll` callback.
- [x] Auth callback URL whitelisted in Supabase Dashboard.
- [ ] **TODO**: Ensure `NEXT_PUBLIC_SUPABASE_URL` does not point to an unintended project in any environment.

### Route Protection
- [x] All routes under `/dashboard/**` require authenticated session.
- [x] Admin routes (`/admin/**`, `/api/pm/admin/**`) verify `system_role = 'admin'`.
- [x] External API (`/api/pm/ext/**`) uses API key auth, validated per-request.
- [x] `/api/pm/api-keys` GET/POST/DELETE now requires `system_role = 'admin'` (SEC-001 resolved 2026-04-04).
- [x] `/api/pm/chat` now enforces auth + org membership check (SEC-002 resolved 2026-04-04).

### API Key System
- [x] Keys are hashed (SHA-256) before storage — raw key shown once only.
- [x] Keys use `pm_key_` prefix and cryptographically random 32-byte hex.
- [x] `is_active` flag used for revocation; expiry via `expires_at`.
- [x] `last_used_at` updated on each use.
- [x] Org-scope restriction supported (`org_scope` array).
- [x] Admin guard added to GET/POST/DELETE (SEC-001 resolved 2026-04-04).

### Webhook Security
- [x] DocuSeal webhook validates `X-Docuseal-Secret` header via `validateWebhookSecret()`.
- [x] `/api/pm/site-audit/process` validates `x-internal-secret: CRON_SECRET` header (SEC-003 resolved 2026-04-04).

### Session Hardening
- [x] Supabase tokens are HTTP-only cookies via `@supabase/ssr`.
- [x] Microsoft (Azure AD) SSO configured through Supabase provider.
- [ ] **RECOMMENDED**: Enable Supabase MFA for admin accounts.
- [ ] **RECOMMENDED**: Set `NEXT_PUBLIC_APP_URL` explicitly in all environments to prevent open-redirect in cron route construction.

---

## Pre-Launch Risk Review Workflow

Use this checklist before deploying to a new client environment or going live with a new feature that touches auth, data, or billing.

### 1. Environment Audit
- [ ] All required env vars are set in Vercel (not missing, not using dev values).
- [ ] `.env.local` is **not** in the git history (`git log --all --full-history -- .env.local`).
- [ ] `NEXT_PUBLIC_*` vars contain no secrets.

### 2. Auth & Access Control
- [ ] Middleware protects all non-public routes.
- [ ] Admin routes enforce `system_role = 'admin'`.
- [ ] RLS policies are enabled on all Supabase tables touched by the new feature.
- [ ] Service role client is used **only** in API routes and server actions (never in components).
- [ ] Any new `/api/pm/ext/` route validates API key and enforces `hasPermission()` + `hasOrgAccess()`.

### 3. Data Exposure
- [ ] No sensitive fields returned to client components (e.g., hashed keys, internal IDs not needed by UI).
- [ ] Public/share routes (`/api/pm/share/**`, `/share/**`) only expose what is necessary for the share token context.
- [ ] Portal routes expose only data scoped to the invited portal user's org.

### 4. Input Validation
- [ ] All route handler inputs are validated before DB write.
- [ ] No user-supplied values are interpolated into raw SQL.
- [ ] Supabase query builder used for all DB operations (parameterized by default).

### 5. Dependency Check
- [ ] `npm audit --audit-level=high` passes with 0 high/critical issues.

### 6. Error Handling
- [ ] Error responses do not leak stack traces or internal DB error messages to the client.
- [ ] `console.error` used for server-side errors (not `console.log` with sensitive data).

### 7. Webhooks & Cron
- [ ] New cron routes check `Authorization: Bearer $CRON_SECRET`.
- [ ] New webhook routes validate a shared secret or HMAC signature.
- [ ] Internal background routes (bypassed by middleware) validate an internal secret.

### 8. AI Features
- [ ] Rate limiting is considered for any new AI chat/generation endpoint.
- [ ] System prompts do not contain secrets or internal configuration.
- [x] User-supplied chat history is treated as untrusted input — role allowlist (`user`/`assistant` only), depth cap (20), per-message content cap (10,000 chars), tool-loop iteration cap (10). See SEC-004.

---

## Open Security Issues (as of 2026-04-04)

| ID | Severity | Description | Status |
|---|---|---|---|
| SEC-001 | High | `/api/pm/api-keys` has no admin role check — any authenticated user can create/list/revoke API keys | **Fixed 2026-04-04** — `requireAdmin()` guard added to GET/POST/DELETE |
| SEC-002 | Medium | `/api/pm/chat` has no project ownership check — any authenticated user can read/mutate any project via AI | **Fixed 2026-04-04** — `getUserSession()` + org membership check added |
| SEC-003 | Medium | `/api/pm/site-audit/process` bypasses middleware auth with no internal secret validation | **Fixed 2026-04-04** — `x-internal-secret: CRON_SECRET` validation added; caller updated |
| SEC-004 | Medium | Chat `history` parameter from client is injected into AI context without sanitization — prompt injection risk | **Partially mitigated 2026-04-04** — role allowlist, depth cap (20 msgs), content cap (10K chars/msg), tool-loop cap (10 iters). Residual: no semantic content inspection; crafted `user`/`assistant` history can still influence model behavior. Full mitigation requires server-side session storage (see SEC-004-residual below). |
| SEC-005 | Low | No rate limiting on AI endpoints (chat, reports, standup, audit) — OpenAI cost exposure | **Partially mitigated 2026-04-04** — concurrent site-audit gate (1 running audit per org/prospect). Residual: no per-user token-rate limit on chat, reports, or standup. Full mitigation requires board decision on thresholds + infrastructure (Upstash Redis). Follow-up: FSA-32. |
| SEC-006 | Low | `next` package has a moderate npm audit finding | Monitor |

---

## AI Threat Model — Chat Endpoint (SEC-004)

### Attack surface
`POST /api/pm/chat` accepts a `history` array from the client containing prior conversation turns. The route assembles this into the OpenAI messages array alongside a system prompt and a project context block. The AI has **write access** (add/delete tasks, phases, risks; update project status), so successful prompt injection can trigger destructive mutations.

### Attack vectors mitigated (2026-04-04)
| Vector | Mitigation |
|---|---|
| Role injection (`role: "system"` in history) | Role allowlist: only `"user"` and `"assistant"` accepted |
| Tool/function role forgery (fake tool results) | Same allowlist — `"tool"` and `"function"` rejected |
| Context flooding (huge history arrays) | Depth cap: last 20 messages kept |
| Per-message injection payload | Content cap: 10,000 chars per message |
| Unbounded agentic tool loop | Iteration cap: 10 tool-call rounds max |

### Residual risk (SEC-004-residual)
Crafted `user`/`assistant` pairs within the 20-message/10K-char budget can still manipulate model behavior. Example: a client sends fake assistant confirmations of prior "delete phase" calls to prime the model into accepting a subsequent request. **Full elimination requires server-side history storage** — the server holds conversation state; the client sends only a session/conversation ID. This is a product-level change requiring board decision (new DB schema, session lifecycle, UI changes). Severity: **Low** while auth + org scoping is enforced (attacker can only affect their own authorized projects).

### Rate limiting plan (SEC-005)

#### Endpoints with OpenAI exposure (highest to lowest cost)
| Endpoint | Model | Max tokens | Auth | Rate limit status |
|---|---|---|---|---|
| `/api/pm/site-audit/process` | gpt-4o | 16,384 | CRON_SECRET | Concurrent gate (1/org) — 2026-04-04 |
| `/api/pm/web-passes/[id]/generate` | gpt-4o | varies | Auth required | None |
| `/api/pm/chat` | gpt-4o | 2,048 × N tool loops | Auth + org check | Loop capped at 10 — 2026-04-04 |
| `/api/pm/reports/*` (rollup, blockers, hub, decisions) | gpt-4o | varies | Auth required | None |
| `/api/pm/reports/standup` | gpt-4o | varies | Auth required | None |
| `/api/pm/notes/summarize` | gpt-4o | varies | Auth required | None |
| `/api/pm/web-passes/[id]/score` | gpt-4o | varies | Auth required | None |

#### Full rate limit implementation (requires board decision — FSA-32)
- **Infrastructure**: Upstash Redis (Vercel Marketplace) for distributed, serverless-safe rate limiting
- **Proposed limits** (subject to board approval):
  - Chat: 20 requests/user/minute, 200/user/day
  - Reports (rollup, blockers, hub, decisions): 10/org/hour
  - Site audit: 5/org/day (in addition to concurrent gate)
  - Standup: 5/org/day
  - Web pass generate/score: 10/project/day
- **Alternative (no new infra)**: Supabase-based counter table — higher latency, but no new dependency

---

## Reference

- Env vars: `docs/ENVIRONMENT.md`
- Supabase schema: `docs/SUPABASE.md`
- Auth integrations: `docs/INTEGRATIONS.md`
- API routes: `docs/API.md`
