# SERVICE_CATALOG.md — What We Sell

> Claude reads this file when helping scope new work, draft proposals,
> or evaluate whether an opportunity fits the business.
> Update when services, pricing, or scope boundaries change.

---

## Agency services (how we fund the product build)

### Web development and automation
**What it is:** Build client-facing websites and internal automation applications
**Stack:** Next.js, Supabase, Vercel, TypeScript, Tailwind
**Typical scope:** 4–12 weeks depending on complexity
**Deliverable:** Production-deployed application with documentation

### Process automation consulting
**What it is:** Map existing processes, identify automation opportunities, build workflows
**Starting point:** AUTOMATION_MAP.md discovery session
**Deliverable:** Automation map + built workflows + handoff documentation

### AI integration
**What it is:** Add AI capabilities (Claude, OpenAI) to existing systems or new builds
**Use cases:** Content generation, data extraction, classification, chat interfaces
**Deliverable:** Working integration with prompt library and maintenance docs

---

## Mission Control SaaS

### Pricing model (define before first customer)

| Tier | Monthly | Annual | Seats | Vertical |
|---|---|---|---|---|
| Starter | $[TBD] | $[TBD] | Up to 5 | 1 vertical |
| Growth | $[TBD] | $[TBD] | Up to 15 | 1 vertical |
| Scale | $[TBD] | $[TBD] | Unlimited | Multiple verticals |

**Onboarding fee:** $[TBD] — covers white-glove setup, workflow configuration, team training
**Custom workflows:** Scoped separately per engagement

### What's included in every plan
- Core platform (projects, tasks, team coordination)
- Vertical workflow pack
- AI-assisted handoffs and standups
- Claude Code integration documentation
- Prompt library (shared and growing)

### What requires custom scoping
- Integrations with existing systems (CRM, accounting, etc.)
- Custom workflow automation beyond standard pack
- API access for third-party connections
- Dedicated onboarding beyond standard runbook

---

## Scoping rules

### What we take on
- [ ] Client has a clear problem we've solved before (check AUTOMATION_MAP.md patterns)
- [ ] Budget is realistic for scope (use SERVICE_CATALOG ranges)
- [ ] Timeline is achievable without burning the team
- [ ] Aligns with at least one of our three verticals or creates a fourth
- [ ] Client is willing to go through our discovery process

### What we decline
- [ ] Pure hourly dev work with no automation component
- [ ] Projects requiring technologies outside our stack without strong reason
- [ ] Clients who want to own the IP of vertical pack improvements
- [ ] Scope so large it would require hiring before revenue arrives
- [ ] Anything that conflicts with mission/values alignment

### Red flags during discovery
- Client can't articulate the problem they're solving
- "We just need someone to build what we designed" (no discovery)
- Timeline driven by arbitrary date not business need
- Multiple prior vendors who "didn't understand what we wanted"
- Decision maker not in the room during discovery

---

## Proposal template triggers

When Claude helps draft a proposal, use:
- `CLIENT_CONTEXT.md` for client language and priorities
- `AUTOMATION_MAP.md` for scoping what gets built
- This file for pricing and scope boundaries
- `docs/DECISIONS/` for any prior decisions on similar scopes

---

## Competitive positioning

**vs. Generic agencies:**
We build AI-native from the start. Every deliverable includes prompt library, documentation Claude can read, and automation that compounds over time. Not just code — an operating system.

**vs. No-code tools (Zapier, Make, etc.):**
We build custom applications when no-code hits its limits. We also integrate with no-code tools when they're the right answer. We're not ideological about it.

**vs. Enterprise consulting:**
We're faster, cheaper, and we actually build things. We don't produce decks — we produce working software.

**Our actual differentiator:**
We run our own business on the same OS we build for clients. When we say it works, we mean we use it every day.

---

## Last updated
[YYYY-MM-DD] — Update whenever pricing, scope, or positioning changes.
