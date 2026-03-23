# Supabase Schema

## Shared Project
This module shares a Supabase project with FSA. Auth and org/tenant schema are reused. PM tables are prefixed with `pm_`.

## Tables

### pm_organizations
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, auto-generated |
| slug | TEXT | Unique, kebab-case |
| name | TEXT | Display name |
| is_site_org | BOOLEAN | When true, members are assignable across all orgs (unique constraint: only one site org) |
| address | TEXT | Optional, street address |
| phone | TEXT | Optional, phone number |
| website | TEXT | Optional, URL |
| notes | TEXT | Optional, free-text notes |
| created_at | TIMESTAMPTZ | Auto |

### pm_members
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations |
| slug | TEXT | Unique per org, kebab-case (e.g. `eric-jaffe`) |
| display_name | TEXT | Human-readable |
| email | TEXT | Optional |
| role | TEXT | owner, admin, member, viewer |
| created_at | TIMESTAMPTZ | Auto |

### pm_project_templates
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| slug | TEXT | Unique (saas-rollout, ministry-discovery, etc.) |
| name | TEXT | Display name |
| description | TEXT | |
| phases | JSONB | Array of phase definitions |
| created_at | TIMESTAMPTZ | Auto |

### pm_projects
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations |
| slug | TEXT | Unique per org |
| name | TEXT | |
| description | TEXT | |
| owner | TEXT | Member slug |
| template_slug | TEXT | FK → pm_project_templates.slug |
| start_date | DATE | |
| target_date | DATE | Optional |
| budget | NUMERIC | Optional |
| status | TEXT | active, complete, paused, archived, on-hold |
| intake_data | JSONB | Project intake form data (migration 031) |
| client_context | JSONB | Client context from intake (migration 031) |
| feature_flags | JSONB | Feature flag toggles (migration 031) |
| github_repo | TEXT | GitHub repo slug (migration 031) |
| vercel_project | TEXT | Vercel project name (migration 031) |
| supabase_ref | TEXT | Supabase project ref (migration 031) |
| engagement_id | UUID | FK → pm_engagements (migration 031) |
| intake_completed_at | TIMESTAMPTZ | When intake was completed (migration 031) |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto (trigger) |

### pm_phases
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → pm_projects |
| slug | TEXT | Unique per project |
| name | TEXT | |
| order | INT | Sort order |
| group | TEXT | Phase group (BUILD, GO-TO-MARKET, etc.) |
| status | TEXT | Standard PM status |
| progress | INT | 0–100 |
| owner | TEXT | Optional |
| start_date | DATE | Optional |
| due_date | DATE | Optional |
| estimated_cost | NUMERIC | Optional, estimated cost for phase |
| actual_cost | NUMERIC | Optional, actual cost incurred |
| created_at | TIMESTAMPTZ | Auto |

### pm_tasks
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → pm_projects |
| phase_id | UUID | FK → pm_phases (nullable) |
| slug | TEXT | Unique per project |
| name | TEXT | |
| description | TEXT | Optional |
| owner | TEXT | Member slug |
| status | TEXT | Standard PM status |
| sort_order | INT | Display order within phase (for drag-and-drop) |
| due_date | DATE | Optional |
| depends_on | TEXT[] | Array of task slugs |
| risk_id | UUID | Optional FK |
| subtasks | JSONB | Array of {text, done} |
| estimated_cost | NUMERIC | Optional, estimated cost for task |
| actual_cost | NUMERIC | Optional, actual cost incurred |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto (trigger) |

### pm_risks
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → pm_projects |
| slug | TEXT | Unique per project |
| title | TEXT | |
| description | TEXT | Optional |
| probability | TEXT | low, medium, high |
| impact | TEXT | low, medium, high |
| mitigation | TEXT | Optional |
| owner | TEXT | Optional |
| status | TEXT | open, mitigated, closed |
| created_at | TIMESTAMPTZ | Auto |

### pm_daily_logs
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → pm_projects (nullable — null for org-level standups) |
| org_id | UUID | FK → pm_organizations (migration 029) |
| date | DATE | Unique per project or per org+log_type |
| content | TEXT | Markdown |
| generated_by | TEXT | ai, manual, or standup-agent |
| log_type | TEXT | daily, standup, rollup, blocker, hub, decisions (migration 029) |
| created_at | TIMESTAMPTZ | Auto |

Migrations: 001 (base), 029 (org_id, log_type, nullable project_id)

### pm_files
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| project_id | UUID | FK → pm_projects |
| storage_path | TEXT | Unique per project |
| file_type | TEXT | project, phase, task, risk, decision, status, resource, report, daily |
| title | TEXT | |
| frontmatter | JSONB | Parsed YAML frontmatter |
| last_synced_at | TIMESTAMPTZ | Auto |

