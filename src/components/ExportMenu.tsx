"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import type { Project, PhaseWithTasks, Task, Risk } from "@/types/pm";

interface ExportMenuProps {
  project: Project;
  phases: PhaseWithTasks[];
  tasks: Task[];
  risks: Risk[];
  memberMap: Record<string, string>;
}

export function ExportMenu({ project, phases, tasks, risks, memberMap }: ExportMenuProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  function exportXLSX() {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Project Plan (phases with tasks nested underneath) ──
    const planHeaders = ["Phase", "Task", "Status", "Owner", "Due Date", "Notes"];
    const planRows: (string | number)[][] = [planHeaders];

    const sortedPhases = [...phases].sort((a, b) => a.phase_order - b.phase_order);

    for (const ph of sortedPhases) {
      const phaseTasks = ph.tasks ?? [];
      const done = phaseTasks.filter((t: Task) => t.status === "complete").length;
      const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : (ph.progress ?? 0);
      const phaseLabel = `P${String(ph.phase_order).padStart(2, "0")} — ${ph.name}${ph.group ? ` [${ph.group}]` : ""}`;
      const phaseOwner = ph.owner ? (memberMap[ph.owner] ?? ph.owner) : "";

      // Phase header row
      planRows.push([
        phaseLabel,
        "",
        ph.status,
        phaseOwner,
        ph.due_date ?? "",
        `${pct}% complete · ${done}/${phaseTasks.length} tasks`,
      ]);

      // Task rows indented under the phase
      for (const t of phaseTasks) {
        planRows.push([
          "",
          `    ${t.name}`,
          t.status,
          t.owner ? (memberMap[t.owner] ?? t.owner) : "",
          t.due_date ?? "",
          t.description ?? "",
        ]);
      }

      // Tasks with no phase grouped here — skip; handled below
    }

    // Tasks not assigned to any phase
    const unassigned = tasks.filter((t) => !t.phase_id);
    if (unassigned.length > 0) {
      planRows.push(["— Unassigned Tasks —", "", "", "", "", ""]);
      for (const t of unassigned) {
        planRows.push([
          "",
          `    ${t.name}`,
          t.status,
          t.owner ? (memberMap[t.owner] ?? t.owner) : "",
          t.due_date ?? "",
          t.description ?? "",
        ]);
      }
    }

    const wsPlan = XLSX.utils.aoa_to_sheet(planRows);
    wsPlan["!cols"] = [{ wch: 40 }, { wch: 36 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsPlan, "Project Plan");

    // ── Sheet 2: Risks ─────────────────────────────────────────────
    const riskRows = risks.map((r) => ({
      Title: r.title,
      Probability: r.probability,
      Impact: r.impact,
      Status: r.status,
      Owner: r.owner ? (memberMap[r.owner] ?? r.owner) : "—",
      Mitigation: r.mitigation ?? "",
    }));
    const wsR = XLSX.utils.json_to_sheet(riskRows);
    wsR["!cols"] = [{ wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsR, "Risks");

    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${project.slug}-export-${date}.xlsx`);
  }

  async function generateAIReport() {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pm/reports/project-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to generate report");
        return;
      }
      const { html } = await res.json();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.addEventListener("load", () => {
          setTimeout(() => {
            win.print();
            URL.revokeObjectURL(url);
          }, 500);
        });
      } else {
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to generate report. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Excel export — direct click, no dropdown */}
      <button
        onClick={exportXLSX}
        className="px-3 py-1.5 text-sm rounded border border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-text transition-colors flex items-center gap-1.5"
        title="Export to Excel (.xlsx)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>

      {/* AI Project Report — prominent standalone button */}
      <button
        onClick={generateAIReport}
        disabled={pdfLoading}
        className="px-3 py-1.5 text-sm rounded border border-purple-500/40 text-purple-400 hover:border-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-wait transition-colors flex items-center gap-1.5"
        title="Generate AI project status report (PDF)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {pdfLoading ? "Generating…" : "AI Insights"}
      </button>
    </div>
  );
}
