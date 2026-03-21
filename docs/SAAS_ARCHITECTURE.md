# SAAS_ARCHITECTURE.md — Multi-Tenant Architecture

> Claude reads this file on every Mission Control session.
> These are the architectural decisions that govern how the product is built.
> Change them only with documented justification in docs/DECISIONS/.

---

## Core decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Multi-tenancy model | Shared DB + RLS | Right for current scale, cost-effective, manageable |
| Tenant unit | Organization (`orgs`) | Users belong to orgs, not the other way around |
| Vertical model | Pack-based on shared core | New verticals are additive, not forks |
| Onboarding | White-glove → self-serve | Learn first, automate second |
| Auth | Supabase Auth | Consistent with stack, handles org/user separation |

---

## Data model — foundations

### Orgs table
```sql
create table orgs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,            -- URL-safe identifier
  vertical text not null check (
    vertical in ('agency', 'church', 'nonprofit')
  ),
  plan text not null default 'trial' check (
    plan in ('trial', 'starter', 'growth', 'scale')
  ),
  trial_ends_at timestamptz,
  onboarded_at timestamptz,             -- set when onboarding complete
  settings jsonb default '{}',          -- vertical-specific config
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Org members table
```sql
create table org_members (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references orgs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (
    role in ('owner', 'admin', 'member', 'viewer')
  ),
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);
```

### Universal RLS pattern
Every tenant-owned table uses this exact pattern — no exceptions:

```sql
-- Enable RLS
alter table [table] enable row level security;

-- Isolation policy
create policy "org_isolation" on [table]
  for all using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid()
    )
  );

-- Insert check
create policy "org_insert" on [table]
  for insert with check (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid()
    )
  );
```

### Standard columns for every tenant table
```sql
id uuid default gen_random_uuid() primary key,
org_id uuid references orgs(id) on delete cascade not null,
created_by uuid references auth.users(id) not null,
created_at timestamptz default now(),
updated_at timestamptz default now(),
deleted_at timestamptz  -- soft delete, null = active
```

---

## Vertical pack architecture

### How packs work
Each vertical pack is a set of seed data that gets provisioned when an org onboards.
Packs live in `supabase/seeds/verticals/[vertical]/`.

```
supabase/seeds/verticals/
├── agency/
│   ├── workflows.sql
│   ├── templates.sql
│   └── automations.sql
├── church/
│   ├── workflows.sql
│   ├── templates.sql
│   └── automations.sql
└── nonprofit/
    ├── workflows.sql
    ├── templates.sql
    └── automations.sql
```

### Provisioning function
```typescript
// Called once at onboarding completion
async function provisionOrg(
  orgId: string,
  vertical: 'agency' | 'church' | 'nonprofit'
) {
  await seedWorkflows(orgId, vertical)
  await seedTemplates(orgId, vertical)
  await seedAutomations(orgId, vertical)
  await markOnboarded(orgId)
}
```

### Adding a new vertical
1. Create `supabase/seeds/verticals/[new-vertical]/` folder
2. Add workflow, template, and automation seed files
3. Add to `vertical` check constraint in `orgs` table (new migration)
4. Add to `provisionOrg` function
5. Add vertical-specific onboarding section to `ONBOARDING_RUNBOOK.md`
6. Document in `BUSINESS_OS.md`

**Never touch core platform code to add a vertical.**

---

## Role-based access per org

| Role | Can do |
|---|---|
| `owner` | Everything including billing, deleting org |
| `admin` | Everything except billing and deleting org |
| `member` | Create, read, update their own work and shared resources |
| `viewer` | Read only |

### Role check helper
```typescript
async function requireRole(
  orgId: string,
  userId: string,
  minRole: 'viewer' | 'member' | 'admin' | 'owner'
) {
  const roleOrder = ['viewer', 'member', 'admin', 'owner']
  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single()

  if (!data) throw new Error('Not a member of this org')
  if (roleOrder.indexOf(data.role) < roleOrder.indexOf(minRole)) {
    throw new Error('Insufficient permissions')
  }
}
```

---

## Billing and plan enforcement

### Plan limits (define before first customer)

| Plan | Projects | Members | Automations | AI calls/mo |
|---|---|---|---|---|
| Trial | 3 | 5 | 5 | 100 |
| Starter | 10 | 10 | 20 | 500 |
| Growth | 50 | 25 | 100 | 2000 |
| Scale | Unlimited | Unlimited | Unlimited | Unlimited |

### Plan check pattern
```typescript
async function checkPlanLimit(
  orgId: string,
  resource: 'projects' | 'members' | 'automations'
) {
  const org = await getOrg(orgId)
  const limits = PLAN_LIMITS[org.plan]
  const current = await countResource(orgId, resource)

  if (current >= limits[resource]) {
    throw new PlanLimitError(resource, org.plan)
  }
}
```

---

## Pre-launch security checklist

Run this before onboarding first paying customer:

### Data isolation
- [ ] Created two test orgs
- [ ] Populated both with sample data
- [ ] Verified Org A cannot read Org B's data using anon key
- [ ] Verified Org A cannot write to Org B's data
- [ ] Tested with a user who is a member of both orgs (should only see correct data)

### Auth
- [ ] Invite flow tested end-to-end
- [ ] Role assignment works correctly
- [ ] Deactivated user cannot access org data
- [ ] Password reset flow works
- [ ] Session expiry handled gracefully

### Plan enforcement
- [ ] Trial expiry blocks access appropriately
- [ ] Plan limits enforced with clear error messages
- [ ] Upgrade flow works (even if manual at this stage)

### Data integrity
- [ ] Soft deletes working (deleted_at set, not hard deleted)
- [ ] Cascade deletes tested (deleting org removes all org data)
- [ ] No orphaned records possible

---

## Scaling path (when you need it)

**Current stage (0–50 customers):**
Shared DB, RLS, white-glove onboarding. No changes needed.

**Next stage (50–200 customers):**
- Add read replicas for reporting queries
- Add background job queue (pg_boss or similar)
- Build self-serve onboarding flow

**Future stage (200+ customers):**
- Evaluate schema-per-tenant for enterprise customers
- Add dedicated DB option for high-compliance verticals
- Build partner/reseller model for vertical specialists

**Don't build for future stages yet.**
Every premature scaling decision adds complexity that slows you down now.
