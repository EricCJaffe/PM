/**
 * Workflow Generator — pure functions that map site audit data to
 * project phases, tasks, gap analysis items, and intake fields.
 *
 * No database calls — just data transformation. Called by the
 * workflow creation API route.
 */

import type {
  SiteAudit,
  AuditGapItem,
  AuditQuickWin,
  AuditRecommendation,
  AuditPageToBuild,
  WorkflowType,
} from "@/types/pm";

// ─── Output Types ──────────────────────────────────────────────────────────

export interface TaskDef {
  name: string;
  description: string;
  status: string;
  sort_order: number;
}

export interface PhaseDef {
  slug: string;
  name: string;
  group: string;
  order: number;
  status: string;
  tasks: TaskDef[];
}

export interface GapDef {
  category: string;
  title: string;
  current_state: string;
  desired_state: string;
  gap_description: string;
  severity: string;
  source: string;
}

export interface ChecklistItem {
  section: string;
  title: string;
  description: string;
  is_required: boolean;
  sort_order: number;
}

// ─── Dimension Keys ────────────────────────────────────────────────────────

const DIMENSIONS = [
  { key: "seo", name: "SEO", phase: 2 },
  { key: "entity", name: "Entity Authority", phase: 3 },
  { key: "ai_discoverability", name: "AI Discoverability", phase: 4 },
  { key: "conversion", name: "Conversion Architecture", phase: 5 },
  { key: "content", name: "Content Inventory", phase: 6 },
  { key: "a2a_readiness", name: "A2A Readiness", phase: 7 },
] as const;

// ─── Remediation Workflow ──────────────────────────────────────────────────

export function generateRemediationPhases(audit: SiteAudit): PhaseDef[] {
  const phases: PhaseDef[] = [];

  // Phase 1: Quick Wins
  const quickWinTasks = (audit.quick_wins || []).map((qw, i) => ({
    name: qw.action,
    description: `Time estimate: ${qw.time_estimate}. Impact: ${qw.impact}`,
    status: "not-started",
    sort_order: i + 1,
  }));

  phases.push({
    slug: "quick-wins",
    name: "Quick Wins",
    group: "REMEDIATION",
    order: 1,
    status: quickWinTasks.length > 0 ? "not-started" : "complete",
    tasks: quickWinTasks,
  });

  // Phases 2-7: One per dimension
  for (const dim of DIMENSIONS) {
    const gaps = (audit.gaps?.[dim.key] || []) as AuditGapItem[];
    const recs = (audit.recommendations || []).filter(
      (r) => r.title.toLowerCase().includes(dim.name.toLowerCase().split(" ")[0])
    );

    const tasks: TaskDef[] = [];
    let order = 1;

    // Gap-based tasks
    for (const gap of gaps) {
      tasks.push({
        name: gap.item,
        description: `Current: ${gap.current_state}. Standard: ${gap.standard}. Fix: ${gap.gap}`,
        status: "not-started",
        sort_order: order++,
      });
    }

    // Recommendation-based tasks (only ones not already covered by gaps)
    for (const rec of recs) {
      if (!tasks.some((t) => t.name === rec.title)) {
        tasks.push({
          name: rec.title,
          description: `${rec.description} (Priority: ${rec.priority}, Effort: ${rec.effort}, Impact: ${rec.impact})`,
          status: "not-started",
          sort_order: order++,
        });
      }
    }

    // Content dimension: also add pages to build
    if (dim.key === "content") {
      for (const page of audit.pages_to_build || []) {
        tasks.push({
          name: `Create page: ${page.title}`,
          description: `URL: ${page.slug}. Priority: ${page.priority}. ${page.notes}`,
          status: "not-started",
          sort_order: order++,
        });
      }
    }

    phases.push({
      slug: dim.key.replace(/_/g, "-"),
      name: `${dim.name} Fixes`,
      group: "REMEDIATION",
      order: dim.phase,
      status: tasks.length > 0 ? "not-started" : "complete",
      tasks,
    });
  }

  // Phase 8: Re-Audit & Verify
  phases.push({
    slug: "re-audit",
    name: "Re-Audit & Verify",
    group: "VERIFICATION",
    order: 8,
    status: "not-started",
    tasks: [
      { name: "Run follow-up site audit", description: "Re-run the site audit on the same URL to measure improvement.", status: "not-started", sort_order: 1 },
      { name: "Compare results to baseline", description: "Use the audit comparison view to see dimension-by-dimension improvement.", status: "not-started", sort_order: 2 },
      { name: "Identify remaining gaps", description: "Review any dimensions still below target and plan next actions.", status: "not-started", sort_order: 3 },
      { name: "Plan next remediation cycle", description: "If target scores are not yet met, generate new tasks from remaining gaps.", status: "not-started", sort_order: 4 },
    ],
  });

  return phases;
}

