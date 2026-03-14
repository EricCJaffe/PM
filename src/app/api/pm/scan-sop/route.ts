import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const { document_id, org_id, project_id } = await request.json();
  if (!document_id || !org_id) {
    return NextResponse.json({ error: "document_id and org_id required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Get the document record
  const { data: doc, error: docError } = await service
    .from("pm_documents")
    .select("*")
    .eq("id", document_id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Download file content from Supabase Storage
  const { data: fileData, error: downloadError } = await service.storage
    .from("vault")
    .download(doc.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Could not download file" }, { status: 500 });
  }

  // Extract text content
  let textContent: string;
  if (doc.mime_type?.includes("text") || doc.file_name?.endsWith(".md") || doc.file_name?.endsWith(".txt") || doc.file_name?.endsWith(".csv")) {
    textContent = await fileData.text();
  } else {
    // For binary files (PDF, docx, etc.), we send what we can extract
    // For now, use the text representation
    textContent = await fileData.text();
  }

  // Truncate to avoid token limits
  const maxChars = 15000;
  if (textContent.length > maxChars) {
    textContent = textContent.substring(0, maxChars) + "\n\n[...truncated]";
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an automation consultant analyzing Standard Operating Procedures (SOPs) and business documents to identify automation opportunities.

For each opportunity you identify, provide:
- title: Short descriptive name
- description: What the automation would do
- estimated_savings: Estimated annual savings in USD (be conservative)
- savings_unit: "year"
- complexity: "low", "medium", or "high"
- estimated_timeline: How long to implement (e.g., "1-2 weeks")
- priority_score: 0-100 based on impact vs effort
- source: Reference to which section/process in the SOP

Return a JSON array of opportunities. If you cannot identify any automation opportunities, return an empty array.
Focus on:
- Manual data entry that could be automated
- Approval workflows that could be streamlined
- Repetitive tasks that follow clear rules
- Communication/notification tasks that could be triggered automatically
- Reporting that could be auto-generated
- Document handling and routing`
      },
      {
        role: "user",
        content: `Analyze this SOP/document titled "${doc.title}" (category: ${doc.category}) for automation opportunities:\n\n${textContent}`
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  let opportunities: Array<{
    title: string;
    description: string;
    estimated_savings: number;
    savings_unit: string;
    complexity: string;
    estimated_timeline: string;
    priority_score: number;
    source: string;
  }> = [];

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    opportunities = parsed.opportunities || parsed.results || [];
    if (!Array.isArray(opportunities)) opportunities = [];
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // Insert opportunities into the database
  const inserted = [];
  for (const opp of opportunities) {
    // Generate slug
    const baseSlug = opp.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 50);
    let slug = baseSlug;
    let attempt = 0;
    while (attempt < 20) {
      const { data: existing } = await service.from("pm_opportunities").select("id").eq("org_id", org_id).eq("slug", slug).single();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const { data, error } = await service.from("pm_opportunities").insert({
      org_id,
      project_id: project_id || doc.project_id || null,
      slug,
      title: opp.title,
      description: opp.description || null,
      estimated_savings: opp.estimated_savings || 0,
      savings_unit: opp.savings_unit || "year",
      complexity: opp.complexity || "medium",
      estimated_timeline: opp.estimated_timeline || null,
      priority_score: opp.priority_score || 0,
      status: "identified",
      source: `SOP: ${doc.title}${opp.source ? ` — ${opp.source}` : ""}`,
    }).select().single();

    if (data) inserted.push(data);
  }

  return NextResponse.json({
    scanned: doc.title,
    opportunities_found: opportunities.length,
    opportunities_created: inserted.length,
    opportunities: inserted,
  });
}
