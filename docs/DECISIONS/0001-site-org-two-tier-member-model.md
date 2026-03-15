# ADR 0001: Two-Tier Organization Model (Site Org + Client Orgs)

**Date:** 2026-03-15
**Status:** Accepted

## Context

Foundation Stone Advisors (FSA) is the platform owner. FSA staff need to appear as assignable owners on tasks/projects across all client organizations. Client org members should only be visible within their own org.

The PM module shares a Supabase instance with another FSA project, so auth.users is shared.

## Decision

Add a `is_site_org` boolean flag to `pm_organizations` with a unique partial index ensuring only one org can be the site org.

When querying assignable members for a project:
1. Fetch members of the project's org
2. Also fetch members of the site org (if different)
3. Return both lists, tagged with `is_site_staff` for UI grouping

This approach:
- Reuses existing `pm_members` table (no new tables)
- Keeps FSA staff as regular members in a regular org
- Only adds one column and one query change
- Owner validation on project creation accepts both org members and site-org members

## Alternatives Considered

1. **Global members table** — A separate `pm_site_members` table. Rejected: adds schema complexity, duplicates member logic.
2. **Member scope column** — Adding `scope: 'site' | 'org'` to pm_members. Rejected: couples member records to a concept outside their org.

## Consequences

- FSA must be created as an org with `is_site_org = true` (backfill script provided)
- Owner picker dropdowns show two groups: site staff + org members
- Future: when auth/RLS is added, site-org members get cross-org read access automatically