// ─── Rebuild Workflow ──────────────────────────────────────────────────────

export function generateRebuildPhases(audit: SiteAudit): PhaseDef[] {
  const phases: PhaseDef[] = [];

  // Phase 1: Client Intake (simple portal form)
  phases.push({
    slug: "client-intake",
    name: "Client Intake",
    group: "DISCOVERY",
    order: 1,
    status: "not-started",
    tasks: [
      { name: "Client completes intake form", description: "Simple 12-field form: church basics, branding, style preference, content uploads.", status: "not-started", sort_order: 1 },
      { name: "Client approves sitemap", description: "Review and approve the auto-generated page list from the site audit.", status: "not-started", sort_order: 2 },
    ],
  });

  // Phase 2: Admin Discovery (internal checklist — not client-facing)
  phases.push({
    slug: "admin-discovery",
    name: "Admin Discovery",
    group: "DISCOVERY",
    order: 2,
    status: "not-started",
    tasks: [
      { name: "Review client intake responses", description: "Review the client's intake form answers and uploaded assets.", status: "not-started", sort_order: 1 },
      { name: "Complete internal discovery checklist", description: "Work through the 14-section internal checklist. AI pre-fills most fields from audit data.", status: "not-started", sort_order: 2 },
      { name: "Scan old site for reusable content", description: "Review scraped content from the audit and identify copy, images, and media to carry forward.", status: "not-started", sort_order: 3 },
    ],
  });

  // Phase 3: Design Direction
  phases.push({
    slug: "design-direction",
    name: "Design & Branding",
    group: "DESIGN",
    order: 3,
    status: "not-started",
    tasks: [
      { name: "Finalize brand assets", description: "Confirm logo files, color palette, fonts from client uploads.", status: "not-started", sort_order: 1 },
      { name: "Set design direction", description: "Based on client's style preference and inspiration sites, define the visual approach.", status: "not-started", sort_order: 2 },
      { name: "Client approves design direction", description: "Share design direction summary with client for approval.", status: "not-started", sort_order: 3 },
    ],
  });

  // Phase 4: Site Architecture
  const archTasks: TaskDef[] = [
    { name: "Finalize sitemap", description: "Confirm final page list and navigation structure.", status: "not-started", sort_order: 1 },
    { name: "Define URL structure", description: "Set clean URL slugs for all pages. Plan 301 redirects from old URLs.", status: "not-started", sort_order: 2 },
  ];

  // Add a task per page to build
  const pages = audit.pages_to_build || [];
  pages.forEach((page, i) => {
    archTasks.push({
      name: `Plan page: ${page.title}`,
      description: `URL: ${page.slug}. Priority: ${page.priority}. ${page.notes}`,
      status: "not-started",
      sort_order: i + 3,
    });
  });

  phases.push({
    slug: "site-architecture",
    name: "Site Architecture",
    group: "ARCHITECTURE",
    order: 4,
    status: "not-started",
    tasks: archTasks,
  });

  // Phase 5: Content Capture
  const contentTasks: TaskDef[] = [];
  let contentOrder = 1;

  for (const page of pages) {
    contentTasks.push({
      name: `Content for: ${page.title}`,
      description: `Provide text content and images for the ${page.title} page. ${page.notes}. Use the file upload to attach images.`,
      status: "not-started",
      sort_order: contentOrder++,
    });
  }

  contentTasks.push({
    name: "Upload hero images and media",
    description: "Upload high-quality photos for homepage hero, headers, and key sections.",
    status: "not-started",
    sort_order: contentOrder++,
  });
  contentTasks.push({
    name: "Provide meta descriptions",
    description: "Write or approve SEO meta descriptions for each page (AI will draft if not provided).",
    status: "not-started",
    sort_order: contentOrder++,
  });

  phases.push({
    slug: "content-capture",
    name: "Content Capture",
    group: "CONTENT",
    order: 5,
    status: "not-started",
    tasks: contentTasks,
  });

  // Phase 6: Build
  phases.push({
    slug: "build",
    name: "Build & Development",
    group: "BUILD",
    order: 6,
    status: "not-started",
    tasks: [
      { name: "Generate build prompts", description: "AI generates Claude Code prompts from approved content, design, and sitemap.", status: "not-started", sort_order: 1 },
      { name: "Set up development environment", description: "Create project repo, configure hosting, set up CMS if applicable.", status: "not-started", sort_order: 2 },
      { name: "Implement homepage", description: "Build homepage with hero, CTAs, key sections per approved design.", status: "not-started", sort_order: 3 },
      { name: "Implement interior pages", description: "Build all approved interior pages with content.", status: "not-started", sort_order: 4 },
      { name: "Configure SEO per rubric", description: "Page titles, meta descriptions, schema markup, heading structure per audit rubric.", status: "not-started", sort_order: 5 },
      { name: "Set up analytics", description: "Configure Google Analytics, Search Console, and any tracking requirements.", status: "not-started", sort_order: 6 },
    ],
  });

  // Phase 7: Review & Revision
  phases.push({
    slug: "review",
    name: "Review & Revision",
    group: "REVIEW",
    order: 7,
    status: "not-started",
    tasks: [
      { name: "Client review: Round 1", description: "Client reviews the draft site and provides feedback.", status: "not-started", sort_order: 1 },
      { name: "Implement Round 1 revisions", description: "Apply client feedback from Round 1.", status: "not-started", sort_order: 2 },
      { name: "Client review: Round 2", description: "Client reviews revised site and provides final feedback.", status: "not-started", sort_order: 3 },
      { name: "Implement Round 2 revisions", description: "Apply final client feedback.", status: "not-started", sort_order: 4 },
      { name: "Final client approval", description: "Client signs off on the site for launch.", status: "not-started", sort_order: 5 },
    ],
  });

  // Phase 8: Pre-Launch & Audit
  phases.push({
    slug: "launch",
    name: "Pre-Launch & Post-Launch Audit",
    group: "VERIFICATION",
    order: 8,
    status: "not-started",
    tasks: [
      { name: "Configure DNS and hosting", description: "Point domain to new hosting. Verify SSL.", status: "not-started", sort_order: 1 },
      { name: "Set up 301 redirects", description: "Redirect old URLs to new URL structure to preserve SEO.", status: "not-started", sort_order: 2 },
      { name: "Mobile and performance check", description: "Verify site loads fast on mobile. Check Core Web Vitals.", status: "not-started", sort_order: 3 },
      { name: "Go live", description: "Launch the new site.", status: "not-started", sort_order: 4 },
      { name: "Run post-launch site audit", description: "Re-run the rubric audit on the new site to verify compliance.", status: "not-started", sort_order: 5 },
      { name: "Compare to original baseline", description: "Use audit comparison to show old site vs new site scores.", status: "not-started", sort_order: 6 },
      { name: "Hand off to client", description: "Training, documentation, and ongoing maintenance plan.", status: "not-started", sort_order: 7 },
    ],
  });

  return phases;
}

