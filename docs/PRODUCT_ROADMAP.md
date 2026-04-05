# PRODUCT_ROADMAP.md — Where BusinessOS PM Is Going

> Claude reads this every session.
> Every build decision is evaluated against this roadmap.
> If a task is not on this roadmap, ask whether it should be before building it.

---

## What this product is
BusinessOS PM is an AI-native project management OS for service organizations.
Platform model: shared core + vertical workflow packs (Agency OS, Church OS, Nonprofit OS).
This is both our internal operating system and our SaaS product.

See docs/BUSINESS_OS.md for full platform model.

---

## Current phase
**Phase:** Foundation → First Revenue
**Goal:** Get one paying customer per vertical before adding features.
**Status:** Agency OS in active internal use (dogfood complete). Security hardening pass in progress. Seeking first Church OS customer.

---

## What done looks like for Phase 1
- [ ] Agency OS running our own business reliably (dogfood complete)
- [ ] Church OS: 1 paying customer onboarded and active
- [ ] Nonprofit OS: 1 paying customer onboarded and active
- [ ] Onboarding runbook executed without founder present at least once

---

## Now — current sprint
**Sprint goal (2026-04-04):** Security hardening + end-to-end workflow and portal testing

- [ ] SEC-002: Add org membership check to `/api/pm/chat` before exposing project data [@eric]
- [ ] SEC-004: Design decision on chat `history` prompt injection risk [@eric]
- [ ] SEC-005: Rate limiting on AI endpoints (chat, reports, standup, site-audit/process) [@eric]
- [ ] SEC-006: Monitor `next` package audit finding — update when patch available [@eric]
- [ ] Test end-to-end: audit → start workflow → verify tasks generated
- [ ] Test portal: invite client → magic link → portal dashboard → workflow view
- [ ] Test AI SOP scanner with real documents
- [ ] Wire up content generation button in admin workflow detail view
- [ ] Wire up build prompts button in admin workflow detail view

---

## Next — after current sprint

### Core platform
- [ ] Project intake form in PM UI that pre-fills PROJECT_INIT.md
- [ ] Standup agent — morning summary from ACTIVE_WORK + HANDOFF
- [ ] Client update generator — SESSION-CHANGELOG to client-ready weekly update
- [ ] Plan enforcement — trial expiry, plan limits with clear UX
- [ ] Self-serve invite flow

### Site audit tool
- [ ] URL intake form in PM
- [ ] Fetch and score site against Church OS / Agency OS standards
- [ ] Generate gap analysis PDF automatically
- [ ] Generate site mock-up
- [ ] Package as proposal deliverable

### Agency OS
- [ ] Proposal generator — scoping interview to drafted proposal
- [ ] AI-assisted PROJECT_INIT interview on project creation

---

## Later — sequenced but not started
- Self-serve onboarding (currently white-glove)
- Partner/reseller model for vertical specialists
- Marketplace for community-built workflow packs
- Mobile / PWA

---

## Explicitly not building yet
| Feature | Why not |
|---|---|
| Native video/meeting tool | Use Zoom/Meet, integrate don't replace |
| Full CRM | Integrate with existing CRMs |
| Accounting/invoicing | Integrate with QuickBooks/Stripe |
| Email marketing | Use dedicated tools |

---

## North star metric
Time from signed contract to first value delivered — per vertical, per customer.

**Last updated:** 2026-04-04
