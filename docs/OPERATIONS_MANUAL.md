# OPERATIONS_MANUAL.md
## How We Work Day-to-Day
### The complete guide for every team member

---

## The six phrases that run everything

| Say this | When | What Claude does |
|---|---|---|
| `Pull latest and get up to speed` | Start of any session | Reads all docs, briefs you on status |
| `Save progress` | Mid-session checkpoint | Commits changes, updates tasks |
| `Close out session` | End of any session | Writes handoff, updates all docs, gives git commands |
| `Save this to the prompt library` | After something works great | Saves the pattern for the whole team |
| `Log this to troubleshooting` | After solving a hard problem | Documents it so no one hits it again |
| `We are stuck on [problem]` | When looping or lost | Stops the loop, diagnoses, reframes |

---

## Scenario 1 — Starting a new day on an existing project

```bash
# 1. Go to the project folder
cd ~/[project-folder]

# 2. Run preflight (optional but recommended)
./scripts/preflight.sh

# 3. Create your branch for today's work
git checkout dev
git pull origin dev
git checkout -b feat/[your-handle]-[what-youre-building]

# 4. Open Claude Code and say:
Pull latest and get up to speed
```

Claude will tell you what was done last session, what's open, and ask what you're building today. Start there.

---

## Scenario 2 — During the day

**Save a checkpoint without closing:**
```
Save progress
```

**Hit a wall:**
```
We are stuck on [describe the problem in one sentence]
```

**Something worked really well:**
```
Save this to the prompt library
```

**Solved something hard:**
```
Log this to troubleshooting
```

---

## Scenario 3 — Ending your day

In Claude Code, say:
```
Close out session
```

Claude generates everything. You then run the commands it gives you:

```bash
git add .
git commit -m "[the message Claude provides]"
git push origin [your branch]
./scripts/build-context.sh
```

Then upload the new `SHARED_CONTEXT.md` to your Claude.ai Project.
Update the PM tool from the update block Claude outputs.

---

## Scenario 4 — Starting a brand new client project

```bash
# 1. Go to github.com/EricCJaffe/ProjectTemplate
# 2. Click "Use this template" → "Create a new repository"
# 3. Name it [client-name] — set to Private
# 4. Clone it locally:
git clone https://github.com/EricCJaffe/[client-name].git
cd [client-name]

# 5. Set up git credentials if needed:
git remote set-url origin https://EricCJaffe@github.com/EricCJaffe/[client-name].git

# 6. Create dev branch:
git checkout -b dev
git push origin dev

# 7. Run preflight:
./scripts/preflight.sh

# 8. Fill in the two most important files BEFORE touching any code:
#    - .claude/PROJECT_INIT.md  (answer every question)
#    - docs/CLIENT_CONTEXT.md   (from your discovery call notes)

# 9. Open Claude Code and say:
Pull latest and get up to speed
```

Claude will read your PROJECT_INIT.md and CLIENT_CONTEXT.md and ask what you're building first.

---

## Scenario 5 — Adopting an existing project (taking over someone else's codebase)

```bash
# 1. Clone the existing repo:
git clone https://github.com/EricCJaffe/[existing-repo].git
cd [existing-repo]

# 2. Download and run the augmentation script:
python3 ~/Downloads/augment_pm.py
# (or use build_template.py for a fresh project)

# 3. Set EXISTING_CODEBASE: true in .claude/PROJECT_INIT.md

# 4. Run preflight:
./scripts/preflight.sh

# 5. Open Claude Code and say:
Pull latest and get up to speed — this is an existing codebase I am adopting.
Walk me through what exists before we build anything new.
```

Claude will audit the existing code, document what it finds, and populate the missing context files before any new work begins.

---

## Scenario 6 — Picking up someone else's work mid-project

```bash
cd ~/[project-folder]
git checkout dev
git pull origin dev
./scripts/preflight.sh
```

Then in Claude Code:
```
Pull latest and get up to speed
```

Read the plain-language summary in `docs/HANDOFF.md` — that tells you what was done last session and exactly where to pick up.

---

## Scenario 7 — Running a site audit on a potential client

In your PM tool (or directly in Claude):
```
Run a site audit on [URL]
```

Claude will:
1. Fetch and analyze the site
2. Score it against our Church OS / Agency OS standards
3. Generate a gap analysis report
4. Build a site mock-up showing the rebuilt version
5. Package it as a proposal PDF

Full workflow lives in `docs/seo/DISCOVERY.md`.
This feature is being built into the PM tool UI — see TASKS.md for status.

---

## Daily rhythm summary

```
Morning:
  cd [project] → git pull → git checkout -b feat/[handle]-[feature]
  ./scripts/preflight.sh
  "Pull latest and get up to speed"

During:
  "Save progress" (every 1-2 hours)
  "Save this to the prompt library" (when something works great)
  "We are stuck on X" (when looping)

End of day:
  "Close out session"
  Run the git commands Claude gives you
  ./scripts/build-context.sh
  Upload SHARED_CONTEXT.md to Claude.ai Project
  Copy PM update block into PM tool
```

---

## The one rule that makes everything work

**Every session: close out properly.**

Say "Close out session" before you stop. Takes 2 minutes. Without it the system degrades — context gets lost, the prompt library stays empty, the next session starts cold.

The system compounds when you close out every time. It erodes without it.

---

## Quick reference card
*(Print this and keep it at your desk)*

```
NEW PROJECT:     github.com/EricCJaffe/ProjectTemplate → Use this template
SESSION START:   ./scripts/preflight.sh → "Pull latest and get up to speed"
CHECKPOINT:      "Save progress"
STUCK:           "We are stuck on [problem]"
GOOD PATTERN:    "Save this to the prompt library"
HARD SOLVE:      "Log this to troubleshooting"
SESSION END:     "Close out session" → run git commands → build-context.sh
SITE AUDIT:      "Run a site audit on [URL]" (PM tool — see TASKS.md)
```