// ─── Gap Analysis Generation ───────────────────────────────────────────────

export function generateGapItemsFromAudit(audit: SiteAudit): GapDef[] {
  const items: GapDef[] = [];

  if (!audit.gaps) return items;

  for (const [dimension, gaps] of Object.entries(audit.gaps)) {
    for (const gap of gaps as AuditGapItem[]) {
      items.push({
        category: mapDimensionToCategory(dimension),
        title: gap.item,
        current_state: gap.current_state,
        desired_state: gap.standard,
        gap_description: gap.gap,
        severity: inferSeverity(audit, dimension),
        source: "audit",
      });
    }
  }

  return items;
}

function mapDimensionToCategory(dimension: string): string {
  const map: Record<string, string> = {
    seo: "processes",
    entity: "data",
    ai_discoverability: "data",
    conversion: "processes",
    content: "vision",
    a2a_readiness: "data",
  };
  return map[dimension] || "other";
}

function inferSeverity(audit: SiteAudit, dimension: string): string {
  const score = audit.scores?.[dimension as keyof typeof audit.scores]?.score;
  if (score == null) return "medium";
  if (score < 40) return "critical";
  if (score < 60) return "high";
  if (score < 80) return "medium";
  return "low";
}

// ─── Target Scores ─────────────────────────────────────────────────────────

