# TROUBLESHOOTING.md — Known Failure Modes

> BusinessOS PM specific. Claude reads this every session to avoid known problems.
> Add entries by saying "Log this to troubleshooting."

---

## Shared Supabase instance issues
**Risk:** Migrations that touch auth.* affect FSA project.
**Rule:** Never run auth-touching migrations without checking FSA repo first.
**Check:** grep -r "auth\." supabase/migrations/[new-file].sql before running.

---

## OpenAI top-level instantiation
**Symptom:** Build fails with "OpenAI API key not set" even when key exists.
**Cause:** OpenAI client instantiated at module load instead of inside function.
**Fix:** Always use getOpenAI() from src/lib/openai.ts — never top-level new OpenAI().

---

## Migration numbering conflicts
**Symptom:** Two migrations with same number, Supabase refuses to apply.
**Prevention:** Always check ls supabase/migrations/ before creating a new migration.
**Current highest:** 051 — next new migration should be 052.

## Existing duplicate migration number in repo
**Symptom:** `supabase/migrations/` currently contains both `047_audit_workflows.sql` and `047_web_passes.sql`.
**Risk:** Any migration workflow that assumes one file per sequence number can behave unpredictably.
**Prevention:** Check the directory, not just docs, before choosing the next migration number.

---

## RLS blocking service role
**Symptom:** Queries from server-side API routes return empty or 403.
**Cause:** Using anon client instead of service role client in API route.
**Fix:** Use createClient() from src/lib/supabase/server.ts in route handlers.
Always use service role for server-side mutations.

---

## Vault sync out of sync with DB
**Symptom:** DB has data but vault files are stale or missing.
**Cause:** Write to DB succeeded but vault write failed silently.
**Fix:** Check vault_errors in project seed response. Re-run vault sync manually.
vault.ts generateVaultFile() can be called independently.

---

## Claude in a loop on migrations
**Symptom:** Claude keeps generating same migration with same error.
**Recovery:** Stop. Start new session. Open with:
"Migration [name] failed with [error]. Do NOT use [approach that failed].
Write a new migration [015_name.sql] that fixes [specific issue] only."

---

## Entry template
```
### [Issue title]
**Added:** [YYYY-MM-DD] by [handle]
**Symptom:** [how you knew something was wrong]
**Root cause:** [what was actually causing it]
**What did not work:** [failed attempts]
**What resolved it:** [exact fix or prompt]
**Prevention:** [how to avoid next time]
```
