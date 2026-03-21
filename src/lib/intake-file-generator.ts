/**
 * Generates pre-filled markdown files for the project intake zip download.
 */

interface ProjectInitOptions {
  name: string;
  type: string;
  isGreenfield: boolean;
  v1Done: string;
  targetLaunch: string;
  githubRepo: string;
  vercelProject: string;
  supabaseRef: string;
  framework: string;
  featureFlags: Record<string, boolean>;
  integrations: string[];
}

export function generateProjectInitMd(opts: ProjectInitOptions): string {
  const flags = opts.featureFlags;
  const today = new Date().toISOString().split("T")[0];
  return `# PROJECT_INIT.md — Project Interrogation
## Completed at project kickoff: ${today}

---

## Feature Flags
\`\`\`
SEO_ENABLED:          ${flags.seo_enabled ? "true" : "false"}
SECURITY_REVIEW:      ${flags.security_review ? "true" : "false"}
MULTI_TENANT:         ${flags.multi_tenant ? "true" : "false"}
A2A_ENABLED:          ${flags.a2a_enabled ? "true" : "false"}
PAYMENTS_ENABLED:     ${flags.payments_enabled ? "true" : "false"}
HIPAA_SCOPE:          ${flags.hipaa_scope ? "true" : "false"}
EXISTING_CODEBASE:    ${opts.isGreenfield ? "false" : "true"}
\`\`\`

---

## Section 0 — Toolstack

**GitHub repo:** ${opts.githubRepo || "[Add after creating repo]"}
**Vercel project:** ${opts.vercelProject || "[Add after Vercel setup]"}
**Supabase project ref:** ${opts.supabaseRef || "[Add after Supabase setup]"}
**.env.local exists:** [ ] Yes / [ ] No
**.env.local in .gitignore:** [ ] Confirmed
**Migrations folder:** [ ] supabase/migrations/ exists / [ ] Not yet
**Stack deviations from default:** ${opts.framework !== "nextjs" ? `Framework: ${opts.framework}` : "None — matches default stack"}

---

## 1. Project Classifier

**Project name:** ${opts.name}
**Project type:** ${opts.type}
**Greenfield or existing:** ${opts.isGreenfield ? "Greenfield" : "Existing codebase"}
**V1 definition of done:** ${opts.v1Done}
**Target launch:** ${opts.targetLaunch || "[Set target date]"}

---

## 9. Integrations

${
  opts.integrations.length > 0
    ? opts.integrations.map((i) => `| ${i} | [Purpose] | Planned |`).join("\n")
    : "| [No integrations selected] | | |"
}

---

## 11. First-Run Schema Checklist

- [ ] Every table has \`id uuid default gen_random_uuid() primary key\`
- [ ] Every user-owned table has \`user_id references auth.users(id) on delete cascade\`
- [ ] RLS enabled and policies written before any table goes to production
- [ ] \`created_at\` and \`updated_at\` on every table
- [ ] Indexes on all foreign keys
- [ ] No PII in plaintext without encryption plan

---

## Completion Status
- [x] Intake form completed
- [ ] Feature flags verified
- [ ] Reviewed with Claude at first session start
- [ ] Schema checklist verified before first migration

**Completed:** ${today}
`;
}

interface ClientContextOptions {
  orgName: string;
  problemInTheirWords: string;
  whatFixedLooksLike: string;
  technicalComfort: string;
  contactName: string;
  contactRole: string;
  budgetRange: string;
  hardDeadline: string;
  knownConstraints: string;
}

export function generateClientContextMd(opts: ClientContextOptions): string {
  const today = new Date().toISOString().split("T")[0];
  return `# CLIENT_CONTEXT.md — Client Intelligence
## Populated at project kickoff: ${today}

> Update after every client conversation.

---

## Client profile

**Organization:** ${opts.orgName}
**Primary contact:** ${opts.contactName} — ${opts.contactRole}
**Technical comfort level:** ${opts.technicalComfort}
**Budget range:** ${opts.budgetRange || "[Not specified]"}
**Hard deadline:** ${opts.hardDeadline || "[Not specified]"}

---

## The problem

**In their words:**
> ${opts.problemInTheirWords || "[Fill in from discovery call — use their exact language]"}

**What "fixed" looks like to them:**
${opts.whatFixedLooksLike || "[Fill in — their definition of success in plain language]"}

---

## Known constraints

${opts.knownConstraints || "[Fill in — anything that could affect delivery: budget, timeline, existing systems, internal politics]"}

---

## Their language

| Their word | Technical meaning | Notes |
|---|---|---|
| [Fill in] | [Fill in] | |

---

## What they have rejected

| Proposed | Why rejected | Date |
|---|---|---|
| [None yet] | | |

---

## Open questions

| Question | Why it matters | Asked? | Answer |
|---|---|---|---|
| | | No | |

---

## Iteration log

### ${today} — Project kickoff
Initial intake form completed. Discovery call notes to be added here.

**Last updated:** ${today}
`;
}

export function generateAutomationMapMd(projectName: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `# AUTOMATION_MAP.md — Process Automation Map
## Project: ${projectName}
## Started: ${today}

> Map every process before building it.
> Rule: if it is not mapped here, do not build it yet.

---

## Active processes

[No processes mapped yet — add during discovery]

---

## Process backlog

| Process idea | Source | Impact | Notes |
|---|---|---|---|
| [Fill in from discovery] | client | High | |

---

## Discovery questions to ask

- "Walk me through a typical day for your team."
- "What do you do the same way every time?"
- "Where do things fall through the cracks?"
- "What do you wish happened automatically?"
- "If you could fix one thing, what would it be?"
`;
}

export function generatePromptLibraryMd(): string {
  const today = new Date().toISOString().split("T")[0];
  return `# PROMPT_LIBRARY.md — What Works
## Started: ${today}

> Capture prompt patterns that work well on this project.
> Say "Save this to the prompt library" during any Claude Code session.

---

## Migrations and RLS
[entries will appear here]

---

## API routes
[entries will appear here]

---

## Frontend components
[entries will appear here]

---

## Debugging and recovery
[entries will appear here]
`;
}
