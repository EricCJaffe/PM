"use client";

import { useState, useEffect } from "react";
import type { DepartmentIntake } from "@/types/pm";

const PILLAR_QUESTIONS: Record<string, Array<{ id: string; label: string; type: "text" | "textarea" | "checkbox" }>> = {
  vision: [
    { id: "department_purpose", label: "What is this department's primary purpose?", type: "textarea" },
    { id: "mission_contribution", label: "How does this department contribute to the organization's mission?", type: "textarea" },
    { id: "top_goals", label: "What are this department's top 3 goals for the year?", type: "textarea" },
    { id: "goals_documented", label: "Are these goals written down and tracked?", type: "text" },
    { id: "success_definition", label: "How does the department define success?", type: "textarea" },
    { id: "ideal_12_months", label: "What would 'excellent' look like for this department in 12 months?", type: "textarea" },
  ],
  people: [
    { id: "job_descriptions", label: "Does each person have a written job description?", type: "text" },
    { id: "roles_clear", label: "Are roles and responsibilities clear, or is there overlap/confusion?", type: "textarea" },
    { id: "accountability_chart", label: "Is there an accountability chart? (who owns what outcomes)", type: "text" },
    { id: "onboarding_process", label: "How are new team members onboarded?", type: "textarea" },
    { id: "training_development", label: "What training or development exists?", type: "textarea" },
    { id: "staffing_gaps", label: "Are there any staffing gaps or capacity issues?", type: "textarea" },
    { id: "go_to_person", label: "Who is the 'go-to' person when something breaks?", type: "text" },
  ],
  data: [
    { id: "current_kpis", label: "What KPIs or metrics does this department currently track?", type: "textarea" },
    { id: "how_measured", label: "How are they measured? (spreadsheet, dashboard, software, gut feel?)", type: "text" },
    { id: "review_frequency", label: "How often are metrics reviewed? By whom?", type: "text" },
    { id: "missing_metrics", label: "What metrics should be tracked but aren't?", type: "textarea" },
    { id: "scorecard_exists", label: "Is there a scorecard or dashboard? Who maintains it?", type: "text" },
    { id: "tribal_knowledge", label: "What data lives in people's heads that should be in a system?", type: "textarea" },
  ],
  processes: [
    { id: "top_processes", label: "What are the top 5-10 recurring processes in this department?", type: "textarea" },
    { id: "documented", label: "Are any of these documented? (SOPs, checklists, playbooks)", type: "text" },
    { id: "most_manual_task", label: "What is the most manual or tedious task?", type: "textarea" },
    { id: "most_time_consuming", label: "What task takes the most time each week?", type: "textarea" },
    { id: "handoffs", label: "Are there handoffs to other departments? How do they work?", type: "textarea" },
    { id: "key_person_absent", label: "What happens when the key person is out sick or on vacation?", type: "textarea" },
    { id: "paper_based", label: "What processes are paper-based or in spreadsheets that could be digital?", type: "textarea" },
    { id: "approval_workflows", label: "What approval workflows exist? Are they bottlenecks?", type: "textarea" },
  ],
  meetings: [
    { id: "recurring_meetings", label: "What recurring meetings does this department have? (daily, weekly, monthly, quarterly)", type: "textarea" },
    { id: "meeting_format", label: "What is the agenda/format for each meeting?", type: "textarea" },
    { id: "meeting_effectiveness", label: "How long are meetings? Are they effective?", type: "text" },
    { id: "communication_tools", label: "What communication tools are used? (email, Slack, Teams, text, in-person)", type: "text" },
    { id: "cross_dept_communication", label: "How does this department communicate with other departments?", type: "textarea" },
    { id: "communication_gaps", label: "Where do things fall through the cracks in communication?", type: "textarea" },
  ],
  issues: [
    { id: "top_frustrations", label: "What are the top 3 frustrations in this department?", type: "textarea" },
    { id: "dreaded_tasks", label: "What tasks do people dread doing?", type: "textarea" },
    { id: "errors_rework", label: "Where do errors or rework happen most often?", type: "textarea" },
    { id: "takes_too_long", label: "What takes too long?", type: "textarea" },
    { id: "recurring_problems", label: "What problems keep coming back even after being 'fixed'?", type: "textarea" },
    { id: "magic_wand", label: "If you had a magic wand, what one thing would you change?", type: "textarea" },
  ],
};

const PILLAR_LABELS: Record<string, string> = {
  vision: "Mission & Goals",
  people: "People & Organization",
  data: "Metrics & Data",
  processes: "Processes & SOPs",
  meetings: "Meetings & Communication",
  issues: "Pain Points & Issues",
};

interface DeptWithIntake extends DepartmentIntake {
  pm_departments: { id: string; name: string; slug: string; head_name: string | null };
}

