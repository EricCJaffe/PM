# AGENTS.md — How Claude Operates on BusinessOS PM

> Claude reads this every session alongside CLAUDE.md.
> These rules extend the existing session conventions with team coordination,
> stuck-mode recovery, and automated closeout.

---

## Operating modes

| Mode | Triggered by | Behavior |
|---|---|---|
| Preflight | Session start | Load docs, toolstack check, active work brief |
| Build | Task assigned | Clarify, MVP, build per CLAUDE.md conventions |
| Stuck | Loop detected | Diagnose before fixing, max 3 attempts |
| Closeout | "Close out session" | Dual handoff, update docs, PM update block |

---

## PREFLIGHT MODE

After reading the docs listed in CLAUDE.md On Session Start, also read:
- docs/TEAM.md — who is working on what
- docs/ACTIVE_WORK.md — what is in flight right now
- docs/HANDOFF.md — most recent entry only
- docs/PROMPT_LIBRARY.md — proven patterns for this codebase
- docs/TROUBLESHOOTING.md — known failure modes to avoid

Then output:
```
SESSION BRIEF — [DATE]
Developer: [handle or ask]
Active work by others: [from ACTIVE_WORK.md or "none"]
Last session: [2 sentences from HANDOFF.md]
Open P0/P1 tasks: [from TASKS.md]
Known issues to avoid: [from TROUBLESHOOTING.md if relevant]
Ready. What are we building today?
```

### Toolstack check
Verify before any build work:
- [ ] .env.local exists
- [ ] .env.local in .gitignore
- [ ] supabase/migrations/ folder exists
- [ ] On the intended branch for this repo (`main` is allowed only when explicitly chosen for this project)

---

## BUILD MODE

Follow all conventions in CLAUDE.md exactly. Additionally:

1. Check docs/PROMPT_LIBRARY.md before writing any code — use proven patterns
2. Define MVP before touching files — state what is NOT being built
3. Never write a migration without RLS policy in the same file
4. Never introduce a new library without flagging it first
5. Check docs/ACTIVE_WORK.md before touching files others are working on

After each working version:
- State what was built in one plain sentence
- Suggest the next logical step
- Ask: "Continue or review first?"

---

## STUCK MODE

Max 3 attempts on any fix. If same wrong output appears 3 times:

```
LOOP DETECTED after [X] attempts.
What I know: [certain facts]
What I do not know: [the unknown causing the loop]
What I need: [specific input to break it]
Recommendation: [reframe the approach]
Proceed or start fresh session?
```

Do not patch. Diagnose first, fix surgically.

---

## CLOSEOUT MODE

Triggered by: "Close out session"

Generate both sections automatically:

### Plain-language summary (whole team)
```
PLAIN-LANGUAGE SUMMARY — [DATE]
What we worked on: [1-3 sentences, no jargon]
What got done: [bullet list]
What is still in progress: [bullet list]
Decisions the team should know: [any direction changes]
Blockers needing input: [specific asks or "None"]
```

### Technical handoff (next dev session)
```
TECHNICAL HANDOFF — [DATE] — [handle]
Session goal: [intent]
Completed: [items with file refs]
Files changed: [path — what and why]
Decisions: [decision — rationale]
In progress: [exact current state]
Blockers: [what resolves them]
Next session startup:
1. [exact first step]
2. [exact second step]
Branch: [name] | Commit: [message] | PR: [status]
Migrations run: [yes/no] | Env vars changed: [yes/no]
Worth saving to PROMPT_LIBRARY? [yes — describe / no]
Worth logging to TROUBLESHOOTING? [yes — describe / no]
```

### PM update block
```
PM UPDATE — [DATE]
Mark COMPLETE: [tasks]
Mark IN PROGRESS: [tasks + status]
Mark BLOCKED: [tasks + blocker]
Create new: [tasks + description]
```

### After generating closeout
- Append to docs/HANDOFF.md
- Append to docs/SESSION-CHANGELOG.md
- Update docs/TASKS.md
- Update docs/ACTIVE_WORK.md
- If prompt pattern emerged: offer to save to docs/PROMPT_LIBRARY.md
- If issue resolved hard: offer to save to docs/TROUBLESHOOTING.md

---

## Never do
- Push directly to main unless this repo/session has explicitly chosen `main` as the working branch
- Write migration without RLS policy in same file
- Attempt same fix more than 3 times
- Omit open items from handoff note
- Use top-level OpenAI instantiation (always use getOpenAI())
- Put secrets in NEXT_PUBLIC_* vars
