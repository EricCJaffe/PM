# SCORING_RUBRIC_AGENCY.md
## Agency OS — Site Audit Scoring Rubric
## Version: 1.0 | Last updated: 2026-03-20

> Used to audit websites for agencies, web development shops,
> automation consultancies, and professional services firms.

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
| Page title includes service + location | 10 | "Web Development Jacksonville FL" style |
| Meta description on every page | 10 | 120–160 chars, compelling, unique per page |
| H1 has service + value prop | 10 | Not just company name |
| Address or service area on every page | 10 | "Serving Jacksonville and Northeast FL" acceptable |
| Page count adequate | 15 | 10+ pages = full, 5-9 = half, under 5 = zero |
| Service-specific pages exist | 15 | One page per core service |
| Blog or case studies exist | 10 | Any dated content = full credit |
| XML sitemap and robots.txt | 5 | Both present |
| Google Business Profile or local signals | 10 | GMB claimed or consistent local citations |
| Target keywords in body copy | 5 | Service + city language natural in copy |

**Total: 100 points**

---

## Dimension 2 — Entity Authority (Weight: 15%)

| Criterion | Points | Pass condition |
|---|---|---|
| Company name consistent everywhere | 15 | Exact match: website, GMB, LinkedIn, directories |
| Full contact info on every page | 15 | Phone + email + city at minimum |
| Phone clickable | 5 | tel: link |
| About page with team info | 15 | Real names, photos, bios — not stock photos |
| Social profiles active and consistent | 10 | LinkedIn especially |
| Client logos or testimonials visible | 15 | Named clients or attributed quotes |
| Awards, certifications, or credentials | 10 | Any verifiable third-party signal |
| Years in business or founding story | 10 | Trust signal for B2B |
| Press or media mentions | 5 | Optional but boosts authority |

**Total: 100 points**

---

## Dimension 3 — AI Discoverability (Weight: 20%)

| Criterion | Points | Pass condition |
|---|---|---|
| Services page with clear descriptions | 20 | Each service explained in plain language |
| "How we work" or process page | 15 | Step-by-step process visible |
| FAQ section on key pages | 10 | At least 4 questions per page |
| Schema markup (Organization + Service) | 15 | Validated structured data |
| llms.txt exists | 10 | Structured plain-text summary at /llms.txt |
| Case studies or portfolio | 15 | Real project examples with outcomes |
| Direct-answer content | 10 | "What does [company] do?" answerable from homepage |
| Location/service area stated clearly | 5 | AI can confirm what geography is served |

**Total: 100 points**

---

## Dimension 4 — Conversion Architecture (Weight: 20%)

| Criterion | Points | Pass condition |
|---|---|---|
| Primary CTA is specific action | 15 | "Schedule a consultation" beats "Contact Us" |
| CTA above the fold | 10 | Visible without scrolling |
| Consultation or quote form exists | 20 | Form that captures project details |
| Response time or next step stated | 10 | "We respond within 24 hours" type language |
| Mid-page CTAs | 10 | At least one CTA after hero |
| Social proof near CTA | 10 | Testimonial or logo near the ask |
| Mobile-responsive | 10 | Works on phone |
| Clear pricing signals | 10 | Range, packages, or "starting at" — even vague is better than nothing |
| Case study CTA | 5 | "See how we did it" type link |

**Total: 100 points**

---

## Dimension 5 — Content (Weight: 15%)

**Page inventory:**

| Page | Points |
|---|---|
| Home | 5 |
| About / Team | 10 |
| Services hub | 5 |
| Individual service pages (per service) | 10 each, max 30 |
| Portfolio / Case studies | 15 |
| Process / How we work | 10 |
| Contact | 5 |
| Blog or resources | 10 |
| Testimonials or reviews | 5 |
| FAQ page | 5 |

**Total: 100 points**

---

## Dimension 6 — A2A Readiness (Weight: 10%)

| Criterion | Points | Pass condition |
|---|---|---|
| Consultation booking at stable URL | 20 | Calendly or similar, direct link |
| Quote request form structured | 15 | Captures project type, budget, timeline |
| ReserveAction schema on contact/booking | 15 | Valid schema with urlTemplate |
| Service schema on each service page | 15 | Service + areaServed + potentialAction |
| SearchAction on site | 10 | Site search with schema |
| Contact form returns structured confirmation | 10 | Confirmation email or page |
| AI chat or intake agent | 15 | Can answer "what services do you offer?" |

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
| CTA is "Contact Us" | Change to "Schedule a consultation" | 15 min |
| No case studies | Add 1-2 project descriptions with outcomes | 2 hours |
| No testimonials | Add 3 attributed quotes | 1 hour |
| Services not on separate pages | Create one page per service | 2 hours |
| No meta descriptions | Add unique descriptions | 1 hour |
| Phone not clickable | Add tel: link | 15 min |
| No process page | Add simple 4-step "How we work" | 1 hour |

---

## Rebuild trigger rules

Recommend full rebuild when:
- Overall grade D or below
- No service-specific pages exist
- No case studies or portfolio at all
- Built on Wix, Weebly, or basic template with no SEO control
- No contact form — only email address listed
