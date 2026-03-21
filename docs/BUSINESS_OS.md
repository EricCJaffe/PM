# BUSINESS_OS.md — Platform Model

> Claude reads this file every session on Mission Control and any vertical deployment.
> This document defines what the product is, how it works, and where it's going.
> Update when product strategy, verticals, or architecture changes.

---

## What this product is

Mission Control is an **AI-native operating system for service organizations.**

It is not a project management tool.
It is not a task tracker with AI bolted on.

It is the infrastructure that connects every stage of how a service organization operates —
from the first client inquiry to the final invoice — with AI reducing manual work at every step.

---

## The platform model

```
CORE PLATFORM (universal)
├── Project and task management
├── Team coordination (ACTIVE_WORK, HANDOFF, SESSION-CHANGELOG)
├── Client context and communication
├── AI-driven workflow execution
├── Claude Code integration
├── Idea-to-cash pipeline
└── Reporting and visibility

VERTICAL PACKS (swappable on top of core)
├── Agency OS        — web development and automation agencies
├── Church OS        — churches and regional ministries  
├── Nonprofit OS     — faith-based and general nonprofits
└── [next vertical]  — defined by market demand
```

Each vertical pack contains:
- Workflow templates specific to that organization type
- Terminology and UI language appropriate to that vertical
- Pre-built automations for common processes in that vertical
- Onboarding sequence tailored to that vertical's needs

The core platform is the same for every customer.
The vertical pack is what makes it feel built for them.

---

## Current verticals

### Agency OS
**Target:** AI/automation agencies, web development shops, Claude Code teams
**Core workflows:** Lead intake → scoping → project kickoff → build → QA → delivery → invoice → retainer
**Key differentiator:** Claude Code integration, prompt library, automated handoffs
**Status:** In active use (dogfood) — pre-revenue SaaS

### Church OS
**Target:** Local churches, regional ministries, multi-campus organizations
**Core workflows:** Service planning → ministry coordination → event management → volunteer management → giving tracking → pastoral care
**Key differentiator:** Mission-first design, discipleship pathway tracking, not just attendance
**Status:** Built — seeking first paying customer

### Nonprofit OS
**Target:** Faith-based and general nonprofits
**Core workflows:** Program management → volunteer coordination → donor management → grant tracking → impact reporting
**Key differentiator:** Mission alignment built in, not bolted on
**Status:** Built — seeking first paying customer

---

## Multi-tenancy model

**Architecture:** Shared Supabase database with row-level security (RLS) isolation
**Tenant unit:** Organization (`orgs` table)
**Isolation:** Every table with tenant data has `org_id` with RLS policies
**Vertical assignment:** Each org has a `vertical` field set at onboarding
**Provisioning:** White-glove onboarding — workflows, templates, and automations seeded per vertical

### Org data model
```sql
orgs
├── id (uuid, PK)
├── name (text)
├── vertical (text) — 'agency' | 'church' | 'nonprofit'
├── plan (text) — 'trial' | 'starter' | 'growth' | 'scale'
├── onboarded_at (timestamptz)
└── created_at (timestamptz)

org_members
├── id (uuid, PK)
├── org_id (uuid, FK → orgs)
├── user_id (uuid, FK → auth.users)
├── role (text) — 'admin' | 'member' | 'viewer'
└── created_at (timestamptz)
```

**RLS rule:** Every tenant-owned table uses this pattern:
```sql
using (
  org_id in (
    select org_id from org_members
    where user_id = auth.uid()
  )
)
```

---

## The agent layer (current and planned)

### Built
- Claude Code build agent (via Claude Code CLI)
- Session closeout agent (via AGENTS.md closeout mode)

### In progress
- Standup / status agent — reads ACTIVE_WORK + HANDOFF → generates morning summary
- Client update agent — reads SESSION-CHANGELOG → drafts client-ready weekly update

### Planned
- Intake agent — qualifies leads, populates CLIENT_CONTEXT.md
- Scoping agent — runs discovery interview, populates AUTOMATION_MAP.md
- QA agent — checks build output against requirements before client delivery
- Billing trigger agent — watches milestones, initiates invoice workflows
- Renewal agent — monitors retainer health, surfaces upsell opportunities

---

## What Claude should always know when working on this product

1. **Every feature serves the platform model** — if it doesn't belong in core or a vertical pack, question whether to build it
2. **Multi-tenancy is non-negotiable** — every new table needs org_id and RLS before it ships
3. **AI-native means proactive, not just reactive** — the product should surface things, not just respond to requests
4. **Dogfood first** — Agency OS is the test environment; if it doesn't work for our team it doesn't ship to customers
5. **Vertical packs are additive** — adding a new vertical should never require touching core platform code
6. **White-glove now, self-serve later** — onboarding is manual by design until we know exactly what customers need

---

## North star metric

**Time from signed contract to first value delivered** — measured per vertical, per customer.

Everything in the product roadmap is evaluated against whether it reduces this number.
