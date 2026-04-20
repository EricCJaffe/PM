/**
 * Generates a .docx file buffer from interview responses using JSZip + OOXML.
 * No external docx library needed — just JSZip (already installed).
 */
import JSZip from "jszip";

// ─── XML Helpers ─────────────────────────────────────────────────────────────

function esc(text: string): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function heading1(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function heading2(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
}

function boldPara(text: string): string {
  return `<w:p><w:r><w:rPr><w:b/><w:color w:val="1e3a5f"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function normalPara(text: string): string {
  if (!text.trim()) return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
  // Split by newlines to preserve multi-line answers
  const lines = text.split("\n").filter((l) => l.trim());
  return lines
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`)
    .join("");
}

function emptyPara(): string {
  return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
}

function hrPara(): string {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="cccccc"/></w:pBdr></w:pPr></w:p>`;
}

function metaRow(label: string, value: string): string {
  return `<w:p>
    <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(label)}: </w:t></w:r>
    <w:r><w:t xml:space="preserve">${esc(value || "—")}</w:t></w:r>
  </w:p>`;
}

function qaBlock(question: string, answer: string): string {
  return boldPara(question) + normalPara(answer || "—") + emptyPara();
}

// ─── OOXML Templates ──────────────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:numPr/><w:spacing w:before="240" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1e3a5f"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="2563eb"/></w:rPr>
  </w:style>
</w:styles>`;

// ─── Interview Responses type (mirrors form state) ────────────────────────────

export interface InterviewResponses {
  interviewee_name: string;
  department: string;
  interviewee_role: string;
  interviewer: string;
  interview_date: string;
  quote_to_cash: { flow: string; manual_steps: string; collection_tracking: string; delays_errors: string };
  people: { team_size: string; key_roles: string; skill_gaps: string; coverage_when_out: string };
  data: { what_is_tracked: string; where_it_lives: string; how_decisions_made: string; wish_had: string };
  processes: { core_workflows: string; manual_that_should_be_automated: string; falls_through_cracks: string; how_new_people_learn: string };
  communication: { meeting_cadence: string; reporting_to_leadership: string; tools_used: string; cross_dept_handoffs: string };
  issues: { biggest_frustration: string; slows_team_down: string; breaks_regularly: string; leadership_misunderstands: string };
  dreams: { magic_wand: string; ideal_day: string; done_right: string };
  must_haves: { must_have_1: string; must_have_2: string };
  tools: { daily_tools: string; love_about_current: string; hate_about_current: string; wish_had: string };
}

// ─── Document body builder ────────────────────────────────────────────────────

