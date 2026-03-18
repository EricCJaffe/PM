/**
 * Seed script for Document Generation module.
 * Seeds the SOW document type + intake fields.
 * Run: npx tsx supabase/seeds/seed-docgen.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── SOW HTML Template ──────────────────────────────────────────────────────

const SOW_HTML_TEMPLATE = `
<div class="document">
  <div class="header-block">
    <h1>Statement of Work</h1>
    <p class="subtitle">{{project_name}}</p>
  </div>

  <table class="meta-table">
    <tr><td class="label">Client</td><td>{{client_name}}</td></tr>
    <tr><td class="label">Prepared For</td><td>{{client_contact_name}}{{#if client_contact_title}}, {{client_contact_title}}{{/if}}</td></tr>
    <tr><td class="label">Prepared By</td><td>{{prepared_by}}</td></tr>
    <tr><td class="label">Date</td><td>{{document_date}}</td></tr>
    <tr><td class="label">Valid Until</td><td>{{valid_until}}</td></tr>
    <tr><td class="label">Version</td><td>{{version}}</td></tr>
  </table>

  {{#each sections}}
  <div class="section" id="section-{{section_key}}">
    <h2>{{title}}</h2>
    <div class="section-content">{{{content_html}}}</div>
  </div>
  {{/each}}

  <div class="signature-block">
    <div class="sig-row">
      <div class="sig-col">
        <p class="sig-label">Client Signature</p>
        <div class="sig-line"></div>
        <p class="sig-name">{{client_contact_name}}</p>
        <p class="sig-title">{{client_contact_title}}</p>
        <p class="sig-date">Date: _______________</p>
      </div>
      <div class="sig-col">
        <p class="sig-label">Provider Signature</p>
        <div class="sig-line"></div>
        <p class="sig-name">{{prepared_by}}</p>
        <p class="sig-title">{{provider_title}}</p>
        <p class="sig-date">Date: _______________</p>
      </div>
    </div>
  </div>
</div>
`;

const SOW_CSS = `
.document { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }
.header-block { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #3b82f6; padding-bottom: 24px; }
.header-block h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a; }
.header-block .subtitle { font-size: 18px; color: #64748b; margin: 0; }
.meta-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
.meta-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
.meta-table .label { font-weight: 600; color: #475569; width: 160px; }
.section { margin-bottom: 28px; }
.section h2 { font-size: 18px; font-weight: 600; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
.section-content { font-size: 14px; }
.section-content p { margin: 0 0 8px 0; }
.section-content ul, .section-content ol { margin: 8px 0; padding-left: 24px; }
.section-content li { margin-bottom: 4px; }
.section-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
.section-content table th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e2e8f0; }
.section-content table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
.signature-block { margin-top: 48px; page-break-inside: avoid; }
.sig-row { display: flex; gap: 48px; }
.sig-col { flex: 1; }
.sig-label { font-weight: 600; font-size: 14px; margin-bottom: 40px; }
.sig-line { border-bottom: 1px solid #1e293b; margin-bottom: 8px; }
.sig-name { font-weight: 600; font-size: 14px; margin: 0; }
.sig-title { font-size: 13px; color: #64748b; margin: 0; }
.sig-date { font-size: 13px; color: #64748b; margin-top: 8px; }
@media print { .document { max-width: 100%; } .section { page-break-inside: avoid; } }
`;

const SOW_HEADER_HTML = `
<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
  <span>{{client_name}} — Statement of Work</span>
  <span>Confidential</span>
</div>
`;

const SOW_FOOTER_HTML = `
<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
  <span>Foundation Stone Advisors</span>
  <span>Page {{page}} of {{pages}}</span>
</div>
`;

// ─── SOW Intake Fields ──────────────────────────────────────────────────────

const SOW_INTAKE_FIELDS = [
  // ── Client Information ──
  {
    field_key: "client_name",
    label: "Client / Company Name",
    field_type: "text",
    section: "Client Information",
    sort_order: 1,
    is_required: true,
    placeholder: "Acme Corporation",
    ai_hint: "Use as the client name throughout the document.",
  },
  {
    field_key: "client_contact_name",
    label: "Client Contact Name",
    field_type: "text",
    section: "Client Information",
    sort_order: 2,
    is_required: true,
    placeholder: "Jane Smith",
  },
  {
    field_key: "client_contact_title",
    label: "Client Contact Title",
    field_type: "text",
    section: "Client Information",
    sort_order: 3,
    is_required: false,
    placeholder: "VP of Engineering",
  },
  {
    field_key: "client_contact_email",
    label: "Client Contact Email",
    field_type: "text",
    section: "Client Information",
    sort_order: 4,
    is_required: false,
    placeholder: "jane@acme.com",
  },

  // ── Project Details ──
  {
    field_key: "project_name",
    label: "Project Name",
    field_type: "text",
    section: "Project Details",
    sort_order: 10,
    is_required: true,
    placeholder: "Website Redesign & CRM Integration",
    ai_hint: "Use as the project title in the header and throughout.",
  },
  {
    field_key: "project_description",
    label: "Project Description",
    field_type: "textarea",
    section: "Project Details",
    sort_order: 11,
    is_required: true,
    placeholder: "Brief overview of what the project aims to accomplish...",
    ai_hint: "Expand this into a professional executive summary and project overview section.",
  },
  {
    field_key: "project_type",
    label: "Project Type",
    field_type: "select",
    section: "Project Details",
    sort_order: 12,
    is_required: true,
    options: [
      "Software Development",
      "Consulting",
      "Design & Creative",
      "Implementation & Integration",
      "Managed Services",
      "Training & Enablement",
      "Strategy & Advisory",
      "Other",
    ],
    ai_hint: "Use to set the tone and terminology of the SOW.",
  },

  // ── Scope & Deliverables ──
  {
    field_key: "in_scope",
    label: "In-Scope Items",
    field_type: "textarea",
    section: "Scope & Deliverables",
    sort_order: 20,
    is_required: true,
    placeholder: "List key deliverables and work items included in this engagement...",
    ai_hint: "Format as a professional bulleted list of deliverables in the Scope section.",
  },
  {
    field_key: "out_of_scope",
    label: "Out-of-Scope Items",
    field_type: "textarea",
    section: "Scope & Deliverables",
    sort_order: 21,
    is_required: false,
    placeholder: "List items explicitly excluded from this engagement...",
    ai_hint: "Format as exclusions in the Scope section to set clear boundaries.",
  },
  {
    field_key: "deliverables",
    label: "Key Deliverables",
    field_type: "textarea",
    section: "Scope & Deliverables",
    sort_order: 22,
    is_required: false,
    placeholder: "List specific deliverable artifacts (reports, code, designs, etc.)...",
    ai_hint: "Create a numbered deliverables table with description and acceptance criteria.",
  },
  {
    field_key: "assumptions",
    label: "Assumptions",
    field_type: "textarea",
    section: "Scope & Deliverables",
    sort_order: 23,
    is_required: false,
    placeholder: "List key assumptions this SOW is based on...",
    ai_hint: "Format as a bulleted assumptions list. Add standard assumptions if few are provided.",
  },

  // ── Timeline & Milestones ──
  {
    field_key: "start_date",
    label: "Estimated Start Date",
    field_type: "date",
    section: "Timeline",
    sort_order: 30,
    is_required: true,
  },
  {
    field_key: "end_date",
    label: "Estimated End Date",
    field_type: "date",
    section: "Timeline",
    sort_order: 31,
    is_required: true,
  },
  {
    field_key: "milestones",
    label: "Key Milestones",
    field_type: "textarea",
    section: "Timeline",
    sort_order: 32,
    is_required: false,
    placeholder: "List major milestones with target dates...",
    ai_hint: "Create a milestone table with name, target date, and description columns.",
  },

  // ── Pricing & Payment ──
  {
    field_key: "pricing_model",
    label: "Pricing Model",
    field_type: "select",
    section: "Pricing & Payment",
    sort_order: 40,
    is_required: true,
    options: [
      "Fixed Price",
      "Time & Materials",
      "Retainer (Monthly)",
      "Milestone-Based",
      "Hybrid",
    ],
    ai_hint: "Use to determine the pricing section structure and payment terms.",
  },
  {
    field_key: "total_price",
    label: "Total Price",
    field_type: "currency",
    section: "Pricing & Payment",
    sort_order: 41,
    is_required: false,
    placeholder: "50000",
    ai_hint: "Format as currency in the pricing table.",
  },
  {
    field_key: "hourly_rate",
    label: "Hourly Rate (if T&M)",
    field_type: "currency",
    section: "Pricing & Payment",
    sort_order: 42,
    is_required: false,
    placeholder: "175",
  },
  {
    field_key: "estimated_hours",
    label: "Estimated Hours (if T&M)",
    field_type: "number",
    section: "Pricing & Payment",
    sort_order: 43,
    is_required: false,
    placeholder: "300",
  },
  {
    field_key: "payment_schedule",
    label: "Payment Schedule",
    field_type: "textarea",
    section: "Pricing & Payment",
    sort_order: 44,
    is_required: false,
    placeholder: "e.g., 50% upfront, 25% at midpoint, 25% on completion...",
    ai_hint: "Create a payment schedule table with milestone, amount, and due date columns.",
  },

  // ── Provider Details ──
  {
    field_key: "prepared_by",
    label: "Prepared By",
    field_type: "text",
    section: "Provider Details",
    sort_order: 50,
    is_required: true,
    placeholder: "John Doe",
    default_value: "",
  },
  {
    field_key: "provider_title",
    label: "Provider Title",
    field_type: "text",
    section: "Provider Details",
    sort_order: 51,
    is_required: false,
    placeholder: "Managing Consultant",
  },
  {
    field_key: "provider_company",
    label: "Provider Company",
    field_type: "text",
    section: "Provider Details",
    sort_order: 52,
    is_required: false,
    placeholder: "Foundation Stone Advisors",
    default_value: "Foundation Stone Advisors",
  },

  // ── Document Settings ──
  {
    field_key: "document_date",
    label: "Document Date",
    field_type: "date",
    section: "Document Settings",
    sort_order: 60,
    is_required: true,
  },
  {
    field_key: "valid_until",
    label: "Valid Until",
    field_type: "date",
    section: "Document Settings",
    sort_order: 61,
    is_required: false,
    help_text: "Date this proposal expires. Defaults to 30 days from document date.",
  },
  {
    field_key: "version",
    label: "Version",
    field_type: "text",
    section: "Document Settings",
    sort_order: 62,
    is_required: false,
    default_value: "1.0",
    placeholder: "1.0",
  },
  {
    field_key: "confidentiality",
    label: "Confidentiality Notice",
    field_type: "toggle",
    section: "Document Settings",
    sort_order: 63,
    is_required: false,
    default_value: "true",
    help_text: "Include a confidentiality notice in the document footer.",
  },
];

// ─── SOW Default Sections ───────────────────────────────────────────────────

const SOW_DEFAULT_VARIABLES = {
  sections: [
    { section_key: "executive_summary", title: "Executive Summary", sort_order: 1 },
    { section_key: "project_overview", title: "Project Overview", sort_order: 2 },
    { section_key: "scope_of_work", title: "Scope of Work", sort_order: 3 },
    { section_key: "deliverables", title: "Deliverables", sort_order: 4 },
    { section_key: "timeline", title: "Timeline & Milestones", sort_order: 5 },
    { section_key: "pricing", title: "Pricing & Payment Terms", sort_order: 6 },
    { section_key: "assumptions", title: "Assumptions & Dependencies", sort_order: 7 },
    { section_key: "acceptance_criteria", title: "Acceptance Criteria", sort_order: 8 },
    { section_key: "change_management", title: "Change Management", sort_order: 9 },
    { section_key: "terms_conditions", title: "Terms & Conditions", sort_order: 10 },
  ],
};

// ─── Seed Function ──────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding Document Generation module...\n");

  // 1. Upsert document type
  console.log("1. Seeding SOW document type...");
  const { data: docType, error: typeError } = await supabase
    .from("document_types")
    .upsert(
      {
        slug: "sow",
        name: "Statement of Work",
        description: "Professional Statement of Work with scope, timeline, pricing, and terms. Supports AI-assisted content generation.",
        category: "proposal",
        html_template: SOW_HTML_TEMPLATE,
        css_styles: SOW_CSS,
        header_html: SOW_HEADER_HTML,
        footer_html: SOW_FOOTER_HTML,
        variables: SOW_DEFAULT_VARIABLES,
        is_active: true,
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (typeError) {
    console.error("  ✗ Failed to seed document type:", typeError.message);
    return;
  }
  console.log(`  ✓ SOW document type (id: ${docType.id})`);

  // 2. Upsert intake fields
  console.log("\n2. Seeding SOW intake fields...");

  // Delete existing fields for this type (clean re-seed)
  await supabase
    .from("document_intake_fields")
    .delete()
    .eq("document_type_id", docType.id);

  const fieldsToInsert = SOW_INTAKE_FIELDS.map((f) => ({
    document_type_id: docType.id,
    ...f,
    options: f.options ? JSON.stringify(f.options) : null,
    validation: f.is_required ? JSON.stringify({ required: true }) : null,
  }));

  const { error: fieldsError } = await supabase
    .from("document_intake_fields")
    .insert(fieldsToInsert);

  if (fieldsError) {
    console.error("  ✗ Failed to seed intake fields:", fieldsError.message);
    return;
  }
  console.log(`  ✓ ${SOW_INTAKE_FIELDS.length} intake fields across ${new Set(SOW_INTAKE_FIELDS.map(f => f.section)).size} sections`);

  // Summary
  const sections = [...new Set(SOW_INTAKE_FIELDS.map((f) => f.section))];
  console.log("\n  Sections:");
  for (const section of sections) {
    const count = SOW_INTAKE_FIELDS.filter((f) => f.section === section).length;
    console.log(`    • ${section} (${count} fields)`);
  }

  console.log("\nSeeding complete.");
}

seed().catch(console.error);
