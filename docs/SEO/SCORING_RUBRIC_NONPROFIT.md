# SCORING_RUBRIC_NONPROFIT.md
## Nonprofit OS — Site Audit Scoring Rubric
## Version: 1.0 | Last updated: 2026-03-20

> Used to audit websites for nonprofits, faith-based organizations,
> and community service organizations.

---

## Grade thresholds
| Score | Grade |
|---|---|
| 90–100% | A |
| 80–89% | B |
| 70–79% | C |
| 60–69% | D |
| Below 60% | F |

---

## Dimension 1 — SEO (Weight: 20%)

| Criterion | Points | Pass condition |
|---|---|---|
| Page title includes org name + mission area | 10 | "Jacksonville Food Bank — Fighting Hunger" style |
| Meta description exists | 10 | 120–160 chars |
| H1 has mission clarity | 10 | States what org does for whom |
| Location or service area on every page | 10 | City or region clearly stated |
| Page count adequate | 15 | 8+ pages = full, 4-7 = half, under 4 = zero |
| Program or service pages exist | 15 | One page per major program |
| Blog or news content | 10 | Any dated content |
| Sitemap and robots.txt | 5 | Both present |
| Google Business or local citations | 10 | GMB or consistent directory presence |
| Mission keywords in copy | 5 | Natural use of cause-related terms |

**Total: 100 points**

---

## Dimension 2 — Entity Authority (Weight: 15%)

| Criterion | Points | Pass condition |
|---|---|---|
| Org name consistent everywhere | 15 | Exact match across all platforms |
| Full contact info on every page | 15 | Address + phone + email |
| 501(c)(3) status visible | 15 | EIN or "registered nonprofit" stated |
| Leadership page with photos and bios | 15 | Executive director + board if applicable |
| Annual report or impact data | 15 | Numbers, outcomes, lives served |
| Social proof from beneficiaries | 10 | Stories, quotes, or testimonials |
| Partner or funder logos | 10 | Third-party credibility signals |
| Media coverage links | 5 | Press mentions or awards |

**Total: 100 points**

---

## Dimension 3 — AI Discoverability (Weight: 20%)

| Criterion | Points | Pass condition |
|---|---|---|
| Mission statement answerable from homepage | 20 | "What does [org] do?" answered in first paragraph |
| Programs page with clear descriptions | 15 | Each program explained plainly |
| FAQ section | 10 | At least 4 questions on key pages |
| Schema markup (Organization + NGO) | 15 | Validated structured data |
| llms.txt exists | 10 | Plain-text org summary at /llms.txt |
| Impact data in structured format | 15 | Numbers AI can cite |
| Geography of service stated clearly | 10 | AI can confirm who and where is served |
| How to get help — clearly answered | 5 | Intake/application process visible |

**Total: 100 points**

---

## Dimension 4 — Conversion Architecture (Weight: 20%)

| Criterion | Points | Pass condition |
|---|---|---|
| Primary CTA matches org type | 15 | "Donate" / "Volunteer" / "Get Help" as appropriate |
| Donate button above the fold | 15 | Visible without scrolling |
| Online giving functional | 20 | Clicking donate leads to working payment flow |
| Volunteer signup form exists | 15 | Captures name, availability, interests |
| Program application or intake | 10 | How to receive services is clear |
| Mid-page CTAs | 10 | At least one CTA after hero |
| Mobile-responsive | 10 | Works on phone |
| Impact shown near donation CTA | 5 | "Your $50 feeds a family for a week" type language |

**Total: 100 points**

---

## Dimension 5 — Content (Weight: 15%)

**Page inventory:**

| Page | Points |
|---|---|
| Home | 5 |
| About / Mission | 10 |
| Programs / Services hub | 10 |
| Individual program pages (per program) | 8 each, max 24 |
| Get Involved / Volunteer | 10 |
| Donate / Give | 10 |
| Impact / Annual report | 10 |
| News / Blog | 5 |
| Contact | 5 |
| Board / Leadership | 5 |
| FAQ | 5 |
| How to get help / Apply | 5 (if service-providing org) |

**Total: 100 points**

---

## Dimension 6 — A2A Readiness (Weight: 10%)

| Criterion | Points | Pass condition |
|---|---|---|
| Donate flow at stable URL | 20 | Direct link to giving page, no redirect loops |
| DonateAction schema on give page | 20 | Valid schema with target URL |
| Volunteer signup at stable URL | 15 | Direct form link |
| Event registration stable URLs | 15 | Each event has own URL |
| Program application structured | 15 | Form captures enough info to process |
| AI chat for basic questions | 15 | Can answer "how do I volunteer?" |

**Total: 100 points**

---

## Overall score calculation

```
Overall = (SEO × 0.20) + (Entity × 0.15) + (AI × 0.20) + (Conversion × 0.20) + (Content × 0.15) + (A2A × 0.10)
```

---

## Quick wins trigger rules

| Finding | Quick win | Time |
|---|---|---|
| Donate button buried | Move to nav and hero | 30 min |
| No impact numbers on homepage | Add "X people served" stat | 1 hour |
| No 501c3 mention | Add to footer | 15 min |
| Programs not on separate pages | Create one page per program | 2 hours |
| No volunteer form | Add simple availability form | 1 hour |
| No meta descriptions | Add unique descriptions | 1 hour |
| Annual report not linked | Link from About page | 15 min |

---

## Rebuild trigger rules

Recommend full rebuild when:
- Overall grade D or below
- No online giving functionality
- No program pages
- Impact data completely absent
- Built on outdated platform with no mobile support
