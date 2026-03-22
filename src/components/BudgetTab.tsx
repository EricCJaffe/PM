"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Phase, Task } from "@/types/pm";

interface BudgetTabProps {
  phases: (Phase & { tasks: Task[] })[];
  projectBudget: number | null;
  projectId: string;
}

function currency(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

interface EditingCell {
  type: "phase" | "task";
  id: string;
  field: "estimated_cost" | "actual_cost";
}

export function BudgetTab({ phases, projectBudget, projectId }: BudgetTabProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Roll up totals
  const summary = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    let taskCount = 0;
    let tasksWithCosts = 0;

    const phaseBreakdown = phases.map((phase) => {
      let phaseEstimated = phase.estimated_cost || 0;
      let phaseActual = phase.actual_cost || 0;
      let phaseTaskEstimated = 0;
      let phaseTaskActual = 0;

      for (const task of phase.tasks) {
        taskCount++;
        if (task.estimated_cost || task.actual_cost) tasksWithCosts++;
        phaseTaskEstimated += task.estimated_cost || 0;
        phaseTaskActual += task.actual_cost || 0;
      }

      // Use task rollup if phase has no direct cost
      const effectiveEstimated = phaseEstimated || phaseTaskEstimated;
      const effectiveActual = phaseActual || phaseTaskActual;

      totalEstimated += effectiveEstimated;
      totalActual += effectiveActual;

      return {
        phase,
        phaseEstimated,
        phaseActual,
        phaseTaskEstimated,
        phaseTaskActual,
        effectiveEstimated,
        effectiveActual,
        variance: effectiveEstimated - effectiveActual,
      };
    });

    return {
      totalEstimated,
      totalActual,
      totalVariance: totalEstimated - totalActual,
      taskCount,
      tasksWithCosts,
      phaseBreakdown,
    };
  }, [phases]);

  const budget = projectBudget || 0;
  const budgetUsedPct = budget > 0 ? pct(summary.totalActual, budget) : 0;
  const overBudget = budget > 0 && summary.totalActual > budget;

  async function saveCost(type: "phase" | "task", id: string, field: "estimated_cost" | "actual_cost", value: string) {
    setSaving(true);
    try {
      const numValue = value.trim() === "" ? null : parseFloat(value.replace(/[,$]/g, ""));
      const endpoint = type === "phase" ? `/api/pm/phases/${id}` : `/api/pm/tasks/${id}`;
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: numValue }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  function startEdit(type: "phase" | "task", id: string, field: "estimated_cost" | "actual_cost", currentValue: number | null) {
    setEditing({ type, id, field });
    setEditValue(currentValue != null ? String(currentValue) : "");
  }

  function togglePhase(id: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderEditableCell(type: "phase" | "task", id: string, field: "estimated_cost" | "actual_cost", value: number | null) {
    const isEditing = editing?.type === type && editing?.id === id && editing?.field === field;

    if (isEditing) {
      return (
        <input
          type="number"
          autoFocus
          className="w-24 px-1 py-0.5 text-sm bg-pm-bg border border-blue-500 rounded text-pm-text text-right"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveCost(type, id, field, editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveCost(type, id, field, editValue);
            if (e.key === "Escape") setEditing(null);
          }}
          disabled={saving}
        />
      );
    }

    return (
      <button
        className="text-sm text-right w-24 px-1 py-0.5 rounded hover:bg-pm-border/50 transition-colors"
        onClick={() => startEdit(type, id, field, value)}
        title="Click to edit"
      >
        {currency(value)}
      </button>
    );
  }

  return (
    <div className="py-4">
      <h3 className="text-lg font-semibold text-pm-text mb-4">Budget vs Actuals</h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-3">
          <div className="text-xs text-pm-muted uppercase tracking-wide">Project Budget</div>
          <div className="text-xl font-bold text-pm-text mt-1">{budget > 0 ? currency(budget) : "Not set"}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-pm-muted uppercase tracking-wide">Estimated Total</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{currency(summary.totalEstimated || null)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-pm-muted uppercase tracking-wide">Actual Spend</div>
          <div className={`text-xl font-bold mt-1 ${overBudget ? "text-red-400" : "text-pm-complete"}`}>
            {currency(summary.totalActual || null)}
          </div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-pm-muted uppercase tracking-wide">Variance</div>
          <div className={`text-xl font-bold mt-1 ${summary.totalVariance < 0 ? "text-red-400" : "text-pm-complete"}`}>
            {summary.totalVariance !== 0 ? (summary.totalVariance > 0 ? "+" : "") + currency(summary.totalVariance) : "—"}
          </div>
        </div>
      </div>

      {/* Budget usage bar */}
      {budget > 0 && (
        <div className="card p-3 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-pm-muted">Budget Utilization</span>
            <span className={`font-medium ${overBudget ? "text-red-400" : "text-pm-text"}`}>
              {budgetUsedPct}% used
            </span>
          </div>
          <div className="w-full h-3 bg-pm-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : budgetUsedPct > 75 ? "bg-yellow-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
            />
          </div>
          {overBudget && (
            <p className="text-xs text-red-400 mt-1">
              Over budget by {currency(summary.totalActual - budget)}
            </p>
          )}
        </div>
      )}

      {/* Phase breakdown table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pm-border text-pm-muted text-xs uppercase tracking-wide">
              <th className="text-left p-3">Phase / Task</th>
              <th className="text-right p-3 w-28">Estimated</th>
              <th className="text-right p-3 w-28">Actual</th>
              <th className="text-right p-3 w-28">Variance</th>
              <th className="text-center p-3 w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.phaseBreakdown
              .sort((a, b) => a.phase.phase_order - b.phase.phase_order)
              .map(({ phase, effectiveEstimated, effectiveActual, variance }) => {
                const expanded = expandedPhases.has(phase.id);
                const tasksWithCosts = phase.tasks.filter(
                  (t) => t.estimated_cost || t.actual_cost
                );
                const hasTaskCosts = tasksWithCosts.length > 0;

                return (
                  <tbody key={phase.id}>
                    {/* Phase row */}
                    <tr className="border-b border-pm-border/50 hover:bg-pm-border/20">
                      <td className="p-3 font-medium text-pm-text">
                        <button
                          className="flex items-center gap-2 w-full text-left"
                          onClick={() => togglePhase(phase.id)}
                        >
                          <span className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>
                            {phase.tasks.length > 0 ? "▶" : "•"}
                          </span>
                          {phase.name}
                          {hasTaskCosts && (
                            <span className="text-xs text-pm-muted">
                              ({tasksWithCosts.length}/{phase.tasks.length} costed)
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        {renderEditableCell("phase", phase.id, "estimated_cost", phase.estimated_cost)}
                      </td>
                      <td className="p-3 text-right">
                        {renderEditableCell("phase", phase.id, "actual_cost", phase.actual_cost)}
                      </td>
                      <td className={`p-3 text-right text-sm ${variance < 0 ? "text-red-400" : variance > 0 ? "text-pm-complete" : "text-pm-muted"}`}>
                        {effectiveEstimated || effectiveActual
                          ? (variance > 0 ? "+" : "") + currency(variance)
                          : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: phase.status === "complete" ? "#22c55e" : phase.status === "in-progress" ? "#3b82f6" : phase.status === "blocked" ? "#ef4444" : "#64748b" }}
                        />
                      </td>
                    </tr>

                    {/* Task rows (expanded) */}
                    {expanded &&
                      phase.tasks.map((task) => {
                        const taskVariance = (task.estimated_cost || 0) - (task.actual_cost || 0);
                        return (
                          <tr key={task.id} className="border-b border-pm-border/30 bg-pm-bg/50">
                            <td className="p-3 pl-9 text-pm-muted">{task.name}</td>
                            <td className="p-3 text-right">
                              {renderEditableCell("task", task.id, "estimated_cost", task.estimated_cost)}
                            </td>
                            <td className="p-3 text-right">
                              {renderEditableCell("task", task.id, "actual_cost", task.actual_cost)}
                            </td>
                            <td className={`p-3 text-right text-sm ${taskVariance < 0 ? "text-red-400" : taskVariance > 0 ? "text-pm-complete" : "text-pm-muted"}`}>
                              {task.estimated_cost || task.actual_cost
                                ? (taskVariance > 0 ? "+" : "") + currency(taskVariance)
                                : "—"}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: task.status === "complete" ? "#22c55e" : task.status === "in-progress" ? "#3b82f6" : task.status === "blocked" ? "#ef4444" : "#64748b" }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                );
              })}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="border-t-2 border-pm-border font-semibold text-pm-text">
              <td className="p-3">Total</td>
              <td className="p-3 text-right text-blue-400">{currency(summary.totalEstimated || null)}</td>
              <td className="p-3 text-right">{currency(summary.totalActual || null)}</td>
              <td className={`p-3 text-right ${summary.totalVariance < 0 ? "text-red-400" : "text-pm-complete"}`}>
                {summary.totalEstimated || summary.totalActual
                  ? (summary.totalVariance > 0 ? "+" : "") + currency(summary.totalVariance)
                  : "—"}
              </td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      {summary.tasksWithCosts === 0 && summary.phaseBreakdown.every((p) => !p.phase.estimated_cost && !p.phase.actual_cost) && (
        <p className="text-sm text-pm-muted mt-4 text-center">
          Click any cost cell above to start entering estimates and actuals.
        </p>
      )}
    </div>
  );
}