## Storage
- Bucket: `vault`
- Path pattern: `[org-slug]/[project-slug]/...`
- Files are markdown with YAML frontmatter
- Supabase Storage is authoritative; GitHub export is a backup

## Migrations
| File | Purpose |
|---|---|
| `001_pm_schema.sql` | Core tables, indexes, updated_at triggers |
| `002_add_missing_columns.sql` | Additive patches for pre-existing tables |
| `003_orgs_and_members.sql` | Organizations, members, FK constraint |
| `004_client_dashboard.sql` | Process maps, opportunities, KPIs, documents, share tokens |
| `005_auth_user_roles.sql` | User profiles, org access roles |
| `006_org_contact_fields.sql` | Add address, phone, website, notes to pm_organizations |
| `007_fix_tasks_org_fk.sql` | Fix pm_tasks org_id FK constraint |
| `008_site_org_flag.sql` | Add is_site_org flag to pm_organizations (unique constraint) |
| `009_task_sort_order.sql` | Add sort_order to pm_tasks for drag-and-drop reordering |
| `010_task_comments_attachments.sql` | Task comments and file attachments tables |
| `011_personal_projects_and_notifications.sql` | Personal projects, notification flag |
| `012_recurring_tasks.sql` | Recurring task series, exceptions, instance tracking |
| `013_auth_system_upgrade.sql` | FK fix on pm_user_org_access, role constraints, user_id on pm_members |
| `014_rls_policies.sql` | RLS enabled on all 20 PM tables with org-scoped access policies |

## Row Level Security (RLS)

All PM tables have RLS enabled (migration 014). Access model:

| Role | Read | Write |
|---|---|---|
| `admin` (system_role) | All rows | All rows |
| `user` (system_role) | All rows | All rows |
| `external` (system_role) | Org-scoped via pm_user_org_access | No write access |
| `anon` (no auth) | No access | No access |
| `service_role` | Bypasses RLS | Bypasses RLS |

### Helper Functions
| Function | Purpose |
|---|---|
| `pm_is_internal()` | Returns true if auth user has system_role admin or user |
| `pm_has_org_access(org_id)` | Returns true if internal OR has pm_user_org_access row for org |
| `pm_has_project_access(project_id)` | Returns true if internal OR has org access for the project's org |

### Access Chains
- **Direct org_id**: pm_organizations, pm_members, pm_projects, pm_task_series, pm_process_maps, pm_opportunities, pm_kpis, pm_documents, pm_share_tokens
- **Via project_id → org_id**: pm_phases, pm_tasks, pm_risks, pm_daily_logs, pm_files
- **Via task_id → project_id → org_id**: pm_task_comments, pm_task_attachments
- **Via series_id → org_id**: pm_series_exceptions
- **Special**: pm_user_profiles (own row + admin), pm_user_org_access (own rows + admin), pm_project_templates (global read, admin write)

## Document Generation Tables (Migration 017)

### document_types
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| slug | TEXT | Unique, e.g. "sow" |
| name | TEXT | e.g. "Statement of Work" |
| description | TEXT | Optional |
| category | TEXT | proposal, contract, report, internal |
| html_template | TEXT | Handlebars HTML template |
| css_styles | TEXT | Scoped CSS for PDF rendering |
| header_html | TEXT | Repeated header |
| footer_html | TEXT | Repeated footer |
| variables | JSONB | Default variable values (e.g. section definitions) |
| is_active | BOOLEAN | Default true |
| created_at, updated_at | TIMESTAMPTZ | Auto |

### document_intake_fields
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| document_type_id | UUID | FK → document_types |
| field_key | TEXT | e.g. "client_name" |
| label | TEXT | e.g. "Client / Company Name" |
| field_type | TEXT | text, textarea, number, date, select, multi-select, currency, toggle |
| options | JSONB | For select/multi-select |
| default_value | TEXT | Optional |
| placeholder | TEXT | Optional |
| help_text | TEXT | Optional |
| validation | JSONB | { required, min, max, pattern } |
| section | TEXT | Grouping label |
| sort_order | INT | Field ordering |
| is_required | BOOLEAN | Default false |
| ai_hint | TEXT | Prompt hint for AI assist |
| created_at | TIMESTAMPTZ | Auto |
| UNIQUE | | (document_type_id, field_key) |

### generated_documents
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| document_type_id | UUID | FK → document_types |
| org_id | UUID | FK → pm_organizations (nullable) |
| project_id | UUID | FK → pm_projects (nullable) |
| title | TEXT | Document title |
| status | TEXT | draft, review, approved, sent, signed, archived |
| intake_data | JSONB | Filled-in form values |
| compiled_html | TEXT | Final merged HTML |
| pdf_storage_path | TEXT | Supabase Storage path |
| version | INT | Default 1 |
| created_by | UUID | FK → auth.users |
| sent_at, signed_at | TIMESTAMPTZ | Nullable |
| created_at, updated_at | TIMESTAMPTZ | Auto |

