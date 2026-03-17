# Environment Variables

## Required
| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase anonymous key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Supabase service role key (**server only**) |
| `OPENAI_API_KEY` | `.env.local` | OpenAI API key for AI chat + reports (**server only**) |

## Optional
| Variable | Where | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `.env.local` / Vercel | Resend API key for email notifications (**server only**) |
| `GITHUB_TOKEN` | `.env.local` | GitHub PAT for vault export (**server only**) |
| `GITHUB_VAULT_REPO` | `.env.local` | Target repo for vault export (e.g. `EricCJaffe/businessos-vault`) |

## Email (Resend)
- Sends from: `admin@foundationstoneadvisors.com`
- Used for: task assignment notifications, user invites
- Gracefully degrades — if `RESEND_API_KEY` is not set, emails are skipped with a console log

## Security
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, or `GITHUB_TOKEN` in `NEXT_PUBLIC_*` variables
- `.env.local` is in `.gitignore` — never commit it
- See `.env.local.example` for the template
