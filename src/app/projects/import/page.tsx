"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ParsedRow {
  name: string;
  section: string;
  notes: string;
  assignee: string;
  due_date: string;
  parent_task: string;
}

interface ParseResult {
  rows: ParsedRow[];
  sections: string[];
}

/**
 * /projects/import — Asana CSV import
 *
 * Accepts an Asana task export CSV and creates tasks under a selected org + project.
 * Sections become phases (or map to existing phases). Tasks become pm_tasks.
 *
 * Asana CSV columns (flexible, handles multiple export formats):
 *   Task ID, Task Name / Name, Section/Column, Assignee, Due Date, Notes / Description, Parent Task
 */

function parseAsanaCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], sections: [] };

  // Parse CSV respecting quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "_"));

  // Flexible column mapping
  const col = (names: string[]) => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameCol = col(["task_name", "name", "task"]);
  const sectionCol = col(["section_column", "section", "column", "project_section"]);
  const notesCol = col(["notes", "description", "task_notes"]);
  const assigneeCol = col(["assignee"]);
  const dueDateCol = col(["due_date", "due"]);
  const parentCol = col(["parent_task", "parent"]);

  const rows: ParsedRow[] = [];
  const sectionSet = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const name = nameCol >= 0 ? cols[nameCol] ?? "" : "";
    if (!name) continue; // skip blank rows

    const section = sectionCol >= 0 ? cols[sectionCol] ?? "" : "";
    if (section) sectionSet.add(section);

    rows.push({
      name,
      section,
      notes: notesCol >= 0 ? cols[notesCol] ?? "" : "",
      assignee: assigneeCol >= 0 ? cols[assigneeCol] ?? "" : "",
      due_date: dueDateCol >= 0 ? cols[dueDateCol] ?? "" : "",
      parent_task: parentCol >= 0 ? cols[parentCol] ?? "" : "",
    });
  }

  return { rows, sections: Array.from(sectionSet) };
}

export default function ImportPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [phases, setPhases] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [sectionToPhase, setSectionToPhase] = useState<Record<string, string>>({}); // section → phase_id

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ tasks_created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pm/organizations").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setOrgs(d);
    });
  }, []);

  useEffect(() => {
    if (!selectedOrg) { setProjects([]); setSelectedProject(""); return; }
    fetch(`/api/pm/projects?org_id=${selectedOrg}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setProjects(d);
    });
  }, [selectedOrg]);

  useEffect(() => {
    if (!selectedProject) { setPhases([]); return; }
    fetch(`/api/pm/phases?project_id=${selectedProject}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setPhases(d);
    });
  }, [selectedProject]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const p = parseAsanaCSV(text);
      setParsed(p);
      // Pre-map sections to phases by name match
      const initial: Record<string, string> = {};
      for (const section of p.sections) {
        const match = phases.find((ph) =>
          ph.name.toLowerCase() === section.toLowerCase() ||
          ph.slug.toLowerCase() === section.toLowerCase().replace(/\s+/g, "-")
        );
        if (match) initial[section] = match.id;
      }
      setSectionToPhase(initial);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!selectedProject || !parsed || parsed.rows.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const tasks = parsed.rows
        .filter((r) => !r.parent_task) // skip subtasks for now
        .map((row) => ({
          name: row.name,
          description: row.notes || null,
          phase_id: (row.section && sectionToPhase[row.section]) || null,
          project_id: selectedProject,
          org_id: selectedOrg || null,
          due_date: row.due_date || null,
          status: "not-started",
          source: "asana_import",
        }));

      const res = await fetch("/api/pm/tasks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult({ tasks_created: data.tasks_created, skipped: data.skipped ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-pm-muted hover:text-pm-text">
          &larr; Back
        </button>
      </div>

      <h1 className="text-2xl font-bold text-pm-text mb-1">Import from Asana</h1>
      <p className="text-sm text-pm-muted mb-8">
        Export tasks from Asana (Project → Export/Print → CSV), then upload here to import into a project.
      </p>

      {result ? (
        <div className="card text-center py-10 space-y-3">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-semibold text-pm-text">{result.tasks_created} tasks imported</p>
          {result.skipped > 0 && <p className="text-sm text-pm-muted">{result.skipped} rows skipped (subtasks or blank)</p>}
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => { setResult(null); setParsed(null); setCsvText(""); }}
              className="px-4 py-2 border border-pm-border rounded-lg text-sm text-pm-muted hover:text-pm-text"
            >
              Import Another
            </button>
            <button
              onClick={() => router.push(`/projects/${projects.find((p) => p.id === selectedProject)?.slug ?? ""}`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              View Project
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step 1 — Target */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-pm-text">1. Choose destination</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-pm-muted mb-1">Organization</label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select org…</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-pm-muted mb-1">Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={!selectedOrg}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2 — Upload CSV */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-pm-text">2. Upload Asana CSV export</h2>
            <p className="text-xs text-pm-muted">In Asana: open the project → ⋯ menu → Export/Print → CSV</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block text-sm text-pm-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 cursor-pointer"
            />

            {parsed && (
              <div className="mt-2 rounded-lg border border-pm-border bg-pm-bg px-4 py-3 text-sm">
                <span className="text-pm-text font-medium">{parsed.rows.length} tasks</span>
                <span className="text-pm-muted"> parsed</span>
                {parsed.sections.length > 0 && (
                  <span className="text-pm-muted"> · {parsed.sections.length} sections detected</span>
                )}
              </div>
            )}
          </div>

          {/* Step 3 — Map sections to phases */}
          {parsed && parsed.sections.length > 0 && phases.length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-semibold text-pm-text">3. Map Asana sections → project phases</h2>
              <p className="text-xs text-pm-muted">Tasks without a mapping will be imported without a phase.</p>
              <div className="space-y-2">
                {parsed.sections.map((section) => (
                  <div key={section} className="flex items-center gap-4">
                    <span className="text-sm text-pm-text w-48 shrink-0 truncate" title={section}>{section}</span>
                    <span className="text-pm-muted text-xs">→</span>
                    <select
                      value={sectionToPhase[section] ?? ""}
                      onChange={(e) => setSectionToPhase((prev) => ({ ...prev, [section]: e.target.value }))}
                      className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-2 py-1 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">(no phase)</option>
                      {phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {parsed && parsed.rows.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-pm-text mb-3">Preview (first 10 rows)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pm-border text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-pm-muted">Task</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-pm-muted">Section</th>
                      <th className="pb-2 text-xs font-medium text-pm-muted">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-pm-border/40">
                        <td className="py-1.5 pr-4 text-pm-text max-w-xs truncate">{row.name}</td>
                        <td className="py-1.5 pr-4 text-pm-muted text-xs">{row.section || "—"}</td>
                        <td className="py-1.5 text-pm-muted text-xs">{row.due_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm text-pm-muted hover:text-pm-text border border-pm-border rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedProject || !parsed || parsed.rows.length === 0 || importing}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {importing ? "Importing..." : `Import ${parsed ? parsed.rows.filter((r) => !r.parent_task).length : 0} Tasks`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
