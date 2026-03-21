# AUTOMATION_MAP.md — Process Automation Map

> Map every process before building it.
> Claude reads this file to understand what's being automated and why.
> This is your core deliverable thinking made explicit.
>
> Rule: If it's not mapped here, don't build it yet.

---

## Why this file exists

Your team's edge is seeing automation opportunities others miss.
This file captures that thinking in a format Claude can act on directly.

A mapped process becomes a buildable spec.
An unmapped process becomes scope creep.

---

## Process map template

```markdown
## [Process Name]

**Status:** Mapped / In Build / Built / In Review / Live / Deprecated
**Priority:** P0 / P1 / P2 / P3
**Owner:** [team handle]
**Added:** [YYYY-MM-DD]

### The problem (before state)
[Describe how this process works today — manually, painfully, inconsistently.
Be specific. Name the steps. Identify where time is wasted or errors happen.
Use the client's language from CLIENT_CONTEXT.md.]

**Pain points:**
- [specific pain point]
- [specific pain point]
- [time cost, error rate, or frustration if known]

### The solution (after state)
[Describe how this process will work after automation.
What does the human do? What does the system do?
What no longer needs to happen at all?]

**Outcomes:**
- [time saved, errors eliminated, visibility gained]
- [who benefits and how]

### Trigger
[What starts this process?
Examples: form submission / scheduled time / webhook / user action / data condition]

**Trigger type:** Manual / Scheduled / Event-driven / Condition-based

### Steps
| Step | Who/What | Action | Output |
|---|---|---|---|
| 1 | [Human / System / External service] | [what happens] | [what is produced] |
| 2 | | | |
| 3 | | | |

### Data
**Inputs:** [what data enters this process]
**Outputs:** [what data or artifacts are produced]
**Stored where:** [database table, file, external system]
**Displayed where:** [dashboard, email, report, client-facing view]

### Integrations required
| Service | Purpose | Status |
|---|---|---|
| [e.g. email provider] | [send notification] | [Planned / Connected / Tested] |

### Edge cases and exceptions
- [What happens if the trigger fires but data is incomplete?]
- [What happens if an integration fails?]
- [What does the human do when automation can't handle it?]

### Success criteria
[How will you know this automation is working correctly?
What does the client measure? What do you monitor?]

### Build notes
[Anything Claude should know before building this.
Constraints, prior attempts, specific technical requirements.]
```

---

## Active processes

### — Add mapped processes here using the template above —

---

## Process backlog

> Ideas and candidates not yet fully mapped.
> Move to Active when mapping is complete.

| Process idea | Source | Potential impact | Notes |
|---|---|---|---|
| | [client / team / observation] | High / Medium / Low | |

---

## Completed / Live processes

| Process | Live date | Notes |
|---|---|---|
| | | |

---

## Automation patterns we use

> Reusable patterns your team has found effective.
> Reference these when mapping new processes.

### Form → database → notification
```
User fills form
→ Validate and store in Supabase
→ Trigger edge function
→ Send email/SMS notification
→ Update dashboard
```

### Scheduled data pull → process → report
```
Cron trigger (Supabase scheduled function or Vercel cron)
→ Fetch data from source
→ Transform / calculate
→ Store results
→ Surface in dashboard or send report
```

### Webhook intake → route → action
```
External service fires webhook
→ Validate payload
→ Route based on event type
→ Execute action (update record, send notification, trigger workflow)
→ Log result
```

### Approval workflow
```
Submission event
→ Notify approver
→ Approver reviews in dashboard
→ Approve / reject / request changes
→ Notify submitter
→ If approved: trigger next step
```

---

## Questions to ask during client discovery

Use these to identify automation opportunities:

**Process discovery:**
- "Walk me through a typical day / week for your team."
- "What do you do the same way every time?"
- "Where do things fall through the cracks?"
- "What do you wish happened automatically?"
- "Where do you spend time copying information from one place to another?"

**Pain quantification:**
- "How long does [process] take today?"
- "How often does [process] go wrong?"
- "What happens when it does go wrong?"
- "How many people are involved in [process]?"

**Priority signals:**
- "If you could only fix one thing, what would it be?"
- "What keeps you up at night about [area]?"
- "What would your team celebrate if it just... worked?"
