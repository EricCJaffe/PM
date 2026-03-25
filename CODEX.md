# CODEX.md — Codex Startup Guide for BusinessOS PM

This file is the project-specific startup contract for Codex.
It complements `CLAUDE.md` and `AGENTS.md` rather than replacing them.

## Why this exists
- Codex already has strong built-in rules for editing, verification, and collaboration.
- This file should stay focused on repo context, startup flow, and what "get up to speed" means in this codebase.
- Reuse the existing docs-first operating model instead of inventing a separate one.

## Default startup trigger
If the user says any of the following, run this startup routine:
- "Get up to speed"
- "Startup"
- "Pull latest and get up to speed"
- "Read in and get ready"

## Startup routine
1. Confirm repo state before changing anything:
   - `git status --short`
   - `git branch --show-current`
   - `git remote -v`
2. Sync the branch if safe:
   - If the worktree is clean, run `git pull --ff-only origin <current-branch>`
   - If the worktree is dirty, do not pull blindly; report the state and ask whether to stash, commit, or leave it alone
3. Read the core docs every startup:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `docs/CONTEXT.md`
   - `docs/ENVIRONMENT.md`
   - `docs/TASKS.md`
   - `docs/RUNBOOK.md`
   - `docs/TEAM.md`
   - `docs/ACTIVE_WORK.md`
   - `docs/HANDOFF.md` — newest entry only
   - `docs/TROUBLESHOOTING.md`
4. Read additional docs only if relevant to the task:
   - Supabase or migrations: `docs/SUPABASE.md` and `supabase/migrations/`
   - Integrations or vendors: `docs/INTEGRATIONS.md`
   - Product direction: `docs/PRODUCT_ROADMAP.md`
   - Prompting or agent behavior: `docs/PROMPT_LIBRARY.md`
   - Architecture work: `docs/DECISIONS/`
5. Verify local working prerequisites without exposing secrets:
   - `.env.local` exists
   - `supabase/` exists
   - `.vercel/project.json` exists when deployment work is involved
6. Produce a short session brief before coding.

## Session brief format
When startup completes, summarize:
- Current branch
- Whether git was pulled successfully
- Whether the worktree is clean or dirty
- Active or claimed work from `docs/ACTIVE_WORK.md`
- Latest meaningful handoff from `docs/HANDOFF.md`
- Open migration or P0/P1 items from `docs/TASKS.md`
- Risks relevant to the requested work from `docs/TROUBLESHOOTING.md`
- Any missing setup required before coding

## Project-specific rules to remember
- This repo shares Supabase auth with FSA. Treat `auth.*` migration changes as cross-project changes.
- Do not create or run a migration without checking the latest numbered file first.
- Keep docs updated in the same change when architecture, integrations, env vars, or operational behavior change.
- Never expose server-only keys in client code or `NEXT_PUBLIC_*` variables.
- Prefer remote Supabase workflows here; Docker-backed local Supabase is not required for normal work on this repo.

## Practical command map
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Seed templates: `npm run seed`
- TypeScript script: `npx tsx scripts/<name>.ts`

## "Ready to work" means
Codex has:
- pulled the latest safe git state or explained why it did not
- read the current project context docs
- checked local repo prerequisites
- summarized what matters now

At that point, the session can move directly into implementation.
