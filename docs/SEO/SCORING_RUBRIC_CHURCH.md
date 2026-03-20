# SCORING_RUBRIC_CHURCH.md
## Church OS — Site Audit Scoring Rubric
## Version: 1.0 | Last updated: 2026-03-20

> This rubric is used by the site audit tool to grade church and ministry websites
> across six dimensions. Each dimension is scored A–F.
> Import this file into the PM tool scoring engine.

---

## How scoring works

Each dimension has a set of criteria. Each criterion is either:
- **Present and correct** — full credit
- **Present but weak** — partial credit
- **Missing** — no credit

Grade thresholds per dimension:
| Score | Grade |
|---|---|
| 90–100% | A |
| 80–89% | B |
| 70–79% | C |
| 60–69% | D |
| 50–59% | D- |
| Below 50% | F |

---

## Dimension 1 — SEO (Weight: 20%)

### Criteria

| Criterion | Points | How to check | Pass condition |
|---|---|---|---|
| Page title includes church name + location | 10 | Check `<title>` tag | Must include city or "Jacksonville" or similar |
| Meta description exists | 10 | Check `<meta name="description">` | Must be 120–160 chars, compelling |
| H1 tag has SEO value | 10 | Check first `<h1>` | Must include service type or location, not just org name |
| Address on every page | 10 | Check footer/header on 3 pages | Full street address visible |
| Page count adequate | 15 | Count indexable pages | 10+ pages = full credit, 5-9 = half, under 5 = zero |
| Sermon or blog content exists | 15 | Check for content archive | Any date-stamped content = full credit |
| XML sitemap exists | 10 | Check /sitemap.xml | Returns valid XML |
| robots.txt configured | 5 | Check /robots.txt | Exists and doesn't block everything |
| Google Business Profile claimed | 10 | Search org name in Google Maps | Appears with claimed listing = full credit |
| Local keywords in content | 5 | Check homepage body text | City name appears naturally in copy |

**Total: 100 points**

### Grade guide for SEO
- **A:** Strong local presence, all technical basics, content strategy active
- **B:** Most basics covered, one or two gaps
- **C:** Present but thin — address and title okay, content missing
- **D:** Major gaps — no meta, thin content, no local signals
- **F:** Almost no SEO infrastructure present

---

## Dimension 2 — Entity Authority (Weight: 15%)

### Criteria

| Criterion | Points | How to check | Pass condition |
|---|---|---|---|
| Org name consistent across all pages | 15 | Check title, nav, footer, about | Exact same name everywhere |
| Full NAP on every page | 15 | Name + Address + Phone visible | All three present in footer or header |
| Phone number clickable (tel: link) | 10 | Click phone number | Opens dialer |
| Denomination or affiliation stated | 15 | Check about or beliefs page | Any affiliation clearly stated |
| Google Business Profile complete | 15 | Check GMB listing | Hours, photos, description all filled in |
| About page has leadership info | 15 | Check /about | Pastor names, photos, bios present |
| Social profiles consistent | 10 | Check linked social accounts | Same name, logo, address across platforms |
| External directory listings consistent | 5 | Check Yelp, Apple Maps, Bing | NAP matches website |

**Total: 100 points**

### Grade guide for Entity Authority
- **A:** Consistent, complete, verified everywhere
- **B:** Mostly consistent, one platform out of sync
- **C:** Basic info present but incomplete
- **D:** Inconsistent naming, partial address, no GMB
- **F:** Cannot be identified as a real organization from web signals

---

## Dimension 3 — AI Discoverability (Weight: 20%)

### Criteria

| Criterion | Points | How to check | Pass condition |
|---|---|---|---|
| Beliefs or What We Believe page exists | 20 | Check /beliefs or /about | Dedicated page with doctrine clearly stated |
| Plan Your Visit page exists | 20 | Check /visit or /plan-your-visit | Dedicated page answering newcomer questions |
| FAQ sections on key pages | 10 | Check home, visit, about | At least one FAQ section with 4+ questions |
| Schema markup present | 15 | Check page source or validator | ReligiousOrganization schema at minimum |
| llms.txt file exists | 10 | Check /llms.txt | Returns structured plain text about the org |
| Sermon content indexed | 10 | Check /sermons or YouTube link | Accessible archive of messages |
| Direct-answer content | 10 | Read homepage and about | First paragraph answers who/what/where directly |
| Service times in structured format | 5 | Check homepage | Day + time + location clearly stated |

**Total: 100 points**

### Grade guide for AI Discoverability
- **A:** AI can confidently describe, recommend, and answer questions about this church
- **B:** Most content is AI-readable, one key page missing
- **C:** Basic info findable but structured data absent
- **D:** AI would struggle to answer basic questions
- **F:** AI has almost no structured information to work from

---

## Dimension 4 — Conversion Architecture (Weight: 20%)

### Criteria

