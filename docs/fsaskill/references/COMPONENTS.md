# FSA Branded PDF — Complete Component Library

**This file is the single source of truth for generating FSA branded PDFs.** It contains every import, every color constant, every typography style, every helper function, every page template, and the complete document assembly pattern. Nothing is defined elsewhere. A Claude instance reading this file cold on any machine has everything needed to produce a pixel-perfect FSA branded PDF.

---

## Table of Contents

1. [Imports](#1-imports)
2. [Color Palette](#2-color-palette)
3. [Typography Styles](#3-typography-styles)
4. [Logo Finder](#4-logo-finder)
5. [Cover Page Template](#5-cover-page-template)
6. [Body Page Template](#6-body-page-template)
7. [Component Functions](#7-component-functions)
8. [Data Table Patterns](#8-data-table-patterns)
9. [Document Assembly Pattern](#9-document-assembly-pattern)
10. [Complete Working Example](#10-complete-working-example)
11. [Document Type Guides](#11-document-type-guides)
12. [Formatting Rules](#12-formatting-rules)

---

## 1. Imports

Every FSA PDF script starts with these exact imports. No others are needed.

```python
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    NextPageTemplate, KeepTogether, Image
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
import os
import glob
```

---

## 2. Color Palette

Define as module-level constants. These are the exact FSA brand colors.

```python
NAVY       = HexColor('#1B2A4A')   # Primary brand. Cover bg, section dividers, table headers.
SLATE      = HexColor('#3D5A80')   # Sub-headers, secondary tier bars.
ACCENT     = HexColor('#5B9BD5')   # Accent bars, highlights, primary tier bars.
LIGHT_BG   = HexColor('#F0F4F8')   # Default card header bg, page header strip.
DARK_TEXT   = HexColor('#1A1A2E')   # All body text.
LIGHT_TEXT  = HexColor('#6B7280')   # Footers, metadata.
WHITE      = white
BORDER_GRAY = HexColor('#D1D5DB')  # All borders.
ROW_ALT    = HexColor('#F8FAFC')   # Alternating table rows.
HIGHLIGHT  = HexColor('#E8F0FE')   # Blue info callouts. Recommendations.
GREEN_BG   = HexColor('#F0FDF4')   # Green callouts. Key takeaways, totals.
BLUE_BG    = HexColor('#EFF6FF')   # Blue summary boxes. Closing callouts.
WARM_BG    = HexColor('#FFFBEB')   # Amber callouts. Scope notes, warnings.
```

---

## 3. Typography Styles

Define as module-level constants. Use these exact names — component functions reference them.

```python
# Table cells
tcs = ParagraphStyle('TC', fontName='Helvetica', fontSize=9,
                     leading=12.5, textColor=DARK_TEXT)
tcb = ParagraphStyle('TCB', fontName='Helvetica-Bold', fontSize=9,
                     leading=12.5, textColor=DARK_TEXT)
ths = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9,
                     leading=12, textColor=WHITE)

# Body text
bs = ParagraphStyle('B', fontName='Helvetica', fontSize=10,
                    leading=14.5, textColor=DARK_TEXT,
                    alignment=TA_JUSTIFY, spaceAfter=6)

# Section heading (large, navy)
sh = ParagraphStyle('SH', fontName='Helvetica-Bold', fontSize=13,
                    leading=18, textColor=NAVY,
                    spaceBefore=8, spaceAfter=4)

# Sub-section heading (medium, slate)
ssh = ParagraphStyle('SSH', fontName='Helvetica-Bold', fontSize=11,
                     leading=15, textColor=SLATE,
                     spaceBefore=10, spaceAfter=4)

# Card header text
ahs = ParagraphStyle('AH', fontName='Helvetica-Bold', fontSize=9.5,
                     leading=13, textColor=NAVY)

# Tier bar text (white on color)
thw = ParagraphStyle('THW', fontName='Helvetica-Bold', fontSize=10,
                     leading=14, textColor=WHITE)

# Bullet text
bul = ParagraphStyle('BUL', fontName='Helvetica', fontSize=10,
                     leading=14, textColor=DARK_TEXT,
                     leftIndent=18, spaceBefore=2, spaceAfter=2)
```

---

## 4. Logo Finder

The logo is bundled at `assets/FSA_logo_white.png` (white linework on navy background (#1B2A4A), pre-processed to blend seamlessly with cover page). This function searches multiple possible install locations.

```python
def find_logo():
    """Find FSA logo. Checks skill install paths, then uploads folder."""
    search_paths = [
        '/mnt/skills/user/fsa-branded-pdf/assets/FSA_logo_white.png',
        '/mnt/skills/*/fsa-branded-pdf/assets/FSA_logo_white.png',
        '/mnt/user-data/uploads/FSA_logo_white.png',
        '/mnt/user-data/uploads/FSA_vector_white.png',
    ]
    for pattern in search_paths:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return None
```

If `find_logo()` returns None, the cover page renders without a logo (text-only header). The PDF still generates correctly.

---

## 5. Cover Page Template

The cover page layout from top to bottom:
1. Thin blue accent bar at very top (8px)
2. "FOUNDATION STONE ADVISORS" left + "Date | Doc Type" right
3. Thin divider line
4. Large logo (2.4 inches, left-aligned at margin)
5. Flowable content area: PROPOSAL label, title, prepared for/by blocks
6. Thin blue accent bar at very bottom (4px)
7. Footer: "Confidential | FSA" left + tagline right

```python
def draw_cover_page(canvas, doc):
    """FSA branded cover page. Requires DOC_DATE and DOC_TYPE module-level vars."""
    w, h = letter

    # Navy background
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)

    # Top accent bar
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 8, w, 8, fill=1, stroke=0)

    # Header text at top
    canvas.setFillColor(HexColor('#B0C4DE'))
    canvas.setFont('Helvetica', 10)
    canvas.drawString(55, h - 50, 'FOUNDATION STONE ADVISORS')
    canvas.setFillColor(HexColor('#8899AA'))
    canvas.setFont('Helvetica', 9)
    canvas.drawRightString(w - 55, h - 50, f'{DOC_DATE}  |  {DOC_TYPE}')

    # Divider line below header
    canvas.setStrokeColor(HexColor('#3D5A80'))
    canvas.setLineWidth(0.5)
    canvas.line(55, h - 60, w - 55, h - 60)

    # Large left-aligned logo below header
    logo_path = find_logo()
    if logo_path:
        logo_size = 2.4 * inch
        canvas.drawImage(logo_path, 55, h - 65 - logo_size,
                        width=logo_size, height=logo_size,
                        preserveAspectRatio=True)

    # Bottom accent bar
    canvas.setFillColor(ACCENT)
    canvas.rect(0, 0, w, 4, fill=1, stroke=0)

    # Bottom footer
    canvas.setFillColor(HexColor('#6B7F99'))
    canvas.setFont('Helvetica', 8)
    canvas.drawString(55, 25, 'Confidential  |  Foundation Stone Advisors  |  Orange Park, FL')
    canvas.drawRightString(w - 55, 25, 'Pouring the Foundation for Your Success')
```

### Required Module-Level Variables

Define these BEFORE calling `doc.build()`:

```python
DOC_DATE = 'March 2026'                              # Shown on cover top-right
DOC_TYPE = 'Combined Proposal'                        # Shown on cover top-right
DOC_HEADER = 'Legacy In Action  -  Combined Proposal' # Shown on body page headers
```

---

## 6. Body Page Template

Every page after the cover. Header strip with FSA name + doc title. Footer with confidentiality + page number.

```python
def draw_body_page(canvas, doc):
    """Standard body page. Requires DOC_HEADER module-level var."""
    w, h = letter

    # Top navy line (3px)
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 3, w, 3, fill=1, stroke=0)

    # Light header strip
    canvas.setFillColor(LIGHT_BG)
    canvas.rect(0, h - 38, w, 35, fill=1, stroke=0)

    # Header text
    canvas.setFillColor(NAVY)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(55, h - 28, 'FOUNDATION STONE ADVISORS')
    canvas.setFillColor(LIGHT_TEXT)
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(w - 55, h - 28, DOC_HEADER)

    # Footer line
    canvas.setStrokeColor(BORDER_GRAY)
    canvas.setLineWidth(0.5)
    canvas.line(55, 40, w - 55, 40)

    # Footer text
    canvas.setFillColor(LIGHT_TEXT)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(55, 28, 'Confidential  |  Foundation Stone Advisors')
    canvas.drawRightString(w - 55, 28, f'Page {doc.page}')

    # Bottom accent line (2px)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, 0, w, 2, fill=1, stroke=0)
```

---

## 7. Component Functions

### sdiv() — Section Divider

Full-width navy bar with white uppercase text. Separates major document sections.

```python
def sdiv(text):
    s = ParagraphStyle('dv', fontName='Helvetica-Bold', fontSize=12,
                       leading=16, textColor=WHITE)
    tb = Table([[Paragraph(text.upper(), s)]], colWidths=[6.5 * inch])
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return tb
```

Usage: `S.append(sdiv('Executive Summary'))` followed by `S.append(Spacer(1, 10))`

### card() — Two-Row Card with KeepTogether

Colored header row + white body row. Used for priorities, scope items, action items.

```python
def card(header, body, bg=LIGHT_BG):
    """bg options: LIGHT_BG (default), GREEN_BG (key items), HIGHLIGHT (info), WARM_BG (warnings)"""
    d = [[Paragraph(f'<b>{header}</b>', ahs)],
         [Paragraph(body, tcs)]]
    t = Table(d, colWidths=[6.3 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), bg),
        ('BACKGROUND', (0, 1), (0, 1), WHITE),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return KeepTogether([t, Spacer(1, 4)])
```

### box() — Callout Box

Single-cell colored box for callouts, notes, summaries.

```python
def box(text, bg=HIGHLIGHT, tc=DARK_TEXT):
    """bg: HIGHLIGHT (blue info), GREEN_BG (key), WARM_BG (warning), BLUE_BG (closing)
       tc: DARK_TEXT (default), NAVY (use with BLUE_BG for closing boxes)"""
    s = ParagraphStyle('bx', fontName='Helvetica', fontSize=10,
                       leading=14, textColor=tc)
    tb = Table([[Paragraph(text, s)]], colWidths=[6.3 * inch])
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    return tb
```

Common patterns:
- Key takeaway: `box('<b>Bottom Line:</b> ...', GREEN_BG)`
- Info note: `box('<b>Note:</b> ...', HIGHLIGHT)`
- Warning: `box('<b>Scope Note:</b> ...', WARM_BG)`
- Closing: `box('<b>Foundation Stone Advisors, LLC</b><br/>Pouring the Foundation...', BLUE_BG, NAVY)`

### bullets() — Bullet List

**CRITICAL: Uses `<bullet>&bull;</bullet>` XML entity. NEVER use raw UTF-8 bullet characters — they render as garbled `â–c` text.**

```python
def bullets(items):
    """items: list of strings. Can include <b>, <i> HTML tags."""
    rows = [[Paragraph(f'<bullet>&bull;</bullet>  {b}', bul)] for b in items]
    t = Table(rows, colWidths=[6.3 * inch])
    t.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return t
```

### tier() — Project Tier Bar

Colored bar for major project sections.

```python
def tier(text, color):
    """color: ACCENT (primary project), SLATE (secondary project)"""
    tb = Table([[Paragraph(text, thw)]], colWidths=[6.5 * inch])
    tb.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    return tb
```

Usage: `S.append(tier('PROJECT 1  -  Marketing &amp; Digital Presence', ACCENT))`

---

## 8. Data Table Patterns

### Two-Column Investment Table

```python
data = [
    [Paragraph('<b>Item</b>', ths), Paragraph('<b>Amount</b>', ths)],
    [Paragraph('Line item 1', tcs), Paragraph('$1,500.00', tcs)],
    [Paragraph('Line item 2', tcs), Paragraph('$500.00', tcs)],
    [Paragraph('<b>Total</b>', tcb), Paragraph('<b>$2,000.00</b>', tcb)],
]
t = Table(data, colWidths=[4.3 * inch, 2.0 * inch])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), NAVY),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('BACKGROUND', (0, 1), (-1, 1), WHITE),
    ('BACKGROUND', (0, 2), (-1, 2), ROW_ALT),
    ('BACKGROUND', (0, 3), (-1, 3), GREEN_BG),   # total row
    ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ('INNERGRID', (0, 0), (-1, -1), 0.3, BORDER_GRAY),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
```

### Three-Column Tech Stack Table

```python
data = [
    [Paragraph('<b>System</b>', ths),
     Paragraph('<b>Used For</b>', ths),
     Paragraph('<b>Notes</b>', ths)],
    [Paragraph('System Name', tcb),
     Paragraph('Purpose', tcs),
     Paragraph('Details', tcs)],
]
t = Table(data, colWidths=[1.3 * inch, 1.5 * inch, 3.7 * inch])
# Same border/padding style as above
```

### Two-Column Profile Table

```python
data = [
    [Paragraph('<b>Item</b>', ths), Paragraph('<b>Details</b>', ths)],
    [Paragraph('Founded', tcb), Paragraph('Details here', tcs)],
]
t = Table(data, colWidths=[1.3 * inch, 5.2 * inch])
```

### Alternating Row Colors

```python
num_rows = len(data) - 1  # exclude header
alt_styles = [
    ('BACKGROUND', (0, i + 1), (-1, i + 1), ROW_ALT if i % 2 == 0 else WHITE)
    for i in range(num_rows)
]
# Merge: TableStyle([header_styles, *alt_styles, border_styles])
```

---

## 9. Document Assembly Pattern

This is the exact frame and template setup for every FSA PDF.

```python
OUTPUT = '/mnt/user-data/outputs/ClientName_DocType_FSA.pdf'

# Module-level config (customize per document)
DOC_DATE = 'March 2026'
DOC_TYPE = 'Meeting Recap'
DOC_HEADER = 'Client Name  -  Meeting Recap'

w, h = letter

# Cover frame: top 310pt reserved for header + logo drawn by draw_cover_page
cover_frame = Frame(55, 55, w - 110, h - 310 - 55, id='c')
cover_template = PageTemplate(id='c', frames=[cover_frame], onPage=draw_cover_page)

# Body frame: top 105pt reserved for header strip drawn by draw_body_page
body_frame = Frame(55, 55, w - 110, h - 105, id='b')
body_template = PageTemplate(id='b', frames=[body_frame], onPage=draw_body_page)

doc = BaseDocTemplate(OUTPUT, pagesize=letter)
doc.addPageTemplates([cover_template, body_template])

S = []

# ── COVER PAGE CONTENT ──
S.append(Spacer(1, 10))
S.append(Paragraph('PROPOSAL', ParagraphStyle(
    'lbl', fontName='Helvetica', fontSize=14, leading=18, textColor=ACCENT)))
S.append(Spacer(1, 8))
S.append(Paragraph('Document Title Here', ParagraphStyle(
    'CT', fontName='Helvetica-Bold', fontSize=28, leading=34,
    textColor=WHITE, alignment=TA_LEFT)))
S.append(Spacer(1, 6))
# Optional subtitle:
S.append(Paragraph('Subtitle Here', ParagraphStyle(
    'CS', fontName='Helvetica', fontSize=20, leading=26, textColor=ACCENT)))
S.append(Spacer(1, 30))
cvs = ParagraphStyle('cvs', fontName='Helvetica', fontSize=11,
                      leading=17, textColor=HexColor('#90A4BE'))
S.append(Paragraph(
    '<b>Prepared For</b><br/>'
    'Client Name &amp; Description<br/>'
    'Division 1  |  Division 2  |  Division 3', cvs))
S.append(Spacer(1, 30))
S.append(Paragraph(
    '<b>Prepared By</b><br/>'
    'Foundation Stone Advisors, LLC<br/>'
    'March 2026', cvs))

# Switch to body pages
S.append(NextPageTemplate('b'))
S.append(PageBreak())

# ── BODY PAGES ──
# Use components: sdiv(), card(), box(), bullets(), tier()
# Use styles: bs (body), sh (heading), ssh (subheading)
# ...

# ── BUILD ──
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
doc.build(S)
```

### Cover Page Label Options

The small label above the main title sets the document type:
- Proposals: `'PROPOSAL'`
- Meeting Recaps: `'MEETING RECAP'` (or omit the label)
- Audits: `'AUDIT'`
- Reports: `'REPORT'`

### File Naming Convention

`{ClientName}_{DocType}_FSA.pdf`

Examples:
- `VakPak_Meeting_Recap_FSA.pdf`
- `FSA_Legacy_Combined_Proposal.pdf`
- `ReverbChurch_Meeting_Recap_FSA.pdf`
- `TKSE_SEO_Audit_FSA.pdf`
- `JW_Financial_Review_FSA.pdf`

---

## 10. Complete Working Example

This is a minimal but complete FSA PDF. Copy-paste into a Python script and run. It exercises every component.

```python
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    NextPageTemplate, KeepTogether, Image
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
import os, glob

# ── COLORS ──
NAVY=HexColor('#1B2A4A'); SLATE=HexColor('#3D5A80'); ACCENT=HexColor('#5B9BD5')
LIGHT_BG=HexColor('#F0F4F8'); DARK_TEXT=HexColor('#1A1A2E'); LIGHT_TEXT=HexColor('#6B7280')
WHITE=white; BORDER_GRAY=HexColor('#D1D5DB'); ROW_ALT=HexColor('#F8FAFC')
HIGHLIGHT=HexColor('#E8F0FE'); GREEN_BG=HexColor('#F0FDF4'); BLUE_BG=HexColor('#EFF6FF')
WARM_BG=HexColor('#FFFBEB')

# ── CONFIG (customize per document) ──
OUTPUT = '/mnt/user-data/outputs/Example_Report_FSA.pdf'
DOC_DATE = 'March 2026'
DOC_TYPE = 'Example Report'
DOC_HEADER = 'Example Client  -  Example Report'

# ── STYLES ──
tcs=ParagraphStyle('TC',fontName='Helvetica',fontSize=9,leading=12.5,textColor=DARK_TEXT)
tcb=ParagraphStyle('TCB',fontName='Helvetica-Bold',fontSize=9,leading=12.5,textColor=DARK_TEXT)
ths=ParagraphStyle('TH',fontName='Helvetica-Bold',fontSize=9,leading=12,textColor=WHITE)
bs=ParagraphStyle('B',fontName='Helvetica',fontSize=10,leading=14.5,textColor=DARK_TEXT,alignment=TA_JUSTIFY,spaceAfter=6)
sh=ParagraphStyle('SH',fontName='Helvetica-Bold',fontSize=13,leading=18,textColor=NAVY,spaceBefore=8,spaceAfter=4)
ssh=ParagraphStyle('SSH',fontName='Helvetica-Bold',fontSize=11,leading=15,textColor=SLATE,spaceBefore=10,spaceAfter=4)
ahs=ParagraphStyle('AH',fontName='Helvetica-Bold',fontSize=9.5,leading=13,textColor=NAVY)
thw=ParagraphStyle('THW',fontName='Helvetica-Bold',fontSize=10,leading=14,textColor=WHITE)
bul=ParagraphStyle('BUL',fontName='Helvetica',fontSize=10,leading=14,textColor=DARK_TEXT,leftIndent=18,spaceBefore=2,spaceAfter=2)

# ── LOGO ──
def find_logo():
    for pattern in ['/mnt/skills/user/fsa-branded-pdf/assets/FSA_logo_white.png',
                    '/mnt/skills/*/fsa-branded-pdf/assets/FSA_logo_white.png',
                    '/mnt/user-data/uploads/FSA_logo_white.png',
                    '/mnt/user-data/uploads/FSA_vector_white.png']:
        matches = glob.glob(pattern)
        if matches: return matches[0]
    return None

# ── PAGE TEMPLATES ──
def draw_cover_page(canvas, doc):
    w, h = letter
    canvas.setFillColor(NAVY); canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(ACCENT); canvas.rect(0, h-8, w, 8, fill=1, stroke=0)
    # Header text at top
    canvas.setFillColor(HexColor('#B0C4DE')); canvas.setFont('Helvetica', 10)
    canvas.drawString(55, h-50, 'FOUNDATION STONE ADVISORS')
    canvas.setFillColor(HexColor('#8899AA')); canvas.setFont('Helvetica', 9)
    canvas.drawRightString(w-55, h-50, f'{DOC_DATE}  |  {DOC_TYPE}')
    # Divider
    canvas.setStrokeColor(HexColor('#3D5A80')); canvas.setLineWidth(0.5)
    canvas.line(55, h-60, w-55, h-60)
    # Logo below header, left-aligned
    logo = find_logo()
    if logo:
        lsz = 2.4 * inch
        canvas.drawImage(logo, 55, h-65-lsz, width=lsz, height=lsz,
                        preserveAspectRatio=True)
    # Bottom
    canvas.setFillColor(ACCENT); canvas.rect(0, 0, w, 4, fill=1, stroke=0)
    canvas.setFillColor(HexColor('#6B7F99')); canvas.setFont('Helvetica', 8)
    canvas.drawString(55, 25, 'Confidential  |  Foundation Stone Advisors  |  Orange Park, FL')
    canvas.drawRightString(w-55, 25, 'Pouring the Foundation for Your Success')

def draw_body_page(canvas, doc):
    w, h = letter
    canvas.setFillColor(NAVY); canvas.rect(0, h-3, w, 3, fill=1, stroke=0)
    canvas.setFillColor(LIGHT_BG); canvas.rect(0, h-38, w, 35, fill=1, stroke=0)
    canvas.setFillColor(NAVY); canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(55, h-28, 'FOUNDATION STONE ADVISORS')
    canvas.setFillColor(LIGHT_TEXT); canvas.setFont('Helvetica', 8)
    canvas.drawRightString(w-55, h-28, DOC_HEADER)
    canvas.setStrokeColor(BORDER_GRAY); canvas.setLineWidth(0.5)
    canvas.line(55, 40, w-55, 40)
    canvas.setFillColor(LIGHT_TEXT); canvas.setFont('Helvetica', 7)
    canvas.drawString(55, 28, 'Confidential  |  Foundation Stone Advisors')
    canvas.drawRightString(w-55, 28, f'Page {doc.page}')
    canvas.setFillColor(ACCENT); canvas.rect(0, 0, w, 2, fill=1, stroke=0)

# ── COMPONENTS ──
def sdiv(text):
    s=ParagraphStyle('dv',fontName='Helvetica-Bold',fontSize=12,leading=16,textColor=WHITE)
    tb=Table([[Paragraph(text.upper(),s)]],colWidths=[6.5*inch])
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),NAVY),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),12)]))
    return tb

def card(header, body, bg=LIGHT_BG):
    d=[[Paragraph(f'<b>{header}</b>',ahs)],[Paragraph(body,tcs)]]
    t=Table(d,colWidths=[6.3*inch])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(0,0),bg),('BACKGROUND',(0,1),(0,1),WHITE),('BOX',(0,0),(-1,-1),0.5,BORDER_GRAY),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12)]))
    return KeepTogether([t,Spacer(1,4)])

def box(text, bg=HIGHLIGHT, tc=DARK_TEXT):
    s=ParagraphStyle('bx',fontName='Helvetica',fontSize=10,leading=14,textColor=tc)
    tb=Table([[Paragraph(text,s)]],colWidths=[6.3*inch])
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg),('BOX',(0,0),(-1,-1),0.5,BORDER_GRAY),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('LEFTPADDING',(0,0),(-1,-1),14),('RIGHTPADDING',(0,0),(-1,-1),14)]))
    return tb

def bullets(items):
    rows=[[Paragraph(f'<bullet>&bull;</bullet>  {b}',bul)] for b in items]
    t=Table(rows,colWidths=[6.3*inch])
    t.setStyle(TableStyle([('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12)]))
    return t

def tier(text, color):
    tb=Table([[Paragraph(text,thw)]],colWidths=[6.5*inch])
    tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),color),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LEFTPADDING',(0,0),(-1,-1),12)]))
    return tb

# ── ASSEMBLE ──
w, h = letter
cf = Frame(55, 55, w-110, h-310-55, id='c')
ct = PageTemplate(id='c', frames=[cf], onPage=draw_cover_page)
bf = Frame(55, 55, w-110, h-105, id='b')
bt = PageTemplate(id='b', frames=[bf], onPage=draw_body_page)
doc = BaseDocTemplate(OUTPUT, pagesize=letter)
doc.addPageTemplates([ct, bt])
S = []

# Cover
S.append(Spacer(1, 10))
S.append(Paragraph('REPORT', ParagraphStyle('lbl', fontName='Helvetica',
    fontSize=14, leading=18, textColor=ACCENT)))
S.append(Spacer(1, 8))
S.append(Paragraph('Example Report Title', ParagraphStyle('CT',
    fontName='Helvetica-Bold', fontSize=28, leading=34,
    textColor=WHITE, alignment=TA_LEFT)))
S.append(Spacer(1, 6))
S.append(Paragraph('Subtitle Goes Here', ParagraphStyle('CS',
    fontName='Helvetica', fontSize=20, leading=26, textColor=ACCENT)))
S.append(Spacer(1, 30))
cvs = ParagraphStyle('cvs', fontName='Helvetica', fontSize=11,
    leading=17, textColor=HexColor('#90A4BE'))
S.append(Paragraph('<b>Prepared For</b><br/>Example Client', cvs))
S.append(Spacer(1, 30))
S.append(Paragraph('<b>Prepared By</b><br/>Foundation Stone Advisors, LLC<br/>March 2026', cvs))
S.append(NextPageTemplate('b'))
S.append(PageBreak())

# Body
S.append(sdiv('Section One')); S.append(Spacer(1, 10))
S.append(box('<b>Key Finding:</b> Green callout box test.', GREEN_BG))
S.append(Spacer(1, 8))
S.append(box('<b>Note:</b> Blue info callout test.', HIGHLIGHT))
S.append(Spacer(1, 8))
S.append(box('<b>Warning:</b> Amber callout test.', WARM_BG))
S.append(Spacer(1, 8))
S.append(Paragraph('Body text paragraph. Justified Helvetica 10pt.', bs))

S.append(sdiv('Section Two - Cards')); S.append(Spacer(1, 10))
S.append(card('Default Card', 'Light gray header background.'))
S.append(card('Green Card', 'Green header for key items.', GREEN_BG))
S.append(card('Blue Card', 'Blue header for recommendations.', HIGHLIGHT))
S.append(card('Amber Card', 'Amber header for warnings.', WARM_BG))

S.append(sdiv('Section Three - Bullets &amp; Tiers')); S.append(Spacer(1, 10))
S.append(bullets(['First bullet item', 'Second with <b>bold</b>', 'Third item']))
S.append(Spacer(1, 8))
S.append(tier('PRIMARY TIER (ACCENT)', ACCENT))
S.append(Spacer(1, 4))
S.append(tier('SECONDARY TIER (SLATE)', SLATE))

S.append(Spacer(1, 10))
S.append(sdiv('Section Four - Table')); S.append(Spacer(1, 10))
td=[[Paragraph('<b>Item</b>',ths),Paragraph('<b>Amount</b>',ths)],
    [Paragraph('Service A',tcs),Paragraph('$1,500',tcs)],
    [Paragraph('Service B',tcs),Paragraph('$2,500',tcs)],
    [Paragraph('<b>Total</b>',tcb),Paragraph('<b>$4,000</b>',tcb)]]
tt=Table(td,colWidths=[4.3*inch,2.0*inch])
tt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),WHITE),
    ('BACKGROUND',(0,1),(-1,1),WHITE),('BACKGROUND',(0,2),(-1,2),ROW_ALT),
    ('BACKGROUND',(0,3),(-1,3),GREEN_BG),('BOX',(0,0),(-1,-1),0.5,BORDER_GRAY),
    ('INNERGRID',(0,0),(-1,-1),0.3,BORDER_GRAY),('TOPPADDING',(0,0),(-1,-1),6),
    ('BOTTOMPADDING',(0,0),(-1,-1),6),('LEFTPADDING',(0,0),(-1,-1),8),
    ('RIGHTPADDING',(0,0),(-1,-1),8)]))
S.append(tt)

S.append(Spacer(1, 16))
S.append(box('<b>Foundation Stone Advisors, LLC</b><br/>'
    'Pouring the Foundation for Your Success', BLUE_BG, NAVY))

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
doc.build(S)
print(f'PDF generated: {OUTPUT}')
```

---

## 11. Document Type Guides

### Meeting Recap

Cover label: omit or use `'MEETING RECAP'`. Title: `'Client Name'`. Subtitle: `'Meeting Recap &amp; Next Steps'`.

Typical sections:
1. Executive Summary — green box with bottom-line takeaway
2. Company/Church Profile — 2-column profile table (Item | Details)
3. Current Tech Stack — 3-column table (System | Used For | Notes)
4. Vision / What They Want — cards for each feature or goal
5. Readiness &amp; Starting Point — green box assessment + cards
6. Budget &amp; Next Steps — budget table + action item cards
7. Closing opportunity box (BLUE_BG, NAVY text)

### Proposal / SOW

Cover label: `'PROPOSAL'`. Separate project sections with `tier()` bars.

Typical sections:
1. Executive Summary — project overview cards + bullet lists
2. Combined Investment Summary — one-time + monthly tables with GREEN_BG total rows
3. Project 1 SOW — tier bar (ACCENT) + priorities + sections + investment table
4. Project 2 SOW — tier bar (SLATE) + scope cards + deliverables + investment table
5. Next Steps — bullets
6. Closing box (BLUE_BG, NAVY text)

### Audit / Analysis

Cover label: `'AUDIT'` or `'ANALYSIS'`. Title: `'Client - Audit Type'`.

Typical sections:
1. Executive Summary — key findings in green box
2. Current State — data tables, tech stack
3. Findings — numbered cards per finding
4. Recommendations — priority cards
5. Action Items — cards with assignments
6. Closing box

---

## 12. Formatting Rules

| Rule | Detail |
|------|--------|
| Cards, boxes, bullets width | **6.3 inches** — always |
| Section dividers, tier bars width | **6.5 inches** — always |
| KeepTogether on cards | **Required** — prevents header/body page splits |
| Bullet character | **`<bullet>&bull;</bullet>`** XML only. Never raw UTF-8. |
| Bullets in Table | **Required** — wrap in `Table(rows, colWidths=[6.3*inch])` |
| `&` in Paragraph text | Use **`&amp;`** — ReportLab parses HTML |
| Document template | **BaseDocTemplate** — never SimpleDocTemplate |
| Fonts | **Helvetica** family only — no installs needed |
| Output directory | **`/mnt/user-data/outputs/`** — only downloadable path |
| After sdiv() | **`Spacer(1, 10)`** — breathing room |
| Between content types | **`Spacer(1, 8)`** — between text and cards, cards and tables |
| Before major sections | **`PageBreak()`** — clean separation |
| Cover frame height | **`h - 310 - 55`** — accounts for header + 2.4" logo |
| Body frame height | **`h - 105`** — accounts for header strip |
