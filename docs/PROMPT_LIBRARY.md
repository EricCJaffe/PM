# PROMPT_LIBRARY.md — What Works on This Codebase

> Prompts and patterns that reliably get Claude to build the right thing on BusinessOS PM.
> Claude reads this before writing any code — checks here first before reinventing.
> Add entries by saying "Save this to the prompt library."

---

## How to add
Say: "Save this prompt to the library"
Claude formats and appends automatically.

---

## Categories
- Migrations and RLS
- Vault operations
- AI report generation
- Document generation
- API routes
- Frontend components
- DocuSeal integration
- Debugging and recovery

---

## Migrations and RLS
[entries will appear here]

---

## Vault operations
[entries will appear here]

---

## AI report generation
[entries will appear here]

---

## Document generation

### Creating a New Document Template (eSign-Ready)
**Category:** Document generation + DocuSeal integration
**Added:** 2026-03-26 by claude
**Reliability:** ★★★★★

**Situation:** When adding a new document type (MSA, NDA, SOW, etc.) that needs FSA branding and DocuSeal eSign support.

**Pattern — every new template needs these 5 things:**

1. **Seed SQL file** (`supabase/seeds/seed-docgen-[slug].sql`):
   - `INSERT INTO document_types` with slug, name, category, html_template, css_styles, header_html, footer_html, variables
   - `DELETE + INSERT INTO document_intake_fields` for the form fields
   - Use `ON CONFLICT (slug) DO UPDATE` for safe re-runs

2. **HTML template** must include:
   - `<div class="document">` wrapper
   - Cover page with FSA branding (`cover-page`, `cover-accent`, `cover-body`)
   - `{{#each sections}}...{{/each}}` block for editable body sections
   - **`<div class="signature-block">`** with `sig-row`/`sig-col` structure — this is what `injectSignatureFields()` finds and replaces at eSign time
   - `{{variable}}` placeholders matching intake field keys

3. **CSS** must reuse FSA brand variables:
   ```css
   :root { --fsa-navy: #1B2A4A; --fsa-slate: #3D5A80; --fsa-accent: #5B9BD5; ... }
   ```
   Plus all standard classes: `.cover-page`, `.section`, `.section-divider`, `.signature-block`, `.sig-row`, `.sig-col`, `.sig-label`, `.sig-line`, `.sig-name`, `.sig-title`, `.sig-date`

4. **Variables JSON** — sections array in the `variables` column:
   - Each section: `{"section_key", "title", "sort_order", "default_content"}`
   - `default_content` is optional — if provided, sections are pre-populated at creation time (good for legal templates like NDA). If empty, user fills via AI generation or manual editing.

5. **Intake fields** — standard field keys that the eSign route depends on:
   - **Required for eSign:** `client_contact_name`, `client_contact_email`, `prepared_by`
   - **Optional but recommended:** `client_contact_title`, `provider_title`, `client_name`
   - Without these, the signature block won't show names/titles

**What happens at eSign time (automatic — no template changes needed):**
- `injectSignatureFields()` in `src/lib/esign.ts` finds `<div class="signature-block">` and replaces it with DocuSeal `<signature-field>`, `<date-field>`, and `<text-field>` tags
- Names/titles pre-filled from intake data
- Both Client + Provider blocks always rendered

**Reference files:**
- SOW: `supabase/seeds/seed-docgen.sql`
- NDA: `supabase/seeds/seed-docgen-nda.sql`
- eSign logic: `src/lib/esign.ts` → `injectSignatureFields()`
- Doc creation: `src/app/api/pm/docgen/route.ts` (reads `default_content`)

**Gotchas:**
- The signature block CSS class name must be exactly `signature-block` — the injection uses `indexOf()` to find it
- Intake field keys must match what the esign route reads (`client_contact_name`, `client_contact_email`, `prepared_by`)
- Don't put DocuSeal field tags in the template — they're injected automatically at send time

---

## API routes
[entries will appear here]

---

## Frontend components
[entries will appear here]

---

## DocuSeal integration

### How Signature Fields Get Injected
**Added:** 2026-03-26 by claude
**Reliability:** ★★★★★

**The chain:** Template HTML → Compile (fills {{variables}}) → eSign button → `injectSignatureFields()` → DocuSeal API

**Key function:** `injectSignatureFields(html, clientInfo, providerInfo)` in `src/lib/esign.ts`
- Finds `<div class="signature-block">` by string match
- Counts nested `<div>`/`</div>` to find the matching close tag
- Replaces the entire block with DocuSeal field tags:
  - `<signature-field name="..." role="..." required="true">` — signature pad
  - `<date-field name="..." role="..." required="true">` — date picker
  - `<p class="sig-name">` — pre-filled name text (not a field, just display)
  - `<p class="sig-title">` — pre-filled title (if available)
- Each field has a `role` attribute matching the DocuSeal submitter role
- If no signature block found, appends before `</body>`

**DocuSeal API format:** `POST /submissions/html` with `documents: [{name, html}]` array
**Submitter roles:** Must match the `role` attributes on field tags (e.g. "Client", "Provider")

---

## Debugging and recovery
[entries will appear here]

---

## Entry template
```
### [Title]
**Category:** [from list above]
**Added:** [YYYY-MM-DD] by [handle]
**Reliability:** [1-5 stars]

**Situation:** [when to use this — be specific]

**The prompt:**
[exact prompt — use [BRACKETS] for swappable parts]

**What Claude produces:** [describe output quality and structure]
**Gotchas:** [what breaks this or needs adjustment]
```

---

## Patterns that do not work
[entries will appear here — saves team from repeating failures]
