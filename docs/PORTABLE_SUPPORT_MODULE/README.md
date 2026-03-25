# Portable Support Ticket Module

A complete support ticket + AI triage + remediation system extracted from Linksy, designed to be installed into any Next.js 14+ / Supabase project via Claude Code.

## What's Included

| Capability | Description |
|-----------|-------------|
| **Referral Tickets** | End-user submits a request, routed to a provider/org, full lifecycle management |
| **Support Tickets** | Internal tickets for platform support (provider → staff) |
| **AI Triage** | GPT-4o-mini auto-analyzes support tickets: classification, severity, root cause, suggested fix |
| **AI Remediation** | GPT-4o generates code fix + creates GitHub PR automatically |
| **Duplicate Detection** | 4-case system to prevent/flag duplicate referrals |
| **Audit Trail** | Immutable event log for all ticket lifecycle changes |
| **Email Notifications** | Resend/SMTP with host-level template overrides |
| **Webhooks** | Tenant-scoped event delivery for integrations |
| **Status Sub-Reasons** | Admin-configurable dropdown reasons per status |

## Installation Guide

Hand the `INSTALL.md` file to Claude Code on your target project:

```
@docs/PORTABLE_SUPPORT_MODULE/INSTALL.md
```

Claude Code will walk through a multi-phase installation, asking questions about your project along the way.

## Files in This Directory

| File | Purpose |
|------|---------|
| `README.md` | This overview |
| `INSTALL.md` | The main Claude Code prompt — multi-phase installation guide |
| `SCHEMA.sql` | Complete database migration (idempotent, run in Supabase) |
| `ARCHITECTURE.md` | System architecture reference for maintainers |
| `API_CONTRACTS.md` | Full API route specifications |
