---
name: fsa-branded-pdf
description: Generate professional branded PDF documents for Foundation Stone Advisors (FSA). Use this skill whenever user asks for a branded PDF, client deliverable, proposal, meeting recap, audit, report, plan, or any document that should carry FSA branding. Also trigger when creating PDFs for any FSA client or when the user mentions "branded PDF", "FSA PDF", "client deliverable", or "proposal". This skill defines FSA's exact color palette, page templates, typography, and reusable component library for ReportLab-based PDF generation.
---

# FSA Branded PDF Generation Skill

## What This Skill Does

This skill generates professional, branded PDF documents for Foundation Stone Advisors (FSA) using Python's ReportLab library. Every FSA client deliverable — proposals, meeting recaps, audits, reports, plans, SOWs — uses this system to produce a consistent visual identity.

## When to Use

- User asks for any branded PDF, client deliverable, proposal, report, recap, audit, or plan
- User mentions "FSA PDF", "branded PDF", or "client deliverable"
- Any document is being created for an FSA client
- User wants to rebuild, reformat, or brand an existing document

## How to Use

1. **Read `references/COMPONENTS.md` first** — it is the single source of truth. Contains every import, every color, every style, every function, every page template, and a complete working example. Nothing is defined elsewhere.
2. **Read `references/LOGO_PREP.md`** if the logo asset needs preprocessing (first-time setup only).
3. Assemble document content using the components.
4. Write to `/mnt/user-data/outputs/` and present with `present_files`.

## File Inventory

| File | Purpose |
|------|---------|
| `SKILL.md` | This file. Trigger description and routing. |
| `references/COMPONENTS.md` | **THE source of truth.** All code, all patterns, complete working example. |
| `references/LOGO_PREP.md` | One-time logo preprocessing: replace black bg with navy (#1B2A4A). |
| `assets/FSA_logo_white.png` | Pre-processed logo: white linework on navy bg (#1B2A4A). Blends with cover. |

## Brand Identity Quick Reference

- **Company:** Foundation Stone Advisors, LLC
- **Tagline:** "Pouring the Foundation for Your Success"
- **Location:** Orange Park, FL
- **Primary Color:** Navy `#1B2A4A`
- **Accent Color:** Blue `#5B9BD5`
- **Logo:** White linework on navy bg (#1B2A4A), left-aligned on cover, 2.4 inches

## Critical Rules

1. **Read COMPONENTS.md first** — every time, no exceptions
2. **Never use raw UTF-8 bullet characters** — use `<bullet>&bull;</bullet>` XML
3. **Always wrap cards in KeepTogether()** — prevents page-break splits
4. **Consistent widths** — cards/bullets/boxes = 6.3", dividers/tiers = 6.5"
5. **BaseDocTemplate only** — not SimpleDocTemplate
6. **Helvetica only** — no custom fonts needed
7. **Output to /mnt/user-data/outputs/** then present_files

## Dependencies

This skill requires Python libraries that are **pre-installed in Claude's environment** — no manual installation needed:

| Library | Used For | Notes |
|---------|----------|-------|
| `reportlab` | All PDF generation | Core dependency. Provides canvas, platypus, styles, page templates. |
| `Pillow` (PIL) | Logo preprocessing only | Only needed if regenerating logo from original (see LOGO_PREP.md). |
| `numpy` | Logo preprocessing only | Only needed if regenerating logo from original (see LOGO_PREP.md). |

If running outside Claude's environment (e.g., local Python), install with: `pip install reportlab Pillow numpy`
