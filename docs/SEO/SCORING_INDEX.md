# SCORING_INDEX.md
## Site Audit Scoring System — Master Index
## Version: 1.0 | Last updated: 2026-03-20

> This is the entry point for the site audit scoring system.
> Import this file and the rubric files into the PM tool scoring engine.
> The audit tool reads these files to know how to score any site.

---

## Available rubrics

| Vertical | File | Use when |
|---|---|---|
| Church / Ministry | SCORING_RUBRIC_CHURCH.md | Church, ministry, faith community |
| Agency / Web Dev | SCORING_RUBRIC_AGENCY.md | Agency, consultancy, professional services |
| Nonprofit | SCORING_RUBRIC_NONPROFIT.md | Nonprofit, charity, community org |

---

## Six scoring dimensions (all verticals)

Every audit scores across the same six dimensions. Weights vary slightly by vertical.

| # | Dimension | What it measures | Weight |
|---|---|---|---|
| 1 | SEO | Can people find this site on Google? | 20% |
| 2 | Entity Authority | Does the web trust this organization is real? | 15% |
| 3 | AI Discoverability | Can AI systems understand and recommend this org? | 20% |
| 4 | Conversion Architecture | Does the site convert visitors into action? | 20% |
| 5 | Content | Are the right pages present with real content? | 15% |
| 6 | A2A Readiness | Can AI agents take action on behalf of visitors? | 10% |

---

## Grade scale

| % Score | Letter Grade | Meaning |
|---|---|---|
| 90–100 | A | Best practice — minor polish only |
| 80–89 | B | Strong — 1-2 specific gaps to fix |
| 70–79 | C | Adequate — structural improvements needed |
| 60–69 | D | Weak — significant rebuild or refactor needed |
| 50–59 | D- | Poor — foundational problems throughout |
| 0–49 | F | Critical — not competitive, recommend full rebuild |

---

## Audit output format

Every audit produces:

```json
{
  "url": "https://example.com",
  "vertical": "church",
  "scores": {
    "seo": { "grade": "D", "score": 62, "weight": 0.20 },
    "entity": { "grade": "C-", "score": 68, "weight": 0.15 },
    "ai_discoverability": { "grade": "F", "score": 28, "weight": 0.20 },
    "conversion": { "grade": "D+", "score": 65, "weight": 0.20 },
    "content": { "grade": "D", "score": 60, "weight": 0.15 },
    "a2a": { "grade": "F", "score": 15, "weight": 0.10 }
  },
  "overall": { "grade": "D", "score": 53 },
  "quick_wins": [...],
  "rebuild_recommended": true,
  "pages_missing": [...],
  "pages_present": [...]
}
```

---

## Rebuild decision logic

```
if overall_score < 60:
    recommend = "Full rebuild"
elif overall_score < 70:
    recommend = "Significant refactor"
elif overall_score < 80:
    recommend = "Targeted improvements"
else:
    recommend = "Optimization only"

if ai_discoverability_score < 50:
    flag = "AI search invisible — priority fix regardless of overall score"

if content_score < 40:
    flag = "Too few pages to compete — content expansion required"

if platform in ["The Church Co", "Wix basic", "Weebly", "Squarespace basic"]:
    flag = "Platform limits — schema and SEO ceiling reached, rebuild recommended"
```

---

## How to use in the PM tool

1. User opens a `pm_engagement` record for a prospective client
2. Clicks "Run Site Audit"
3. Enters URL and selects vertical
4. System fetches URL and scores against the relevant rubric file
5. Stores results in `pm_site_audits` table
6. Displays scored report in UI
7. User clicks "Generate PDF" → audit report + mock-up
8. User clicks "Create Proposal" → pre-fills proposal with audit findings

---

## Claude prompt for scoring (use in API route)

```
You are a website audit specialist. Score the following website against the
[VERTICAL] scoring rubric.

Website URL: [URL]
Fetched content: [HTML/text content]
Rubric: [paste SCORING_RUBRIC_[VERTICAL].md content]

Return ONLY valid JSON matching this structure:
{
  "scores": {
    "seo": { "grade": "X", "score": 0-100, "findings": ["finding 1", "finding 2"] },
    "entity": { "grade": "X", "score": 0-100, "findings": [] },
    "ai_discoverability": { "grade": "X", "score": 0-100, "findings": [] },
    "conversion": { "grade": "X", "score": 0-100, "findings": [] },
    "content": { "grade": "X", "score": 0-100, "findings": [], "pages_found": [], "pages_missing": [] },
    "a2a": { "grade": "X", "score": 0-100, "findings": [] }
  },
  "quick_wins": [{ "action": "X", "time_estimate": "X", "impact": "X" }],
  "rebuild_recommended": true/false,
  "rebuild_reason": "X"
}

Be conservative — only give full credit when a criterion is clearly met.
Grade thresholds: A=90+, B=80-89, C=70-79, D=60-69, F=below 60.
```