### document_sections
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| document_id | UUID | FK → generated_documents (CASCADE) |
| section_key | TEXT | e.g. "scope_of_work" |
| title | TEXT | Section heading |
| content_html | TEXT | HTML content |
| sort_order | INT | Section ordering |
| is_locked | BOOLEAN | Prevents AI overwrite |
| ai_generated | BOOLEAN | Default false |
| created_at, updated_at | TIMESTAMPTZ | Auto |

### document_activity
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| document_id | UUID | FK → generated_documents (CASCADE) |
| actor_id | UUID | FK → auth.users (nullable) |
| action | TEXT | created, edited, generated, approved, sent, signed, comment |
| details | JSONB | Optional metadata |
| created_at | TIMESTAMPTZ | Auto |

### pm_site_audits
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| engagement_id | UUID | FK → pm_engagements (SET NULL) |
| url | TEXT | Website URL audited |
| vertical | TEXT | church, agency, nonprofit, general |
| status | TEXT | pending, running, complete, failed |
| scores | JSONB | Per-dimension scores (grade, score, weight, findings) |
| overall | JSONB | { grade, score, rebuild_recommended, rebuild_reason } |
| gaps | JSONB | Gap tables per dimension |
| recommendations | JSONB | Prioritized recommendations |
| quick_wins | JSONB | Quick win actions |
| pages_found | JSONB | Discovered pages on site |
| pages_missing | JSONB | Expected but absent pages |
| pages_to_build | JSONB | Recommended pages with priority |
| rebuild_timeline | JSONB | Phased rebuild plan |
| platform_comparison | JSONB | Current vs recommended platform |
| raw_html | TEXT | Homepage HTML (capped 50k) |
| mockup_html | TEXT | Generated rebuilt site mockup (migration 028) |
| subpages_fetched | JSONB | Subpage metadata from multi-page fetch (migration 028) |
| extra_context | TEXT | User-provided context (GMB info, etc.) |
| audit_summary | TEXT | AI-generated executive summary |
| document_id | UUID | FK → generated_documents (SET NULL) |
| created_by | TEXT | |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migrations: 026 (base), 027 (scoring v2 columns), 028 (mockup + subpages)

### pm_client_notes
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| project_id | UUID | FK → pm_projects (SET NULL) — migration 030 |
| title | TEXT | Note title |
| body | TEXT | Markdown content |
| note_type | TEXT | meeting, general, phone-call, follow-up, client-update |
| visibility | TEXT | internal, client (migration 025) |
| author | TEXT | |
| pinned | BOOLEAN | Default false |
| status | TEXT | draft, sent, archived (migration 030) |
| sent_at | TIMESTAMPTZ | When email was sent (migration 030) |
| sent_to_email | TEXT | Recipient email (migration 030) |
| sent_to_name | TEXT | Recipient name (migration 030) |
| period_start | DATE | Update period start (migration 030) |
| period_end | DATE | Update period end (migration 030) |
| subject | TEXT | Email subject line (migration 030) |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migrations: 015 (base), 025 (visibility), 030 (client update columns)

### pm_engagement_attachments
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| engagement_id | UUID | FK → pm_engagements (CASCADE) |
| file_name | TEXT | Original file name |
| file_size | INTEGER | Bytes |
| content_type | TEXT | MIME type |
| storage_path | TEXT | Supabase Storage path |
| category | TEXT | general, discovery, proposal, contract, intake, project-files, other |
| description | TEXT | Optional description |
| uploaded_by | TEXT | Member slug |
| created_at | TIMESTAMPTZ | Auto |

Migration: 032

### pm_departments
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| slug | TEXT | Unique per org |
| name | TEXT | Display name |
| description | TEXT | Optional |
| head_name | TEXT | Department lead name |
| head_email | TEXT | Department lead email |
| member_count | INT | Default 0 |
| sort_order | INT | Default 0 |
| is_active | BOOLEAN | Default true |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migration: 033

### pm_department_vocab
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| department_id | UUID | FK → pm_departments (CASCADE), nullable for org-wide overrides |
| base_term | TEXT | Canonical term: vision, people, data, processes, meetings, issues |
| display_label | TEXT | What the client calls this term |
| description | TEXT | Optional |
| sort_order | INT | Default 0 |
| created_at | TIMESTAMPTZ | Auto |

Migration: 033. Unique constraint on (org_id, COALESCE(department_id, nil-uuid), base_term).

