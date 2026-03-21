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

  useEffect(() => {
    loadProjects();
    loadInterviews();
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
