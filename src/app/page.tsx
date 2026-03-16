"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { PMStatus, Subtask } from "@/types/pm";

interface DashTask {
  id: string;
  name: string;
  description: string | null;
  status: PMStatus;
  owner: string | null;
  assigned_to: string | null;
  due_date: string | null;
  subtasks: Subtask[];
  project_id: string | null;
  project_name: string | null;
}

interface MemberOption {
  slug: string;
  display_name: string;
}

export default function HomePage() {
  const [tasks, setTasks] = useState<DashTask[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<DashTask | null>(null);

  // Load members then tasks
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((orgs) => {
        if (!Array.isArray(orgs) || orgs.length === 0) { setLoading(false); return; }
        return fetch(`/api/pm/members/assignable?org_id=${orgs[0].id}`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const m = data.map((d: { slug: string; display_name: string }) => ({
                slug: d.slug,
                display_name: d.display_name,
              }));
              setMembers(m);
              if (m.length > 0) setSelectedMember(m[0].slug);
            }
          });
      })
      .catch(() => {})
      .finally(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMember) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/pm/tasks/my?assigned_to=${selectedMember}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTasks(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMember]);

  const today = new Date().toISOString().slice(0, 10);

  // Split into overdue, upcoming, completed
  const activeTasks = tasks.filter((t) => t.status !== "complete");
  const completedTasks = tasks.filter((t) => t.status === "complete").slice(0, 10);

  const overdueTasks = activeTasks.filter((t) => t.due_date && t.due_date < today);
  const upcomingTasks = activeTasks.filter((t) => !t.due_date || t.due_date >= today);

  // Sort both by due_date (nulls last)
  const sortByDue = (a: DashTask, b: DashTask) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  };
  overdueTasks.sort(sortByDue);
  upcomingTasks.sort(sortByDue);

  const memberName = (slug: string) => members.find((m) => m.slug === slug)?.display_name || slug;
  const memberMap = Object.fromEntries(members.map((m) => [m.slug, m.display_name]));

  function TaskRow({ task, isOverdue }: { task: DashTask; isOverdue?: boolean }) {
    return (
      <div
        onClick={() => setSelectedTask(task)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
          isOverdue
            ? "bg-red-500/5 border border-red-500/20 hover:bg-red-500/10"
            : "hover:bg-pm-bg/50 border border-transparent hover:border-pm-border/50"
        }`}
      >
        <StatusBadge status={task.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-pm-text truncate">{task.name}</div>
          {task.project_name && (
            <div className="text-xs text-pm-muted">{task.project_name}</div>
          )}
          {!task.project_name && task.project_id === null && (
            <div className="text-xs text-pm-muted italic">Personal</div>
          )}
        </div>
        {task.due_date && (
          <span className={`text-xs shrink-0 font-medium ${isOverdue ? "text-red-400" : "text-pm-muted"}`}>
            {isOverdue ? `Overdue: ${task.due_date}` : task.due_date}
          </span>
        )}
        {!task.due_date && <span className="text-xs text-pm-muted/50 shrink-0">No due date</span>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-pm-text">Dashboard</h1>
          <p className="text-pm-muted mt-1">
            {selectedMember ? `Welcome back, ${memberName(selectedMember)}` : "Your task overview"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          >
            {members.map((m) => (
              <option key={m.slug} value={m.slug}>{m.display_name}</option>
            ))}
          </select>
          <Link
            href="/my-tasks"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            All Tasks
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-red-400">{overdueTasks.length}</div>
          <div className="text-xs text-pm-muted mt-1">Overdue</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-in-progress">{activeTasks.filter((t) => t.status === "in-progress").length}</div>
          <div className="text-xs text-pm-muted mt-1">In Progress</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-text">{upcomingTasks.length}</div>
          <div className="text-xs text-pm-muted mt-1">Upcoming</div>
        </div>
        <div className="card text-center py-4">
          <div className="text-2xl font-bold text-pm-complete">{completedTasks.length}</div>
          <div className="text-xs text-pm-muted mt-1">Recently Done</div>
        </div>
      </div>

      {loading ? (
        <p className="text-pm-muted">Loading tasks...</p>
      ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="text-center py-16 text-pm-muted">
          <p className="text-lg mb-2">No tasks assigned</p>
          <p className="text-sm">Head to <Link href="/my-tasks" className="text-pm-accent hover:underline">My Tasks</Link> to create some.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Overdue ({overdueTasks.length})
              </h2>
              <div className="space-y-1">
                {overdueTasks.map((t) => <TaskRow key={t.id} task={t} isOverdue />)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcomingTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-pm-muted mb-2">Upcoming ({upcomingTasks.length})</h2>
              <div className="space-y-1">
                {upcomingTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}

          {/* Recently completed */}
          {completedTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-pm-muted mb-2">Recently Completed</h2>
              <div className="space-y-1 opacity-60">
                {completedTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="mt-10 grid grid-cols-3 gap-4">
        <Link href="/projects" className="card text-center py-4 hover:border-pm-muted/50 transition-colors">
          <div className="text-sm font-medium text-pm-text">Projects</div>
          <div className="text-xs text-pm-muted mt-1">View all projects</div>
        </Link>
        <Link href="/clients" className="card text-center py-4 hover:border-pm-muted/50 transition-colors">
          <div className="text-sm font-medium text-pm-text">Clients</div>
          <div className="text-xs text-pm-muted mt-1">Manage clients</div>
        </Link>
        <Link href="/my-tasks" className="card text-center py-4 hover:border-pm-muted/50 transition-colors">
          <div className="text-sm font-medium text-pm-text">My Tasks</div>
          <div className="text-xs text-pm-muted mt-1">Full task manager</div>
        </Link>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          memberMap={memberMap}
          onClose={() => {
            setSelectedTask(null);
            // Reload tasks
            if (selectedMember) {
              fetch(`/api/pm/tasks/my?assigned_to=${selectedMember}`)
                .then((r) => r.json())
                .then((data) => { if (Array.isArray(data)) setTasks(data); })
                .catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}
