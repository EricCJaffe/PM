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
| due_date | DATE | Optional |
| depends_on | TEXT[] | Array of task slugs |
| risk_id | UUID | Optional FK |
| subtasks | JSONB | Array of {text, done} |
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
| project_id | UUID | FK → pm_projects |
| date | DATE | Unique per project |
| content | TEXT | Markdown |
| generated_by | TEXT | ai or manual |
| created_at | TIMESTAMPTZ | Auto |

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
