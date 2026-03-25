/**
 * Generates a rebuilt site mockup HTML based on audit results.
 * This mockup shows what a properly rebuilt site could look like,
 * following the Foundation Stone design system.
 */

import type { AuditVertical, AuditDimensionScore } from "@/types/pm";

interface MockupParams {
  url: string;
  vertical: AuditVertical;
  orgName: string;
  scores: Record<string, AuditDimensionScore | unknown> | null;
  pagesMissing: string[];
  pagesToBuild: Array<{ slug: string; title: string }>;
}

export function generateMockupHtml(params: MockupParams): string {
  const { url, vertical, orgName, pagesToBuild } = params;
  const domain = safeHostname(url);
  const year = new Date().getFullYear();

  // Build nav links from pages to build (defensive: handle missing title)
  const navLinks = pagesToBuild
    .slice(0, 5)
    .map((p) => `<a href="#" class="nav-link">${esc(p.title || "Page")}</a>`)
    .join("\n      ");

  // Determine CTA text and hero copy based on vertical
  const { cta, heroCopy, heroSubtext, eyebrow, visitSection } = getVerticalCopy(vertical, orgName);

  // Build page section stubs for recommended pages (defensive: handle missing slug/title)
  const pageSections = pagesToBuild
    .slice(0, 4)
    .map(
      (p, i) => `
    <div class="section ${i % 2 === 1 ? "section-alt" : ""}">
      <p class="section-label">${esc((p.slug || "/page").replace(/^\//, "").replace(/-/g, " "))}</p>
      <h2 class="section-title">${esc(p.title || "New Page")}</h2>
      <p class="section-body">This page would contain comprehensive content about ${esc(
        (p.title || "this topic").toLowerCase()
      )}, optimized for search engines and AI discoverability.</p>
    </div>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(orgName)} — Rebuilt Site Concept</title>
<style>
${MOCKUP_CSS}
</style>
</head>
<body>

<!-- Mockup Banner -->
<div class="mockup-banner">
  REBUILT SITE CONCEPT &mdash; ${esc(domain)} &mdash; This is a design mockup, not a live site
</div>

<!-- Navigation -->
<nav>
  <div class="nav-logo">${esc(orgName)}</div>
  <div class="nav-links">
    ${navLinks}
  </div>
  <button class="nav-cta">${esc(cta)}</button>
</nav>

<!-- Hero -->
<div class="hero">
  <p class="hero-eyebrow">${esc(eyebrow)}</p>
  <h1 class="hero-title">${heroCopy}</h1>
  <p class="hero-sub">${esc(heroSubtext)}</p>
  <div class="hero-buttons">
    <a href="#" class="btn-primary">${esc(cta)}</a>
    <a href="#" class="btn-outline">Learn More</a>
  </div>
</div>

<!-- Visit / Intro Section -->
${visitSection}

<!-- Page Sections -->
${pageSections}

<!-- Footer -->
<footer>
  <div class="footer-inner">
    <p class="footer-logo">${esc(orgName)}</p>
    <p class="footer-copy">&copy; ${year} ${esc(orgName)}. All rights reserved.</p>
  </div>
</footer>

</body>
</html>`;
}

function getVerticalCopy(
  vertical: AuditVertical,
  orgName: string
): {
  cta: string;
  heroCopy: string;
  heroSubtext: string;
  eyebrow: string;
  visitSection: string;
} {
  switch (vertical) {
    case "church":
      return {
        cta: "Plan Your Visit",
        heroCopy: `A place where <em>lives are changed</em>`,
        heroSubtext:
          "A community rooted in faith, hope, and genuine care for people.",
        eyebrow: `WELCOME TO ${orgName.toUpperCase()}`,
        visitSection: `
<div class="section section-alt">
  <p class="section-label">First time here?</p>
  <h2 class="section-title">We would love to meet you</h2>
  <p class="section-body">Visiting for the first time can feel like a big step. Here is everything you need to feel right at home before you arrive.</p>
  <a href="#" class="btn-primary" style="margin-top: 16px; display: inline-block">Plan Your First Visit</a>
</div>`,
      };

    case "nonprofit":
      return {
        cta: "Get Involved",
        heroCopy: `Making a <em>lasting difference</em>`,
        heroSubtext:
          "Together, we create meaningful change in our community and beyond.",
        eyebrow: `${orgName.toUpperCase()} — OUR MISSION`,
        visitSection: `
<div class="section section-alt">
  <p class="section-label">Our Impact</p>
  <h2 class="section-title">See how we're making a difference</h2>
  <p class="section-body">From local programs to community initiatives, every contribution drives real change.</p>
  <a href="#" class="btn-primary" style="margin-top: 16px; display: inline-block">Donate Now</a>
</div>`,
      };

    case "agency":
      return {
        cta: "Get a Quote",
        heroCopy: `Results that <em>speak for themselves</em>`,
        heroSubtext:
          "Strategic solutions that drive growth and deliver measurable outcomes.",
        eyebrow: `${orgName.toUpperCase()} — PROFESSIONAL SERVICES`,
        visitSection: `
<div class="section section-alt">
  <p class="section-label">Our Work</p>
  <h2 class="section-title">Trusted by businesses that demand results</h2>
  <p class="section-body">We partner with ambitious organizations to build digital experiences that convert visitors into customers.</p>
  <a href="#" class="btn-primary" style="margin-top: 16px; display: inline-block">View Case Studies</a>
</div>`,
      };

    default:
      return {
        cta: "Contact Us",
        heroCopy: `Welcome to <em>${esc(orgName)}</em>`,
        heroSubtext: "Discover what we have to offer.",
        eyebrow: orgName.toUpperCase(),
        visitSection: `
<div class="section section-alt">
  <p class="section-label">About Us</p>
  <h2 class="section-title">Learn more about what we do</h2>
  <p class="section-body">We're here to help. Get in touch to learn more about our services and how we can work together.</p>
</div>`,
      };
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MOCKUP_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Georgia', serif;
  background: #faf9f6;
  color: #1a1a1a;
  max-width: 900px;
  margin: 0 auto;
}

.mockup-banner {
  background: #c4793a;
  color: #fff;
  text-align: center;
  font-size: 10px;
  font-family: Helvetica, sans-serif;
  letter-spacing: 0.1em;
  padding: 6px;
  text-transform: uppercase;
}

nav {
  background: #1c2b1e;
  padding: 14px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-logo {
  font-size: 18px;
  color: #e8dfc8;
  letter-spacing: 0.04em;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  font-family: Helvetica, sans-serif;
  font-size: 12px;
  color: #9aaa90;
  text-decoration: none;
  letter-spacing: 0.03em;
}

.nav-cta {
  background: #c4793a;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 5px;
  font-size: 12px;
  font-family: Helvetica, sans-serif;
  cursor: pointer;
}

.hero {
  background: #1c2b1e;
  padding: 60px 40px 50px;
}

.hero-eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #c4793a;
  margin-bottom: 14px;
  font-family: Helvetica, sans-serif;
}

.hero-title {
  font-size: 44px;
  color: #f0ebe0;
  line-height: 1.1;
  max-width: 520px;
  margin-bottom: 18px;
}

.hero-title em {
  color: #c4793a;
  font-style: italic;
}

.hero-sub {
  color: #9aaa90;
  font-size: 14px;
  line-height: 1.8;
  max-width: 420px;
  margin-bottom: 30px;
  font-family: Helvetica, sans-serif;
  font-weight: 300;
}

.hero-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.btn-primary {
  background: #c4793a;
  color: #fff;
  padding: 12px 24px;
  border-radius: 7px;
  font-size: 14px;
  text-decoration: none;
  font-family: Helvetica, sans-serif;
}

.btn-outline {
  border: 1.5px solid #4a6048;
  color: #9aaa90;
  padding: 11px 24px;
  border-radius: 7px;
  font-size: 14px;
  text-decoration: none;
  font-family: Helvetica, sans-serif;
}

.section {
  padding: 54px 40px;
}

.section-alt {
  background: #f5f0e8;
}

.section-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c4793a;
  margin-bottom: 6px;
  font-family: Helvetica, sans-serif;
}

.section-title {
  font-size: 30px;
  color: #1c2b1e;
  margin-bottom: 14px;
  line-height: 1.2;
}

.section-body {
  color: #5a6854;
  font-family: Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.8;
  max-width: 560px;
}

footer {
  background: #111d12;
  padding: 36px 40px 20px;
}

.footer-inner {
  text-align: center;
}

.footer-logo {
  font-size: 16px;
  color: #e8dfc8;
  margin-bottom: 8px;
}

.footer-copy {
  font-size: 11px;
  color: #4a6048;
  font-family: Helvetica, sans-serif;
}

@media print {
  body { max-width: none; }
  .mockup-banner { display: none; }
}
`;
