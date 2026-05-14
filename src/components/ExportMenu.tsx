"use client";

import { useState, useRef, useEffect } from "react";
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
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function exportXLSX() {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Tasks ─────────────────────────────────────────────
    const phaseNameById: Record<string, string> = {};
    for (const ph of phases) phaseNameById[ph.id] = ph.name;

    const taskRows = tasks.map((t) => ({
      Phase: t.phase_id ? (phaseNameById[t.phase_id] ?? "—") : "—",
      Task: t.name,
      Status: t.status,
      Owner: t.owner ? (memberMap[t.owner] ?? t.owner) : "—",
      "Due Date": t.due_date ?? "—",
      Description: t.description ?? "",
    }));
    const wsT = XLSX.utils.json_to_sheet(taskRows);
    wsT["!cols"] = [{ wch: 28 }, { wch: 36 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsT, "Tasks");

    // ── Sheet 2: Phases ────────────────────────────────────────────
    const phaseRows = phases.map((ph) => {
      const phaseTasks = ph.tasks ?? [];
      const done = phaseTasks.filter((t) => t.status === "complete").length;
      const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : (ph.progress ?? 0);
      return {
        "#": ph.phase_order,
        Phase: ph.name,
        Group: ph.group ?? "—",
        Status: ph.status,
        "Progress %": pct,
        "Start Date": ph.start_date ?? "—",
        "Due Date": ph.due_date ?? "—",
        Owner: ph.owner ? (memberMap[ph.owner] ?? ph.owner) : "—",
      };
    });
    const wsPh = XLSX.utils.json_to_sheet(phaseRows);
    wsPh["!cols"] = [{ wch: 4 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsPh, "Phases");

    // ── Sheet 3: Risks ─────────────────────────────────────────────
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
    setOpen(false);
  }

  async function exportPDF() {
    setPdfLoading(true);
    setOpen(false);
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
      // Use Blob URL to avoid document.write XSS risk
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-sm rounded border border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-text transition-colors flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 rounded-lg border border-pm-border bg-pm-card shadow-xl z-50 py-1">
          <button
            onClick={exportXLSX}
            className="w-full text-left px-4 py-2.5 text-sm text-pm-text hover:bg-white/5 flex items-center gap-2.5"
          >
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to Excel
          </button>
          <button
            onClick={exportPDF}
            disabled={pdfLoading}
            className="w-full text-left px-4 py-2.5 text-sm text-pm-text hover:bg-white/5 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-wait"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {pdfLoading ? "Generating…" : "AI Project Report (PDF)"}
          </button>
        </div>
      )}
    </div>
  );
}