### pm_portal_settings
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE), UNIQUE |
| show_projects | BOOLEAN | Default true |
| show_phases | BOOLEAN | Default true |
| show_tasks | BOOLEAN | Default true |
| show_risks | BOOLEAN | Default false |
| show_process_maps | BOOLEAN | Default true |
| show_kpis | BOOLEAN | Default true |
| show_documents | BOOLEAN | Default true |
| show_proposals | BOOLEAN | Default true |
| show_reports | BOOLEAN | Default false |
| show_daily_logs | BOOLEAN | Default false |
| show_engagements | BOOLEAN | Default false |
| show_kb_articles | BOOLEAN | Default true |
| allow_task_comments | BOOLEAN | Default true |
| allow_file_uploads | BOOLEAN | Default false |
| allow_chat | BOOLEAN | Default false |
| portal_title | TEXT | Custom title (default: org name) |
| welcome_message | TEXT | Portal home welcome text |
| primary_color | TEXT | Hex color for accent |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migration: 034

### pm_portal_invites
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| email | TEXT | Invitee email |
| name | TEXT | Optional |
| role | TEXT | Default 'viewer' |
| invited_by | TEXT | Member slug |
| token | TEXT | Unique, auto-generated 32-byte hex |
| accepted_at | TIMESTAMPTZ | When accepted |
| expires_at | TIMESTAMPTZ | Default now + 7 days |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMPTZ | Auto |

Migration: 034

### pm_gap_analysis
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| project_id | UUID | FK → pm_projects (SET NULL) |
| engagement_id | UUID | FK → pm_engagements (SET NULL) |
| department_id | UUID | FK → pm_departments (SET NULL) |
| category | TEXT | vision, people, data, processes, meetings, issues, other |
| title | TEXT | Gap title |
| current_state | TEXT | What exists now |
| desired_state | TEXT | What should exist |
| gap_description | TEXT | The delta |
| severity | TEXT | low, medium, high, critical |
| priority | INT | 0 = unranked |
| status | TEXT | identified, acknowledged, planned, in-progress, resolved |
| resolution_notes | TEXT | How it was resolved |
| resolved_at | TIMESTAMPTZ | |
| task_id | UUID | FK → pm_tasks, linked remediation task |
| discovered_by | TEXT | Member slug |
| discovered_at | TIMESTAMPTZ | Default now |
| source | TEXT | interview, observation, document-review, audit, other |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migration: 035

### pm_discovery_interviews
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| project_id | UUID | FK → pm_projects (SET NULL) |
| engagement_id | UUID | FK → pm_engagements (SET NULL) |
| department_id | UUID | FK → pm_departments (SET NULL) |
| note_id | UUID | FK → pm_client_notes (SET NULL) |
| title | TEXT | Interview title |
| interviewee_name | TEXT | |
| interviewee_role | TEXT | |
| interview_date | DATE | Default CURRENT_DATE |
| duration_minutes | INT | |
| focus_areas | TEXT[] | Base terms this covers |
| key_findings | JSONB | [{finding, category, severity}] |
| action_items | JSONB | [{item, assigned_to, due_date}] |
| follow_up_needed | BOOLEAN | Default false |
| status | TEXT | scheduled, completed, cancelled, follow-up |
| summary | TEXT | AI-generated or manual |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migration: 035

### pm_onboarding_checklists
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| org_id | UUID | FK → pm_organizations (CASCADE) |
| project_id | UUID | FK → pm_projects (CASCADE) |
| engagement_id | UUID | FK → pm_engagements (SET NULL) |
| category | TEXT | discovery, setup, kickoff, documentation, handoff |
| title | TEXT | Checklist item title |
| description | TEXT | |
| sort_order | INT | Default 0 |
| is_required | BOOLEAN | Default true |
| status | TEXT | pending, in-progress, complete, skipped |
| completed_by | TEXT | Member slug |
| completed_at | TIMESTAMPTZ | |
| task_id | UUID | FK → pm_tasks, auto-generated task link |
| created_at, updated_at | TIMESTAMPTZ | Auto |

Migration: 035

### Additional columns added by migrations 033-035
- `pm_tasks.department_id` — FK → pm_departments (SET NULL)
- `pm_phases.department_id` — FK → pm_departments (SET NULL)
- `pm_projects.project_type` — TEXT: standard, onboarding, personal
- `pm_projects.parent_project_id` — FK → pm_projects (SET NULL)
- `pm_projects.onboarding_status` — TEXT: not-started, discovery, gap-analysis, planning, active, complete

### Additional columns added by migration 041 (Projected Revenue)
- `pm_engagements.projected_mrr` — DECIMAL(12,2), default 0, monthly recurring revenue
- `pm_engagements.projected_one_time` — DECIMAL(12,2), default 0, one-time project revenue
- `pm_projects.projected_mrr` — DECIMAL(12,2), default 0, monthly recurring revenue
- `pm_projects.projected_one_time` — DECIMAL(12,2), default 0, one-time project revenue

### Storage
- Bucket: `documents` (private, for PDF storage)
- Bucket: `vault` (private, engagement attachments stored at `{org-slug}/engagements/{engagement-id}/...`)