function buildDocumentXml(r: InterviewResponses, orgName: string): string {
  const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

  const body = [
    heading1("Department Head Interview"),
    emptyPara(),
    metaRow("Interviewee", r.interviewee_name),
    metaRow("Title / Role", r.interviewee_role),
    metaRow("Department", r.department),
    metaRow("Date", r.interview_date),
    metaRow("Interviewer", r.interviewer),
    metaRow("Organization", orgName),
    emptyPara(),
    hrPara(),

    // 1. Quote to Cash
    heading2("1. Quote to Cash"),
    qaBlock("Walk me through how a lead or opportunity becomes revenue in your department.", r.quote_to_cash.flow),
    qaBlock("What steps in billing, invoicing, or fulfillment are manual today?", r.quote_to_cash.manual_steps),
    qaBlock("How do you track collections and outstanding balances?", r.quote_to_cash.collection_tracking),
    qaBlock("Where are the biggest delays or errors in this flow?", r.quote_to_cash.delays_errors),

    // 2. People
    heading2("2. People"),
    qaBlock("How many people are in your department and what are the key roles?", r.people.team_size),
    qaBlock("Where are the skill gaps or capacity constraints?", r.people.skill_gaps),
    qaBlock("What happens when someone is out — how does work get covered?", r.people.coverage_when_out),
    qaBlock("What does your ideal team structure look like in 12–18 months?", r.people.key_roles),

    // 3. Data
    heading2("3. Data"),
    qaBlock("What data does your department track and report on?", r.data.what_is_tracked),
    qaBlock("Where does that data actually live today?", r.data.where_it_lives),
    qaBlock("How do you use data to make decisions?", r.data.how_decisions_made),
    qaBlock("What data do you wish you had but don't?", r.data.wish_had),

    // 4. Processes
    heading2("4. Processes"),
    qaBlock("Describe your 2–3 most important core workflows from start to finish.", r.processes.core_workflows),
    qaBlock("What's currently manual that you believe should be automated?", r.processes.manual_that_should_be_automated),
    qaBlock("Where do things most often fall through the cracks?", r.processes.falls_through_cracks),
    qaBlock("How do new employees learn how your department works?", r.processes.how_new_people_learn),

    // 5. Communication
    heading2("5. Communication Rhythms"),
    qaBlock("How often and how does your team communicate internally?", r.communication.meeting_cadence),
    qaBlock("How do you report up to leadership — what, how often, and in what format?", r.communication.reporting_to_leadership),
    qaBlock("What communication tools does your team use day-to-day?", r.communication.tools_used),
    qaBlock("How do cross-department handoffs work? Where do they break down?", r.communication.cross_dept_handoffs),

    // 6. Issues
    heading2("6. Issues & Pain Points"),
    qaBlock("What is your single biggest frustration with how things work today?", r.issues.biggest_frustration),
    qaBlock("What slows your team down the most?", r.issues.slows_team_down),
    qaBlock("What breaks or fails on a regular basis?", r.issues.breaks_regularly),
    qaBlock("What do you wish leadership better understood about your challenges?", r.issues.leadership_misunderstands),

    // 7. Dreams
    heading2("7. Dreams for a New System"),
    qaBlock("If you could wave a magic wand and change anything, what would you change?", r.dreams.magic_wand),
    qaBlock("Describe what your ideal day looks like with better systems in place.", r.dreams.ideal_day),
    qaBlock('What does "done right" look like for your department in 2 years?', r.dreams.done_right),

    // 8. Must Haves
    heading2("8. Must Haves (Top 1–2)"),
    qaBlock("Must Have #1", r.must_haves.must_have_1),
    qaBlock("Must Have #2", r.must_haves.must_have_2),

    // 9. Tools
    heading2("9. Tools & Technology"),
    qaBlock("What tools and technology do you use to do your job every day?", r.tools.daily_tools),
    qaBlock("What do you love about your current tools?", r.tools.love_about_current),
    qaBlock("What do you hate or find frustrating about your current tools?", r.tools.hate_about_current),
    qaBlock("Are there tools you've heard of or wish you had?", r.tools.wish_had),

    // Required end-of-body sectPr
    `<w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>`,
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}>
  <w:body>
${body}
  </w:body>
</w:document>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a .docx file as a Buffer from interview responses.
 * Uses JSZip + raw OOXML — no external docx library required.
 */
export async function generateInterviewDocx(
  responses: InterviewResponses,
  orgName: string
): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file("word/_rels/document.xml.rels", WORD_RELS);
  zip.file("word/styles.xml", STYLES);
  zip.file("word/document.xml", buildDocumentXml(responses, orgName));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer;
}

// ─── Markdown Generator ───────────────────────────────────────────────────────

/**
 * Generates a structured Markdown file from interview responses.
 */
