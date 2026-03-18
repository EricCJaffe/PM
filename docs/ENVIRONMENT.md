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
| `DOCUSEAL_API_KEY` | `.env.local` | DocuSeal API key for digital signatures (**server only**) |
| `DOCUSEAL_API_URL` | `.env.local` | DocuSeal API URL (default: `https://api.docuseal.com`, set for self-hosted) |
| `DOCUSEAL_WEBHOOK_SECRET` | `.env.local` | Shared secret for webhook validation (**server only**) |

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

## Microsoft (Azure AD) SSO

Microsoft sign-in is configured as an OAuth provider through Supabase using the `azure` provider.

**Setup steps:**
1. Register an app in **Microsoft Entra ID** (Azure AD):
   - Go to Azure Portal → Entra ID → App registrations → New registration
   - Name: `BusinessOS PM`
   - Redirect URI (Web): `https://<your-supabase-ref>.supabase.co/auth/v1/callback`
   - Under **Certificates & secrets**, create a new client secret
   - Under **API permissions**, ensure `openid`, `email`, `profile` are granted
2. In **Supabase Dashboard** → Authentication → Providers → Azure:
   - Enable the Azure provider
   - Paste your **Application (client) ID**
   - Paste your **Client secret**
   - Set the **Azure Tenant URL** (e.g. `https://login.microsoftonline.com/<tenant-id>`)
3. Ensure callback URLs are configured (see above)

## Email (Resend)
- Sends from: `admin@foundationstoneadvisors.com`
- Used for: task assignment notifications, user invites
- Gracefully degrades — if `RESEND_API_KEY` is not set, emails are skipped with a console log

## Security
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `GITHUB_TOKEN`, or `DOCUSEAL_API_KEY` in `NEXT_PUBLIC_*` variables
- `.env.local` is in `.gitignore` — never commit it
- See `.env.local.example` for the template