| Criterion | Points | How to check | Pass condition |
|---|---|---|---|
| Primary CTA is "Plan Your Visit" or equivalent | 20 | Check hero section CTA | Not "Contact Us" or generic — must invite a visit |
| Service times above the fold | 15 | Check without scrolling | Day, time, and location visible immediately |
| Plan Your Visit page exists with form | 15 | Check /visit | Form that captures name + email + questions |
| Children / youth info accessible | 10 | Check nav or homepage | Clear link or section about kids ministry |
| Mid-page CTA present | 10 | Scroll through homepage | At least one CTA after the hero |
| Mobile-responsive design | 10 | Check on mobile device | Layout works on phone |
| Online giving accessible | 10 | Check for give link | Clicking leads to functional giving flow |
| Contact info above the fold or 1 click | 10 | Check hero or nav | Phone or address reachable without scrolling deep |

**Total: 100 points**

### Grade guide for Conversion Architecture
- **A:** Every friction point removed, clear path from visitor to attendee
- **B:** Most CTAs correct, one key page missing
- **C:** Some conversion logic present but primary CTA wrong
- **D:** Wrong primary CTA, service times buried, key pages missing
- **F:** No conversion architecture — just information, no path

---

## Dimension 5 — Content (Weight: 15%)

### Criteria

**Page inventory check — score each page present:**

| Page | Points | URL pattern |
|---|---|---|
| Home | 5 | / |
| About / Our Story | 10 | /about |
| What We Believe / Beliefs | 15 | /beliefs |
| Plan Your Visit | 15 | /visit |
| Sermons / Messages | 10 | /sermons |
| Ministries hub | 5 | /ministries |
| Children / Youth ministry | 5 | /ministries/children or /kids |
| Events | 5 | /events |
| Give / Generosity | 5 | /give |
| Contact | 5 | /contact |
| Next Steps / Get Connected | 5 | /next-steps |
| At least one ministry detail page | 5 | /ministries/[name] |
| Prayer Request | 5 | /prayer |
| Location / Find Us | 5 | /location or /visit |

**Total: 100 points**

**Content quality bonus/penalty:**
- Homepage copy answers who/what/where in first paragraph: +5
- About page has pastor photos and bios: +5
- Any page has lorem ipsum or placeholder text: -10 per page
- Outdated event listings (past dates): -5

### Grade guide for Content
- **A:** 12+ pages, all high-quality, no placeholders
- **B:** 8–11 pages, most quality
- **C:** 5–7 pages, key pages present
- **D:** 3–5 pages, critical pages missing
- **F:** Under 3 real pages

---

## Dimension 6 — A2A Readiness (Weight: 10%)

### Criteria

| Criterion | Points | How to check | Pass condition |
|---|---|---|---|
| Visit planning form with structured intake | 20 | Check /visit form | Name + email + optional questions, confirmation sent |
| Event registration at stable URLs | 15 | Check events page | Each event has its own URL and registration link |
| Online giving via embeddable widget | 15 | Check /give | Widget loads without redirect to external site |
| ReserveAction schema on visit page | 15 | Check schema markup | Valid ReserveAction with urlTemplate |
| DonateAction schema on give page | 15 | Check schema markup | Valid DonateAction with target URL |
| Event schema on each event | 10 | Check events | Each event has Event schema with date/time/location |
| AI chat or intake agent | 10 | Check for chat widget | Can answer "what time is service?" without human |

**Total: 100 points**

### Grade guide for A2A Readiness
- **A:** Machine-readable actions throughout, agents can complete transactions
- **B:** Most schema present, one or two actions missing
- **C:** Basic schema only, no action schema
- **D:** No schema, forms work but not structured
- **F:** No machine-readable infrastructure

---

## Overall score calculation

```
Overall = (SEO × 0.20) + (Entity × 0.15) + (AI × 0.20) + (Conversion × 0.20) + (Content × 0.15) + (A2A × 0.10)
```

| Overall % | Overall Grade |
|---|---|
| 90–100 | A |
| 80–89 | B |
| 70–79 | C |
| 60–69 | D |
| 50–59 | D- |
| Below 50 | F |

---

## Quick wins trigger rules

Automatically flag these as quick wins when found:

| Finding | Quick win recommendation | Time estimate |
|---|---|---|
| Service times not above fold | Move to hero section | 30 min |
| CTA is "Contact Us" | Change to "Plan Your Visit" | 15 min |
| Address not on every page | Add to footer | 30 min |
| No Google Business Profile | Claim and complete GMB | 1 hour |
| No beliefs statement | Add paragraph to About page | 1 hour |
| Phone not clickable | Add tel: link | 15 min |
| Meta description missing | Add to all pages | 1 hour |

---

## Rebuild trigger rules

Recommend full rebuild when ANY of these are true:
- Overall grade is D or below
- AI Discoverability grade is F
- Content score is under 40 (fewer than 4 key pages)
- Built on a template platform with no schema support (The Church Co, Squarespace basic, Wix)
- Page count under 5
