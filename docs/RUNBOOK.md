# Runbook

## Initial Setup
1. Clone repo and `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in values
3. Run all migrations in order against your Supabase project:
   - `supabase/migrations/001_pm_schema.sql`
   - `supabase/migrations/002_add_missing_columns.sql`
   - `supabase/migrations/003_orgs_and_members.sql`
4. Create the `vault` storage bucket in Supabase (public or private)
5. Seed templates: `npm run seed`
6. Start dev server: `npm run dev`

## Creating Your First Project
1. Create an organization: `POST /api/pm/organizations` with `{ name, slug }`
2. Add members: `POST /api/pm/members` with `{ org_id, slug, display_name, email, role }`
3. Go to `/projects/new`, select your org, pick a template, assign an owner, create

## Running Migrations
Migrations are numbered sequentially. Apply them in order via the Supabase SQL editor or CLI:
```
supabase db push  # if using Supabase CLI
```
Or paste each `.sql` file into the Supabase Dashboard SQL editor.

Migration 002 is safe to re-run — it uses `ADD COLUMN IF NOT EXISTS`.

## Generating Reports
Reports are generated via API and persisted to the vault:
- Weekly rollup: `POST /api/pm/reports/rollup` with `{ project_id, org_slug, project_slug }`
- Blocker scan: `POST /api/pm/reports/blockers` with `{ project_id, org_slug, project_slug }`
- Hub report: `POST /api/pm/reports/hub` with `{ org_slug }`
- Decision register: `POST /api/pm/reports/decisions` with `{ project_id, org_slug, project_slug }`

## GitHub Vault Export
`POST /api/pm/export/github` with `{ org_slug, project_slug? }`
Requires `GITHUB_TOKEN` and `GITHUB_VAULT_REPO` env vars.

## Troubleshooting
- **"Can't find column X"** — Run migration 002 (adds missing columns to existing tables)
- **"Organization not found"** — Create the org first via `/api/pm/organizations`
- **"Owner is not a member"** — Add the person as a member via `/api/pm/members`
- **Build fails with OpenAI key error** — OpenAI client uses lazy init; key only needed at runtime
