"use client";

import { useState, useEffect } from "react";
import type {
  Organization,
  DiscoveryInterview,
  OnboardingChecklist,
  OnboardingChecklistCategory,
  OnboardingStatus,
  Project,
} from "@/types/pm";
import { Modal, Field, Input, Select, Textarea, ModalActions } from "@/components/Modal";

/** Simple markdown → HTML converter for AI-generated summaries */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    // Ordered lists
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr>")
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hulo]|<li|<hr)(.+)$/gm, "<p>$1</p>")
    // Clean up
    .replace(/<p><\/p>/g, "")
    .replace(/\n/g, "<br>");
}

const ONBOARDING_STEPS: { key: OnboardingStatus; label: string }[] = [
  { key: "not-started", label: "Not Started" },
  { key: "discovery", label: "Discovery" },
  { key: "gap-analysis", label: "Gap Analysis" },
  { key: "planning", label: "Planning" },
  { key: "active", label: "Active" },
  { key: "complete", label: "Complete" },
];

const CHECKLIST_CATEGORIES: { key: OnboardingChecklistCategory; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "setup", label: "Setup" },
  { key: "kickoff", label: "Kickoff" },
  { key: "documentation", label: "Documentation" },
  { key: "handoff", label: "Handoff" },
];

const INTERVIEW_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400",
  completed: "bg-green-500/10 text-green-400",
  cancelled: "bg-red-500/10 text-red-400",
  "follow-up": "bg-yellow-500/10 text-yellow-400",
};