export function generateInterviewMd(responses: InterviewResponses, orgName: string): string {
  const r = responses;
  const date = r.interview_date || new Date().toISOString().split("T")[0];

  const section = (num: number, icon: string, title: string, qas: [string, string][]) => {
    const body = qas
      .map(([q, a]) => `**${q}**\n\n${a?.trim() || "_No response_"}\n`)
      .join("\n---\n\n");
    return `## ${num}. ${icon} ${title}\n\n${body}`;
  };

  return `---
title: "${r.department} Department — Discovery Interview"
interviewee: "${r.interviewee_name}"
role: "${r.interviewee_role}"
department: "${r.department}"
interviewer: "${r.interviewer}"
date: "${date}"
org: "${orgName}"
type: discovery-interview
---

# Department Head Interview
## ${r.department} Department · ${orgName}

| Field | Value |
|-------|-------|
| **Interviewee** | ${r.interviewee_name} |
| **Title / Role** | ${r.interviewee_role || "—"} |
| **Department** | ${r.department} |
| **Date** | ${date} |
| **Interviewer** | ${r.interviewer || "—"} |
| **Organization** | ${orgName} |

---

${section(1, "💰", "Quote to Cash", [
  ["Walk me through how a lead or opportunity becomes revenue in your department.", r.quote_to_cash.flow],
  ["What steps in billing, invoicing, or fulfillment are manual today?", r.quote_to_cash.manual_steps],
  ["How do you track collections and outstanding balances?", r.quote_to_cash.collection_tracking],
  ["Where are the biggest delays or errors in this flow?", r.quote_to_cash.delays_errors],
])}

${section(2, "👥", "People", [
  ["How many people are in your department and what are the key roles?", r.people.team_size],
  ["Where are the skill gaps or capacity constraints?", r.people.skill_gaps],
  ["What happens when someone is out — how does work get covered?", r.people.coverage_when_out],
  ["What does your ideal team structure look like in 12–18 months?", r.people.key_roles],
])}

${section(3, "📊", "Data", [
  ["What data does your department track and report on?", r.data.what_is_tracked],
  ["Where does that data actually live today?", r.data.where_it_lives],
  ["How do you use data to make decisions?", r.data.how_decisions_made],
  ["What data do you wish you had but don't?", r.data.wish_had],
])}

${section(4, "⚙️", "Processes", [
  ["Describe your 2–3 most important core workflows from start to finish.", r.processes.core_workflows],
  ["What's currently manual that you believe should be automated?", r.processes.manual_that_should_be_automated],
  ["Where do things most often fall through the cracks?", r.processes.falls_through_cracks],
  ["How do new employees learn how your department works?", r.processes.how_new_people_learn],
])}

${section(5, "📅", "Communication Rhythms", [
  ["How often and how does your team communicate internally?", r.communication.meeting_cadence],
  ["How do you report up to leadership — what, how often, and in what format?", r.communication.reporting_to_leadership],
  ["What communication tools does your team use day-to-day?", r.communication.tools_used],
  ["How do cross-department handoffs work? Where do they break down?", r.communication.cross_dept_handoffs],
])}

${section(6, "🚧", "Issues & Pain Points", [
  ["What is your single biggest frustration with how things work today?", r.issues.biggest_frustration],
  ["What slows your team down the most?", r.issues.slows_team_down],
  ["What breaks or fails on a regular basis?", r.issues.breaks_regularly],
  ["What do you wish leadership better understood about your challenges?", r.issues.leadership_misunderstands],
])}

${section(7, "✨", "Dreams for a New System", [
  ["If you could wave a magic wand and change anything, what would you change?", r.dreams.magic_wand],
  ["Describe what your ideal day looks like with better systems in place.", r.dreams.ideal_day],
  ['What does "done right" look like for your department in 2 years?', r.dreams.done_right],
])}

${section(8, "🎯", "Must Haves (Top 1–2)", [
  ["Must Have #1", r.must_haves.must_have_1],
  ["Must Have #2", r.must_haves.must_have_2],
])}

${section(9, "🛠️", "Tools & Technology", [
  ["What tools and technology do you use to do your job every day?", r.tools.daily_tools],
  ["What do you love about your current tools?", r.tools.love_about_current],
  ["What do you hate or find frustrating about your current tools?", r.tools.hate_about_current],
  ["Are there tools you've heard of or wish you had?", r.tools.wish_had],
])}

---
_Generated by BusinessOS Discovery · ${new Date().toLocaleDateString()}_
`;
}
