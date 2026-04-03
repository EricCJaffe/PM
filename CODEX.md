# CODEX.md — Codex Startup Guide for BusinessOS PM

This file is the Codex-specific startup contract for this repo.
It sits on top of `CLAUDE.md` and `AGENTS.md` and tells Codex what "ready to work" means here.

## Why this exists
- This repo already has strong Claude-oriented operating docs.
- Codex should follow the same repo workflow, but with one clear startup checklist and one clear session brief.
- The goal is fast startup with minimal drift between Claude docs and Codex behavior.

## Branch policy for this repo
- Default Git safety still applies: inspect status before pulling or editing.
- For this project, the user has explicitly chosen to work directly on `main`.
- Treat `main` as the normal working branch unless the user asks for a separate branch.
- If `main` is dirty, do not pull blindly. Report the state first.

## Default startup trigger
If the user says any of the following, run the full startup routine:
- "Get up to speed"
- "Startup"
- "Pull latest and get up to speed"
- "Read in and get ready"
- "Sync the project"

## Startup routine
1. Check repo state first:
   - `git status --short --branch`
   - `git branch --show-current`
   - `git remote -v`
2. Sync Git if safe:
   - If the worktree is clean, run `git fetch --prune origin` and `git pull --ff-only origin main`
   - If the worktree is dirty, do not pull until the user confirms how to handle local changes
3. Read these docs every startup, in this order:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `docs/CONTEXT.md`
   - `docs/ENVIRONMENT.md`
   - `docs/TASKS.md`
   - `docs/RUNBOOK.md`
   - `docs/TEAM.md`
   - `docs/ACTIVE_WORK.md`
   - `docs/HANDOFF.md` — newest meaningful entry only
   - `docs/PROMPT_LIBRARY.md`
   - `docs/TROUBLESHOOTING.md`
   - `docs/PRODUCT_ROADMAP.md`
4. Read additional docs only when relevant:
   - Supabase or migrations: `docs/SUPABASE.md` and `supabase/migrations/`
   - Integrations or vendor APIs: `docs/INTEGRATIONS.md`
   - Deployment or Vercel: `docs/DEPLOYMENT.md`
   - Security or auth/RLS: `docs/SECURITY.md`
   - Architecture decisions: relevant ADRs in `docs/DECISIONS/`
5. Verify local prerequisites without printing secrets:
   - `.env.local` exists
   - `.env.local` is ignored by Git
   - `supabase/migrations/` exists
   - `.vercel/project.json` exists when deployment work is involved
6. Produce a short session brief before implementation.

## Session brief format
Use the repo’s preflight structure and include:
- Current branch
- Whether Git was fetched and pulled successfully
- Whether the worktree is clean or dirty
- Active work by others from `docs/ACTIVE_WORK.md`
- A two-sentence summary of the latest handoff
- Open P0/P1 or equivalent current priorities from `docs/TASKS.md`
- Relevant known issues from `docs/TROUBLESHOOTING.md`
- Any missing setup, stale docs, or repo risks worth noting up front

## What Codex should treat as repo truth
- `CLAUDE.md` defines core repo conventions, architecture, and maintenance rules.
- `AGENTS.md` defines preflight, build, stuck-mode, and closeout expectations.
- `docs/ACTIVE_WORK.md` is the coordination source before touching shared files.
- `docs/HANDOFF.md` is the latest session context.
- `docs/TASKS.md` is the work ledger.
- `docs/PRODUCT_ROADMAP.md` is the filter for whether new work belongs in the product now.

## Project-specific rules to remember
- This repo shares Supabase auth with FSA. Treat any `auth.*` migration as cross-project risk.
- Never create or run a migration without checking the latest numbered migration first.
- Never write a migration without RLS policy work in the same file.
- Keep docs updated in the same change when architecture, integrations, env vars, workflow, or operational behavior change.
- Never expose server-only keys in client code or `NEXT_PUBLIC_*` vars.
- Use `getOpenAI()` from `src/lib/openai.ts`; do not instantiate OpenAI at module scope.
- Prefer remote Supabase workflows here; local Docker Supabase is not required for normal repo work.

## Practical command map
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Seed templates: `npm run seed`
- TypeScript script: `npx tsx scripts/<name>.ts`

## Ready-to-work definition
Codex is ready to build when it has:
- confirmed Git state
- synced `main` safely or explained why it did not
- read the required startup docs
- checked local prerequisites
- summarized the current project state in a session brief

After that, implementation can start immediately.
