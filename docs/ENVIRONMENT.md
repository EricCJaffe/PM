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
| `EVERSIGN_ACCESS_KEY` | `.env.local` | Xodo Sign (eversign) API key for digital signatures (**server only**) |
| `EVERSIGN_BUSINESS_ID` | `.env.local` | Xodo Sign business ID (default: `1`) |
| `EVERSIGN_SANDBOX` | `.env.local` | Set to `1` for non-binding sandbox documents |

## Supabase Auth — Callback URLs

The Supabase project must have the PM site's URL(s) listed in the **Redirect URLs** under
Dashboard → Authentication → URL Configuration. Add these entries:

| URL | Purpose |
|---|---|
| `http://localhost:3000/auth/callback` | Local development |
| `https://<your-vercel-domain>/auth/callback` | Production deployment |

If this Supabase project is shared with another site, both sites' callback URLs must be listed.

**To configure:**
1. Go to your Supabase Dashboard → Authentication → URL Configuration
2. Under "Redirect URLs", add the URLs above
3. Set "Site URL" to your primary production URL

## Email (Resend)
- Sends from: `admin@foundationstoneadvisors.com`
- Used for: task assignment notifications, user invites
- Gracefully degrades — if `RESEND_API_KEY` is not set, emails are skipped with a console log

## Security
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `GITHUB_TOKEN`, or `EVERSIGN_ACCESS_KEY` in `NEXT_PUBLIC_*` variables
- `.env.local` is in `.gitignore` — never commit it
- See `.env.local.example` for the template
