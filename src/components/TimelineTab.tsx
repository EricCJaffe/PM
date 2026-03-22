"use client";

import { useState, useMemo } from "react";
import type { Phase, Task, PMStatus } from "@/types/pm";

interface TimelineTabProps {
  phases: (Phase & { tasks: Task[] })[];
  projectStart: string;
  projectTarget: string | null;
}

const STATUS_COLORS: Record<PMStatus, string> = {
  "not-started": "#64748b",
  "in-progress": "#3b82f6",
  complete: "#22c55e",
  blocked: "#ef4444",
  pending: "#f59e0b",
  "on-hold": "#8b5cf6",
};

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d + "T00:00:00");
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function TimelineTab({ phases, projectStart, projectTarget }: TimelineTabProps) {
  const [showTasks, setShowTasks] = useState(false);

  // Compute timeline bounds
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let earliest = parseDate(projectStart) || new Date();
    let latest = parseDate(projectTarget) || addDays(earliest, 90);

    for (const phase of phases) {
      const ps = parseDate(phase.start_date);
      const pe = parseDate(phase.due_date);
      if (ps && ps < earliest) earliest = ps;
      if (pe && pe > latest) latest = pe;

      if (showTasks) {
        for (const task of phase.tasks) {
          const td = parseDate(task.due_date);
          if (td && td > latest) latest = td;
        }
      }
    }

    // Add padding
    const start = addDays(earliest, -7);
    const end = addDays(latest, 14);
    return { timelineStart: start, timelineEnd: end, totalDays: daysBetween(start, end) };
  }, [phases, projectStart, projectTarget, showTasks]);

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { label: string; left: number }[] = [];
    const cursor = new Date(timelineStart);
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1);

    while (cursor <= timelineEnd) {
      const offset = daysBetween(timelineStart, cursor);
      markers.push({
        label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        left: (offset / totalDays) * 100,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return markers;
  }, [timelineStart, timelineEnd, totalDays]);

  // Today marker
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = daysBetween(timelineStart, today);
  const todayPct = totalDays > 0 ? (todayOffset / totalDays) * 100 : -1;
  const showToday = todayPct >= 0 && todayPct <= 100;

  function getBarPosition(startDate: string | null, endDate: string | null) {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    if (!s && !e) return null;

    const barStart = s || (e ? addDays(e, -14) : timelineStart);
    const barEnd = e || addDays(barStart, 14);

    const leftDays = daysBetween(timelineStart, barStart);
    const widthDays = Math.max(daysBetween(barStart, barEnd), 1);

    return {
      left: Math.max((leftDays / totalDays) * 100, 0),
      width: Math.min((widthDays / totalDays) * 100, 100),
    };
  }

  const sortedPhases = [...phases].sort((a, b) => a.phase_order - b.phase_order);
  const phasesWithDates = sortedPhases.filter(
    (p) => p.start_date || p.due_date
  );
  const phasesWithoutDates = sortedPhases.filter(
    (p) => !p.start_date && !p.due_date
  );

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-pm-text">Project Timeline</h3>
        <label className="flex items-center gap-2 text-sm text-pm-muted cursor-pointer">
          <input
            type="checkbox"
            checked={showTasks}
            onChange={(e) => setShowTasks(e.target.checked)}
            className="rounded border-pm-border"
          />
          Show tasks
        </label>
      </div>

      {phasesWithDates.length === 0 ? (
        <div className="card p-8 text-center text-pm-muted">
          <p className="text-lg mb-2">No phase dates set yet</p>
          <p className="text-sm">
            Add start and due dates to phases in the Board or Tasks tab to see them on the timeline.
          </p>
        </div>
      ) : (
        <div className="card p-4 overflow-x-auto">
          {/* Header with month markers */}
          <div className="relative h-8 mb-2 border-b border-pm-border ml-48">
            {monthMarkers.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 text-xs text-pm-muted"
                style={{ left: `${m.left}%` }}
              >
                <div className="border-l border-pm-border h-6 -mb-1" />
                <span className="ml-1">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Phase rows */}
          {phasesWithDates.map((phase) => {
            const bar = getBarPosition(phase.start_date, phase.due_date);
            const color = STATUS_COLORS[phase.status] || STATUS_COLORS["not-started"];
            const progress = phase.progress || 0;

            return (
              <div key={phase.id}>
                {/* Phase bar */}
                <div className="flex items-center group min-h-[36px]">
                  <div className="w-48 flex-shrink-0 pr-3 truncate text-sm text-pm-text font-medium" title={phase.name}>
                    {phase.name}
                  </div>
                  <div className="flex-1 relative h-7">
                    {/* Grid lines */}
                    {monthMarkers.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-pm-border/30"
                        style={{ left: `${m.left}%` }}
                      />
                    ))}

                    {/* Today line */}
                    {showToday && (
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-red-500/60 z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                    )}

                    {bar && (
                      <div
                        className="absolute top-1 h-5 rounded-sm overflow-hidden cursor-default group/bar"
                        style={{
                          left: `${bar.left}%`,
                          width: `${bar.width}%`,
                          backgroundColor: `${color}33`,
                          border: `1px solid ${color}88`,
                          minWidth: "4px",
                        }}
                        title={`${phase.name}: ${phase.start_date ? formatDate(parseDate(phase.start_date)!) : "?"} – ${phase.due_date ? formatDate(parseDate(phase.due_date)!) : "?"} (${progress}%)`}
                      >
                        {/* Progress fill */}
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: `${color}aa`,
                          }}
                        />
                        {/* Label inside bar */}
                        {bar.width > 8 && (
                          <span
                            className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate"
                            style={{ color: "#fff" }}
                          >
                            {progress}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Task sub-rows */}
                {showTasks &&
                  phase.tasks
                    .filter((t) => t.due_date)
                    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
                    .map((task) => {
                      const taskBar = getBarPosition(null, task.due_date);
                      const taskColor = STATUS_COLORS[task.status] || STATUS_COLORS["not-started"];

                      return (
                        <div key={task.id} className="flex items-center min-h-[28px]">
                          <div className="w-48 flex-shrink-0 pr-3 pl-5 truncate text-xs text-pm-muted" title={task.name}>
                            {task.name}
                          </div>
                          <div className="flex-1 relative h-5">
                            {taskBar && (
                              <div
                                className="absolute top-1 h-3 rounded-full"
                                style={{
                                  left: `${taskBar.left}%`,
                                  width: "8px",
                                  backgroundColor: taskColor,
                                }}
                                title={`${task.name}: due ${task.due_date ? formatDate(parseDate(task.due_date)!) : "?"}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            );
          })}

          {/* Today legend */}
          {showToday && (
            <div className="mt-3 pt-2 border-t border-pm-border flex items-center gap-2 text-xs text-pm-muted ml-48">
              <div className="w-3 h-0.5 bg-red-500" />
              Today ({formatDate(today)})
            </div>
          )}
        </div>
      )}

      {/* Phases without dates */}
      {phasesWithoutDates.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-pm-muted mb-2">
            Phases without dates ({phasesWithoutDates.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {phasesWithoutDates.map((p) => (
              <span key={p.id} className="text-xs px-2 py-1 rounded bg-pm-card text-pm-muted border border-pm-border">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
