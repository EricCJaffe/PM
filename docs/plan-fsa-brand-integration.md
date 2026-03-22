# FSA Brand Integration Plan

## Overview
Integrate Foundation Stone Advisors brand design system into the PM app for:
1. Branded HTML-to-PDF document generation (proposals, reports, audits)
2. AI prompt context so GPT-4o produces brand-consistent content
3. Centralized brand config for all document outputs

## Implementation Steps

### Step 1: Brand Config Module (`src/lib/brand.ts`)
- Export FSA color palette, typography specs, component patterns as TS constants
- Match exact values from COMPONENTS.md (Navy #1B2A4A, Accent #5B9BD5, etc.)
- Include brand metadata (company name, tagline, location)
- Export helper functions for generating inline CSS styles

### Step 2: FSA HTML Document Templates (`src/lib/brand-templates.ts`)
- Port the ReportLab component library to HTML/CSS equivalents:
  - Cover page (navy bg, logo, title, prepared for/by)
  - Body page layout (header strip, footer with page info)
  - Section dividers (sdiv → navy bar with white text)
  - Cards (card → colored header + white body)
  - Callout boxes (box → colored background)
  - Bullet lists (bullets → styled list)
  - Tier bars (tier → colored bar)
  - Data tables (alternating rows, navy headers)
- All inline CSS (no external deps) for print/PDF compatibility
- Print CSS media query for clean PDF output

### Step 3: Brand-Aware PDF Route (`src/app/api/pm/brand-pdf/route.ts`)
- POST endpoint that accepts document type + content sections
- Assembles full HTML document using brand templates
- Returns downloadable HTML (same pattern as site-audit PDF)
- Supports: proposal, meeting-recap, audit, report types

### Step 4: AI Brand Context (`src/lib/brand-context.ts`)
- Function that returns FSA brand guidelines as markdown for AI prompts
- Includes: voice/tone, document structure expectations, formatting rules
- Integrate into `assembleKBContext()` or as separate injection point
- Used by proposal generation, report generation, docgen

### Step 5: Store Logo Asset
- Copy FSA_logo_white.png into `public/brand/` for use in HTML documents
- Base64 encode for inline embedding in PDF HTML

### Step 6: Update Existing Document Generation
- Update proposal generate endpoint to include brand context
- Update report generation to include brand formatting guidance
- Update docgen system to use brand templates

### Step 7: Docs
- Update TASKS.md, INTEGRATIONS.md with brand system docs