function StepIndicator({ current }: { current: OnboardingStatus }) {
  const currentIdx = ONBOARDING_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1">
      {ONBOARDING_STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`w-6 h-0.5 ${
                  isComplete ? "bg-green-500" : "bg-pm-border"
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-pm-border text-pm-muted"
                }`}
              >
                {isComplete ? "\u2713" : i + 1}
              </div>
              <span
                className={`text-[10px] mt-1 whitespace-nowrap ${
                  isCurrent ? "text-blue-400 font-medium" : "text-pm-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface DiscoverySummary {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export function OnboardingTab({ org }: { org: Organization }) {
  // Onboarding projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [handingOff, setHandingOff] = useState<string | null>(null);

  // Discovery interviews
  const [interviews, setInterviews] = useState<DiscoveryInterview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    interviewee_name: "",
    interviewee_role: "",
    interview_date: new Date().toISOString().split("T")[0],
    duration_minutes: "",
    focus_areas: "",
    status: "scheduled" as DiscoveryInterview["status"],
  });

  // Onboarding checklist
  const [checklist, setChecklist] = useState<OnboardingChecklist[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  // Discovery findings summary
  const [summaries, setSummaries] = useState<DiscoverySummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);

  // ─── Load onboarding projects ───
  const loadProjects = () => {
    setLoadingProjects(true);
    fetch(`/api/pm/projects?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data.filter((p: Project) => p.project_type === "onboarding"));
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  };

  // ─── Load interviews ───
  const loadInterviews = () => {
    setLoadingInterviews(true);
    fetch(`/api/pm/discovery-interviews?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInterviews(data);
      })
      .catch(() => setInterviews([]))
      .finally(() => setLoadingInterviews(false));
  };

  // ─── Load checklist for a project ───
  const loadChecklist = (projectId: string) => {
    setLoadingChecklist(true);
    fetch(`/api/pm/onboarding?project_id=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChecklist(data);
        else if (data.checklist && Array.isArray(data.checklist)) setChecklist(data.checklist);
      })
      .catch(() => setChecklist([]))
      .finally(() => setLoadingChecklist(false));
  };

  // ─── Load discovery summaries ───
  const loadSummaries = () => {
    setLoadingSummaries(true);
    fetch(`/api/pm/discovery-findings?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.summaries) setSummaries(data.summaries);
      })
      .catch(() => setSummaries([]))
      .finally(() => setLoadingSummaries(false));
  };

  // ─── Generate discovery brief ───
  const handleGenerateBrief = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/pm/discovery-findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      loadSummaries();
      if (data.saved_note_id) {
        setExpandedSummary(data.saved_note_id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate discovery brief");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadProjects();
    loadInterviews();
    loadSummaries();
  }, [org.id]);

  // Load checklist when onboarding project is available
  useEffect(() => {
    if (projects.length > 0) {
      loadChecklist(projects[0].id);
    }
  }, [projects]);

  // ─── Create onboarding project ───
  const handleCreateOnboarding = async () => {
    setCreatingProject(true);
    try {
      const res = await fetch("/api/pm/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          project_name: `${org.name} - Onboarding`,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create onboarding project");
    } finally {
      setCreatingProject(false);
    }
  };

  // ─── Handoff to process project ───
  const handleHandoff = async (onboardingProject: Project) => {
    setHandingOff(onboardingProject.id);
    try {
      const res = await fetch("/api/pm/projects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          template_slug: "custom",
          name: `${org.name} - Process Project`,
          parent_project_id: onboardingProject.id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert("Process project created successfully.");
      loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create process project");
    } finally {
      setHandingOff(null);
    }
  };

  // ─── Create interview ───
  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewForm.title) return;
    setSavingInterview(true);
    try {
      const res = await fetch("/api/pm/discovery-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          title: interviewForm.title,
          interviewee_name: interviewForm.interviewee_name || null,
          interviewee_role: interviewForm.interviewee_role || null,
          interview_date: interviewForm.interview_date,
          duration_minutes: interviewForm.duration_minutes
            ? parseInt(interviewForm.duration_minutes, 10)
            : null,
          focus_areas: interviewForm.focus_areas
            ? interviewForm.focus_areas.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          status: interviewForm.status,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInterviews((prev) => [data, ...prev]);
      setShowInterviewModal(false);
      setInterviewForm({
        title: "",
        interviewee_name: "",
        interviewee_role: "",
        interview_date: new Date().toISOString().split("T")[0],
        duration_minutes: "",
        focus_areas: "",
        status: "scheduled",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create interview");
    } finally {
      setSavingInterview(false);
    }
  };

  // ─── Toggle checklist item status ───
  const cycleChecklistStatus = async (item: OnboardingChecklist) => {
    const nextStatus: Record<string, OnboardingChecklist["status"]> = {
      pending: "in-progress",
      "in-progress": "complete",
      complete: "pending",
      skipped: "pending",
    };
    const newStatus = nextStatus[item.status] || "pending";
    try {
      const res = await fetch(`/api/pm/onboarding/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      setChecklist((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, status: newStatus } : c))
      );
    } catch {
      // silently fail
    }
  };

  const checklistStatusIcon = (status: OnboardingChecklist["status"]) => {
    switch (status) {
      case "complete":
        return (
          <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
            {"\u2713"}
          </span>
        );
      case "in-progress":
        return (
          <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
            {"\u25B6"}
          </span>
        );
      case "skipped":
        return (
          <span className="w-5 h-5 rounded-full bg-pm-border flex items-center justify-center text-pm-muted text-xs">
            {"\u2212"}
          </span>
        );
      default:
        return (
          <span className="w-5 h-5 rounded-full border-2 border-pm-border flex items-center justify-center" />
        );
    }
  };

  const groupedChecklist = CHECKLIST_CATEGORIES.map((cat) => ({
    ...cat,
    items: checklist
      .filter((c) => c.category === cat.key)
      .sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {/* ─── Section 0: Discovery Findings Summary ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">Discovery Findings Brief</h3>
          <button
            onClick={handleGenerateBrief}
            disabled={generating}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Generate Brief
              </>
            )}
          </button>
        </div>

        {loadingSummaries ? (
          <p className="text-pm-muted text-sm">Loading summaries...</p>
        ) : summaries.length === 0 ? (
          <div className="card border-dashed border-pm-border/50">
            <div className="text-center py-8 text-pm-muted">
              <svg className="w-10 h-10 mx-auto mb-3 text-pm-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm mb-1">No discovery brief generated yet</p>
              <p className="text-xs text-pm-muted/70">
                Add interviews, notes, gap analysis items, or run a site audit, then generate a comprehensive brief.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map((s) => (
              <div key={s.id} className="card">
                <button
                  onClick={() => setExpandedSummary(expandedSummary === s.id ? null : s.id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h4 className="font-medium text-pm-text text-sm">{s.title}</h4>
                    <p className="text-xs text-pm-muted mt-0.5">
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-pm-muted transition-transform ${
                      expandedSummary === s.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSummary === s.id && (
                  <div className="mt-4 pt-4 border-t border-pm-border">
                    <div
                      className="prose prose-invert prose-sm max-w-none text-pm-text
                        prose-headings:text-pm-text prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2
                        prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1
                        prose-p:text-pm-muted prose-p:text-sm prose-p:leading-relaxed
                        prose-li:text-pm-muted prose-li:text-sm
                        prose-strong:text-pm-text prose-strong:font-semibold
                        prose-ul:my-1 prose-ol:my-1"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(s.body) }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 1: Onboarding Projects ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">Onboarding Projects</h3>
          {projects.length === 0 && !loadingProjects && (
            <button
              onClick={handleCreateOnboarding}
              disabled={creatingProject}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              {creatingProject ? "Creating..." : "+ Create Onboarding Project"}
            </button>
          )}
        </div>

        {loadingProjects ? (
          <p className="text-pm-muted">Loading onboarding projects...</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-pm-muted">
            <p className="text-lg mb-2">No onboarding projects yet</p>
            <p className="text-sm">
              Create an onboarding project to start the discovery and setup process for this
              client.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-pm-text">{project.name}</h4>
                    {project.description && (
                      <p className="text-sm text-pm-muted mt-1">{project.description}</p>
                    )}
                  </div>
                  <span className="status-badge status-in-progress text-xs">
                    {project.status}
                  </span>
                </div>
                <StepIndicator current={project.onboarding_status} />
                {(project.onboarding_status === "active" ||
                  project.onboarding_status === "complete") && (
                  <div className="mt-4 pt-4 border-t border-pm-border">
                    <button
                      onClick={() => handleHandoff(project)}
                      disabled={handingOff === project.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {handingOff === project.id
                        ? "Creating Process Project..."
                        : "Handoff to Process Project"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 2: Discovery Interviews ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-pm-text">
            Discovery Interviews ({interviews.length})
          </h3>
          <button
            onClick={() => setShowInterviewModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            + Add Interview
          </button>
        </div>

        {loadingInterviews ? (
          <p className="text-pm-muted">Loading interviews...</p>
        ) : interviews.length === 0 ? (
          <div className="text-center py-12 text-pm-muted">
            <p className="text-lg mb-2">No discovery interviews yet</p>
            <p className="text-sm">
              Schedule interviews to gather requirements and understand the client&apos;s
              needs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {interviews.map((interview) => (
              <div key={interview.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-pm-text text-sm">{interview.title}</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      INTERVIEW_STATUS_COLORS[interview.status] || "bg-pm-border text-pm-muted"
                    }`}
                  >
                    {interview.status}
                  </span>
                </div>

                {(interview.interviewee_name || interview.interviewee_role) && (
                  <p className="text-sm text-pm-muted mb-1">
                    {interview.interviewee_name}
                    {interview.interviewee_role && (
                      <span className="text-pm-muted/70">
                        {" "}
                        &middot; {interview.interviewee_role}
                      </span>
                    )}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-pm-muted mb-3">
                  <span>
                    {new Date(interview.interview_date).toLocaleDateString()}
                  </span>
                  {interview.duration_minutes && (
                    <span>{interview.duration_minutes} min</span>
                  )}
                </div>

                {interview.focus_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {interview.focus_areas.map((area, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-pm-border/50 text-pm-muted rounded text-[10px]"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-pm-muted">
                  {interview.key_findings.length > 0 && (
                    <span>{interview.key_findings.length} finding{interview.key_findings.length !== 1 ? "s" : ""}</span>
                  )}
                  {interview.action_items.length > 0 && (
                    <span>{interview.action_items.length} action item{interview.action_items.length !== 1 ? "s" : ""}</span>
                  )}
                  {interview.follow_up_needed && (
                    <span className="text-yellow-400">Follow-up needed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Interview Modal */}
        {showInterviewModal && (
          <Modal title="Add Discovery Interview" onClose={() => setShowInterviewModal(false)}>
            <form onSubmit={handleCreateInterview}>
              <Field label="Title *">
                <Input
                  required
                  value={interviewForm.title}
                  onChange={(e) =>
                    setInterviewForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. IT Department Discovery"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Interviewee Name">
                  <Input
                    value={interviewForm.interviewee_name}
                    onChange={(e) =>
                      setInterviewForm((f) => ({ ...f, interviewee_name: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Interviewee Role">
                  <Input
                    value={interviewForm.interviewee_role}
                    onChange={(e) =>
                      setInterviewForm((f) => ({ ...f, interviewee_role: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Interview Date">
                  <Input
                    type="date"
                    value={interviewForm.interview_date}
                    onChange={(e) =>
                      setInterviewForm((f) => ({ ...f, interview_date: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <Input
                    type="number"
                    value={interviewForm.duration_minutes}
                    onChange={(e) =>
                      setInterviewForm((f) => ({ ...f, duration_minutes: e.target.value }))
                    }
                    placeholder="e.g. 60"
                  />
                </Field>
              </div>
              <Field label="Focus Areas" hint="Comma-separated list">
                <Input
                  value={interviewForm.focus_areas}
                  onChange={(e) =>
                    setInterviewForm((f) => ({ ...f, focus_areas: e.target.value }))
                  }
                  placeholder="e.g. Infrastructure, Security, Workflows"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={interviewForm.status}
                  onChange={(e) =>
                    setInterviewForm((f) => ({
                      ...f,
                      status: e.target.value as DiscoveryInterview["status"],
                    }))
                  }
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="follow-up">Follow-up</option>
                </Select>
              </Field>
              <ModalActions onClose={() => setShowInterviewModal(false)} saving={savingInterview} label="Add Interview" />
            </form>
          </Modal>
        )}
      </div>

      {/* ─── Section 3: Onboarding Checklist ─── */}
      {projects.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-pm-text mb-4">Onboarding Checklist</h3>
          {loadingChecklist ? (
            <p className="text-pm-muted">Loading checklist...</p>
          ) : groupedChecklist.length === 0 ? (
            <div className="text-center py-8 text-pm-muted">
              <p className="text-sm">No checklist items found for this onboarding project.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedChecklist.map((group) => (
                <div key={group.key}>
                  <h4 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-2">
                    {group.label}
                  </h4>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => cycleChecklistStatus(item)}
                        className="w-full card flex items-center gap-3 text-left hover:border-blue-500/30 transition-colors"
                      >
                        {checklistStatusIcon(item.status)}
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${
                              item.status === "complete"
                                ? "text-pm-muted line-through"
                                : "text-pm-text"
                            }`}
                          >
                            {item.title}
                          </div>
                          {item.description && (
                            <p className="text-xs text-pm-muted truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.is_required && (
                            <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] uppercase font-semibold">
                              Required
                            </span>
                          )}
                          <span className="text-[10px] text-pm-muted capitalize">
                            {item.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
