# AUDIT_PDF_SPEC.md
## Site Audit Report — PDF Output Specification
## Version: 1.0 | Last updated: 2026-03-20

> This file tells Claude exactly what the audit PDF should look like,
> what every page contains, and how to generate it.
> Reference this alongside SCORING_INDEX.md and the rubric files.
> The Resonate Church Jax audit (March 2026) is the canonical example.

---

## Design system

### Colors
| Name | Hex | Use |
|---|---|---|
| Dark green | #1c2b1e | Page header bar, section headers, cover background |
| Mid green | #2e4030 | Table headers (secondary) |
| Light green | #f5f0e8 | Page background, alternating table rows |
| Amber | #c4793a | Accent bar under header, callout borders, grade highlights |
| Amber light | #f5e6d8 | Callout box backgrounds |
| Text dark | #1a1a1a | Body text |
| Text mid | #4a5e4c | Secondary body text |
| Text muted | #7a8874 | Captions, metadata |
| Border | #ddd8cc | Table borders, dividers |
| Red grade | #c0392b | D and F grades |
| Amber grade | #d68910 | C grades |
| Green grade | #1e8449 | A and B grades |

### Typography
- **Display / headings:** Helvetica Bold
- **Body:** Helvetica
- **Italic / callouts:** Helvetica Oblique
- **Page header:** 10pt bold, white on dark green
- **H1 (section titles):** 20pt bold, dark green
- **H2 (subsection titles):** 14pt bold, dark green
- **H3 (dimension labels):** 11pt bold, amber
- **Body text:** 10pt, 16pt leading
- **Table header text:** 9pt bold, white
- **Table body text:** 9pt regular
- **Callout text:** 10pt italic, dark green

### Page layout
- **Page size:** US Letter (8.5" × 11")
- **Margins:** 0.5" all sides
- **Header bar:** 44px dark green strip at top of every page except cover
- **Footer bar:** 30px light green strip at bottom of every page
- **Header content:** Report title left, date right, amber 2px accent line below
- **Footer content:** Confidentiality note left, page number right

---

## Page structure

### Page 1 — Cover page

**Full-page dark green background with subtle grid texture.**