export function PortalProcessDiscoveryView({
  workflowId,
}: {
  workflowId: string;
}) {
  const [intakes, setIntakes] = useState<DeptWithIntake[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [activePillar, setActivePillar] = useState<string>("vision");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/pm/department-intake?workflow_id=${workflowId}`)
      .then((r) => r.json())
      .then((data: DeptWithIntake[]) => {
        if (Array.isArray(data)) {
          setIntakes(data);
          if (data.length > 0) setActiveDeptId(data[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [workflowId]);

  const activeIntake = intakes.find((i) => i.id === activeDeptId);
  const responses = (activeIntake?.responses || {}) as Record<string, Record<string, string>>;

  const updateResponse = (pillar: string, questionId: string, value: string) => {
    if (!activeIntake) return;
    const updated = {
      ...responses,
      [pillar]: {
        ...(responses[pillar] || {}),
        [questionId]: value,
      },
    };
    setIntakes((prev) =>
      prev.map((i) =>
        i.id === activeIntake.id ? { ...i, responses: updated } : i
      )
    );
    setSaved(false);
  };

  const handleSave = async () => {
    if (!activeIntake) return;
    setSaving(true);
    try {
      const currentResponses = intakes.find((i) => i.id === activeIntake.id)?.responses || {};
      const res = await fetch(`/api/pm/department-intake/${activeIntake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: currentResponses }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIntakes((prev) => prev.map((i) => (i.id === data.id ? { ...data, pm_departments: i.pm_departments } : i)));
      setSaved(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-pm-muted text-sm py-8">Loading department forms...</p>;

  if (intakes.length === 0) {
    return (
      <div className="bg-pm-card border border-pm-border rounded-lg p-8 text-center">
        <p className="text-pm-muted text-sm">No departments set up yet.</p>
      </div>
    );
  }

  // Calculate overall progress
  const pillars = Object.keys(PILLAR_QUESTIONS);
  const totalQuestions = intakes.length * pillars.reduce((sum, p) => sum + PILLAR_QUESTIONS[p].length, 0);
  const answeredQuestions = intakes.reduce((sum, intake) => {
    const resp = (intake.responses || {}) as Record<string, Record<string, string>>;
    return sum + pillars.reduce((pSum, p) => {
      const answers = resp[p] || {};
      return pSum + Object.values(answers).filter((v) => v && v.trim()).length;
    }, 0);
  }, 0);
  const overallProgress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="bg-pm-card border border-pm-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-pm-text">Department Discovery Progress</h3>
          <span className="text-xs text-pm-muted">{overallProgress}% complete</span>
        </div>
        <div className="w-full h-2 bg-pm-bg rounded-full">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      {/* Department selector */}
      <div className="flex gap-2 flex-wrap">
        {intakes.map((intake) => {
          const dept = intake.pm_departments;
          const deptResponses = (intake.responses || {}) as Record<string, Record<string, string>>;
          const deptAnswered = pillars.reduce((sum, p) => {
            const answers = deptResponses[p] || {};
            return sum + Object.values(answers).filter((v) => v && v.trim()).length;
          }, 0);
          const deptTotal = pillars.reduce((sum, p) => sum + PILLAR_QUESTIONS[p].length, 0);
          const pct = deptTotal > 0 ? Math.round((deptAnswered / deptTotal) * 100) : 0;

          return (
            <button
              key={intake.id}
              onClick={() => { setActiveDeptId(intake.id); setSaved(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDeptId === intake.id
                  ? "bg-pm-accent text-white"
                  : "border border-pm-border text-pm-muted hover:text-pm-text"
              }`}
            >
              {dept.name}
              <span className="ml-2 text-xs opacity-75">{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Active department form */}
      {activeIntake && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-pm-text">{activeIntake.pm_departments.name}</h3>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-pm-accent hover:opacity-90 disabled:opacity-50 text-white text-sm rounded-lg font-medium"
            >
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save Responses"}
            </button>
          </div>

          {/* Pillar tabs */}
          <div className="flex gap-1 flex-wrap border-b border-pm-border">
            {pillars.map((pillar) => {
              const pillarResponses = responses[pillar] || {};
              const answered = Object.values(pillarResponses).filter((v) => v && String(v).trim()).length;
              const total = PILLAR_QUESTIONS[pillar].length;

              return (
                <button
                  key={pillar}
                  onClick={() => setActivePillar(pillar)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                    activePillar === pillar
                      ? "border-pm-accent text-pm-accent"
                      : "border-transparent text-pm-muted hover:text-pm-text"
                  }`}
                >
                  {PILLAR_LABELS[pillar]}
                  {answered > 0 && (
                    <span className="ml-1 text-[10px] opacity-60">{answered}/{total}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Questions for active pillar */}
          <div className="space-y-4">
            {PILLAR_QUESTIONS[activePillar]?.map((q) => {
              const value = responses[activePillar]?.[q.id] || "";
              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-pm-text mb-1">{q.label}</label>
                  {q.type === "textarea" ? (
                    <textarea
                      value={value}
                      onChange={(e) => updateResponse(activePillar, q.id, e.target.value)}
                      rows={3}
                      className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateResponse(activePillar, q.id, e.target.value)}
                      className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-pm-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save All Responses"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
