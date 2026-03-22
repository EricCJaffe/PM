# ADR 0002 — Centralized Branding System

**Status:** Accepted
**Date:** 2026-03-22
**Author:** Claude

## Context

All client-facing output (site audit PDFs, emails, share pages, proposals, documents) had hardcoded branding references to "Foundation Stone Advisors" and "BusinessOS PM." This created several problems:

1. **Branding changes require code changes** — changing a company name, color, or logo meant editing multiple files
2. **No per-client customization** — all clients received the same agency-only branding
3. **No co-branding support** — couldn't insert client logos into presentations or documents
4. **Inconsistency risk** — new features might use different colors or names

## Decision

Introduce a two-tier, database-backed branding system:

### Platform Branding (`pm_platform_branding`)
- Singleton row with all agency identity fields (name, logos, colors, fonts, email settings, footer)
- Managed via Admin Console > Branding tab
- Serves as the default for all output when no org overrides exist

### Org Branding Overrides (`pm_org_branding`)
- Per-org row with nullable override fields (null = inherit from platform)
- Supports four co-branding modes: `agency-only`, `co-branded`, `client-only`, `white-label`
- Client logo URL for co-branded partnership presentations
- Color and footer overrides for white-label scenarios

### Branding Resolver (`src/lib/branding.ts`)
- Single function `getBranding(orgId?)` that resolves platform + org overrides
- Returns a `ResolvedBranding` object with all fields populated
- Helper functions for building email FROM lines, footers, logo HTML, CSS variables
- **All client-facing output must call this function** — enforced by convention

### Integration Points Updated
- `src/lib/email.ts` — all email functions now accept orgId and resolve branding
- Site audit PDF route — brand colors via CSS custom properties
- Public share page — co-branded header with agency/client logos
- Query helpers added for direct DB access when needed

## Consequences

### Positive
- Branding changes are instant — no code deployment needed
- Per-client co-branding enables partnership presentations
- White-label mode supports reselling the platform
- All future client-facing features have a clear pattern to follow

### Negative
- Extra DB query per email/PDF (singleton row, cheap and cacheable)
- Existing proposal send route and docgen system not yet migrated (future work)

## Migration
- `038_branding.sql` creates both tables with RLS policies
- Seeds a default platform branding row with current FSA values
- No data migration needed — existing hardcoded values become the defaults