export function mapAuditToTargetScores(
  audit: SiteAudit,
  defaultTarget = 80
): Record<string, number> {
  const targets: Record<string, number> = { overall: defaultTarget };
  if (audit.scores) {
    for (const dim of DIMENSIONS) {
      targets[dim.key] = defaultTarget;
    }
  }
  return targets;
}

// ─── Church Website Admin Checklist ────────────────────────────────────────

export function generateAdminChecklist(): ChecklistItem[] {
  let order = 0;
  const items: ChecklistItem[] = [];

  const add = (section: string, title: string, description: string, required = true) => {
    items.push({ section, title, description, is_required: required, sort_order: ++order });
  };

  // 1. Mission & Strategy
  add("Mission & Strategy", "Confirm website goal", "What is the main goal of the website?");
  add("Mission & Strategy", "Define target audience", "Primary audience: first-time guests, members, donors, parents?");
  add("Mission & Strategy", "Set top 3 CTAs", "What are the top 3 actions a visitor should take?");
  add("Mission & Strategy", "Document church distinctives", "What makes this church unique vs nearby churches?");

  // 2. First-Time Visitor Essentials
  add("Visitor Essentials", "Confirm service times", "Verify all service times are current.");
  add("Visitor Essentials", "Confirm address and parking", "Physical address, parking instructions, entrance details.");
  add("Visitor Essentials", "Kids/youth info", "Kids ministry check-in process, age groups, safety protocols.");
  add("Visitor Essentials", "Accessibility accommodations", "ADA access, hearing assistance, wheelchair seating.");
  add("Visitor Essentials", "Plan Your Visit content", "What should a first-time visitor expect?");
  add("Visitor Essentials", "Livestream details", "Livestream platform and link if applicable.", false);

  // 3. Core Pages & Content
  add("Core Pages", "Homepage copy approved", "Hero text, key sections, CTAs.");
  add("Core Pages", "About/Who We Are copy", "Church story, history, community description.");
  add("Core Pages", "Beliefs/Statement of Faith", "Doctrinal statement or beliefs page content.");
  add("Core Pages", "Leadership/staff bios", "Staff names, roles, photos, bios.");
  add("Core Pages", "Ministries list", "All active ministries with descriptions.");
  add("Core Pages", "Contact info", "Phone, email, office hours, contact form.");
  add("Core Pages", "Give page", "Giving platform link/embed, fund categories, why/how copy.");

  // 4. Branding
  add("Branding", "Logo files received", "Primary logo, alternate mark, icon versions.");
  add("Branding", "Color palette confirmed", "Brand colors with hex codes.");
  add("Branding", "Fonts confirmed", "Brand fonts or approved web substitutes.");
  add("Branding", "Tone/voice defined", "Warm, modern, traditional, pastoral, energetic?");
  add("Branding", "Photography style", "Clean, candid, editorial? Stock or custom?", false);

  // 5. UI/Design
  add("UI/Design", "Design inspiration collected", "Example sites the client likes (and why).");
  add("UI/Design", "Homepage sections approved", "What sections appear on the homepage and in what order.");
  add("UI/Design", "Menu structure approved", "Top navigation items and order.");
  add("UI/Design", "CTA button labels", "Primary and secondary CTA text.");
  add("UI/Design", "Footer content approved", "Contact info, links, social icons, legal.");

  // 6. Media Assets
  add("Media Assets", "Photo library received", "Building, interior, services, events, ministry photos.");
  add("Media Assets", "Staff headshots received", "Current photos for all listed staff.");
  add("Media Assets", "Video assets received", "Welcome video, promo, background video if needed.", false);

  // 7. Sermons & Media
  add("Sermons & Media", "Hosting platform confirmed", "YouTube, Vimeo, podcast feed, or direct upload?");
  add("Sermons & Media", "Sermon organization", "By series, speaker, topic, scripture, or date?");
  add("Sermons & Media", "Weekly upload workflow", "Who uploads? What format? Thumbnails?", false);

  // 8. Events & Calendar
  add("Events & Calendar", "Event platform confirmed", "Calendar tool, registration system.");
  add("Events & Calendar", "Recurring events documented", "Weekly services, small groups, regular events.");

  // 9. Giving/Donations
  add("Giving", "Giving platform confirmed", "Tithe.ly, Pushpay, Planning Center, etc.");
  add("Giving", "Embed vs link decision", "Embed giving form on site or link to external platform?");

  // 10. SEO & Local
  add("SEO & Local", "Official church name confirmed", "Consistent name for all online listings.");
  add("SEO & Local", "Google Business Profile status", "Verified, claimed, needs setup?");
  add("SEO & Local", "Target search terms", "Key phrases: 'church in [city]', ministry keywords.");

  // 11. Accessibility
  add("Accessibility", "Accessibility review included", "Color contrast, keyboard nav, alt text, focus indicators.");
  add("Accessibility", "Language requirements", "English only or multilingual?", false);

  // 12. Performance
  add("Performance", "Mobile-first confirmed", "Mobile is primary priority for design/dev.");
  add("Performance", "Must-have embeds listed", "Third-party widgets that must appear on site.");

  // 13. Integrations
  add("Integrations", "Forms documented", "Contact, prayer request, volunteer signup, etc.");
  add("Integrations", "ChMS integration", "Planning Center, Breeze, Church Community Builder?", false);
  add("Integrations", "Email platform", "Mailchimp, Constant Contact, internal system?", false);
  add("Integrations", "Social media links", "Facebook, Instagram, YouTube, X/Twitter.");

  // 14. Governance & Maintenance
  add("Governance", "Primary decision-maker assigned", "Who has final approval?");
  add("Governance", "Post-launch editor assigned", "Who updates content after launch?");
  add("Governance", "Training plan agreed", "CMS training, content update training.");
  add("Governance", "Maintenance plan agreed", "Hosting, updates, security, support plan.", false);

  return items;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function generatePhases(
  audit: SiteAudit,
  workflowType: WorkflowType
): PhaseDef[] {
  if (workflowType === "remediation") return generateRemediationPhases(audit);
  // Both "rebuild" and "guided_rebuild" use the same phase structure.
  // The difference is in how the client portal presents them
  // (guided_rebuild uses the 5-pass stepper UI).
  return generateRebuildPhases(audit);
}