Elements top to bottom:
1. **Eyebrow label** — "WEBSITE AUDIT REPORT" in amber, 9pt, letter-spaced
2. **Organization name** — 38pt Helvetica Bold, light cream (#f0ebe0)
3. **Domain** — 26pt Helvetica regular, muted green (#9aaa90)
4. **Subtitle** — "Gap Analysis · Refactor Plan · Rebuild Recommendation" — 11pt muted
5. **Score badges row** — six boxes, one per dimension, showing letter grade in red/amber/green
   - Each badge: 64×52px, dark background (#1e3020), grade in 18pt, label in 8pt below
   - Order: SEO | Entity | AI Search | Conversion | Content | A2A
6. **Footer meta** — "Month Year · City, State · Prepared by [Agency Name]" — 9pt muted

**No header or footer bar on cover page.**

---

### Page 2 — Executive Summary

**Sections:**
1. **"Executive Summary"** — H1
2. **Horizontal rule** — 0.5px border color
3. **Summary paragraph** — 2–3 sentences describing the site's overall state
4. **Callout box** — amber left border, amber light background, italic quote summarizing the core recommendation
5. **"Overall Scores" subheading** — H2
6. **Score summary table** — 3 columns: Category | Grade | Key Finding

**Score summary table format:**
| Column | Width | Style |
|---|---|---|
| Category | 1.4" | Bold, dark text |
| Grade | 0.7" | Bold, colored by grade (red/amber/green), centered |
| Key Finding | Remaining | Regular, mid text |

Table header: dark green background, white text.
Alternating rows: white and light green (#f5f3ee).

---

### Pages 3–8 — One page per scoring dimension

**Each dimension page follows the same structure:**

1. **Section header bar** — full-width dark green rounded rectangle
   - Text: "N · [Dimension Name]" — 13pt bold white
2. **"Overall Grade: X"** — H3 in amber
3. **Optional introductory paragraph** — for dimensions needing context (AI Search, A2A)
4. **Gap analysis table** — columns vary by dimension (see below)
5. **Callout box** — key takeaway in italic, amber border

**Standard gap table columns:**
| Item | Current State | Standard | Gap |
- 4 columns
- Header: mid green (#2e3d2f), white text, 8pt bold
- Rows: alternating white and light green (#f5f3ee)
- Cell padding: 6–8px
- Font: 8pt, top-aligned

**Content page (Dimension 5) uses different table:**
| Page | Status | What's Missing |
- "Status" column shows "Exists" or "Missing" in bold
- "Missing" pages in red, "Exists" pages in dark text

**A2A page (Dimension 6) uses:**
| Item | Current State | Standard / Recommended |
- 3 columns instead of 4

---

### Page 9 — Rebuild Recommendation

**Sections:**

1. **Section header bar** — "7 · Rebuild Recommendation"
2. **"Platform" subheading** — H2
3. **Side-by-side comparison table** — 2 columns: Current | Recommended
   - Current column: light red background (#fef5f5)
   - Recommended column: light green background (#f0f8f0)
   - Equal width columns
4. **"Pages to Build — Priority Order" subheading** — H2
5. **Priority table** — columns: Pri | Page | URL | Notes
   - P0 rows: standard styling
   - P1 rows: standard styling
   - P2 rows: standard styling
6. **"Rebuild Timeline" subheading** — H2
7. **Timeline table** — columns: Phase | Focus | Deliverables

---

### Page 10 (if needed) — Timeline continuation

If rebuild timeline content overflows page 9, continue here.
Same section header pattern.

---

### Last page — Quick Wins and Next Steps

**Sections:**

1. **Section header bar** — "8 · Quick Wins & Next Steps"
2. **"Quick wins on the current platform" subheading** — H2
   - Subtext: "(if full rebuild not immediately approved)"
3. **Quick wins table** — columns: Action | Time | Impact
4. **Callout box** — recommended client opening line, amber border
   - Style: italic, 10pt, dark green text on amber light background

---

### Mockup section (appended after audit)

**Page: Mockup Cover**

Same dark green full-page background as audit cover.

Elements:
1. **Eyebrow** — "WEBSITE MOCKUP — REBUILT SITE CONCEPT" in amber, letter-spaced
2. **Org name + "Redesigned."** — large Playfair Display or Helvetica Bold, italic accent
3. **Description** — what the mockup shows, 2–3 sentences, muted green
4. **Footer meta** — date, city, agency name

**Pages: Mockup HTML rendered to PDF**

The rebuilt site mockup HTML is rendered to PDF via weasyprint or Puppeteer.
Page size: 900px wide, auto height.
Each section of the mockup becomes one or more PDF pages.

---

## Combined PDF structure

The final deliverable PDF combines:

```
Page 1:    Cover (audit)
Page 2:    Executive Summary + Overall Scores
Page 3:    SEO dimension
Page 4:    Entity Authority dimension
Page 5:    AI Discoverability dimension
Page 6:    Conversion Architecture dimension
Page 7:    Content Inventory dimension
Page 8:    A2A Readiness dimension
Page 9-10: Rebuild Recommendation + Timeline
Page 11:   Quick Wins + Next Steps
Page 12:   Mockup cover
Page 13+:  Mockup HTML pages
```

---

## Generation method

**Library:** Python with `reportlab` (audit pages) + `weasyprint` (mockup HTML)
**Merge:** `pypdf` PdfWriter to combine both PDFs into one file
**Output:** Single downloadable PDF, named `[org-slug]-site-audit-[YYYY-MM-DD].pdf`
**Storage:** Save to Supabase Storage bucket `documents` at path `[org-slug]/audits/[filename]`

**Reference implementation:** `build_pdfs.py` (generated March 2026 for Resonate Church Jax)
That script is the working proof of concept — port it to the PM tool API route.

---

## Customization per engagement

Before generating, replace these tokens:
| Token | Replace with |
|---|---|
| `[Organization Name]` | Client org name |
| `[domain]` | Client website URL |
| `[City, State]` | Client location |
| `[Month Year]` | Current month and year |
| `[Agency Name]` | Your agency name (Foundation Stone Advisors) |
| `[org-slug]` | Kebab-case org slug from pm_organizations |

---

## Quality checklist before sending to client

- [ ] Cover page shows correct org name and domain
- [ ] All six grade badges show correct grades from scoring
- [ ] Each dimension page matches the scores from SCORING_INDEX output
- [ ] Quick wins are specific and actionable — not generic
- [ ] Rebuild recommendation matches overall score (D or below = recommend rebuild)
- [ ] Mockup reflects the client's actual content (real pastor names, real service times, real address)
- [ ] Agency name is correct in cover and footer
- [ ] PDF is under 5MB for easy email delivery
- [ ] Both sections (audit + mockup) are in the combined file
