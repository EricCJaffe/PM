"use client";

import { useState, useCallback, useRef } from "react";
import type { Organization, Department } from "@/types/pm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InterviewResponses {
  interviewee_name: string;
  department: string;
  interviewee_role: string;
  interviewer: string;
  interview_date: string;
  org_id: string;
  quote_to_cash: { flow: string; manual_steps: string; collection_tracking: string; delays_errors: string };
  people: { team_size: string; key_roles: string; skill_gaps: string; coverage_when_out: string };
  data: { what_is_tracked: string; where_it_lives: string; how_decisions_made: string; wish_had: string };
  processes: { core_workflows: string; manual_that_should_be_automated: string; falls_through_cracks: string; how_new_people_learn: string };
  communication: { meeting_cadence: string; reporting_to_leadership: string; tools_used: string; cross_dept_handoffs: string };
  issues: { biggest_frustration: string; slows_team_down: string; breaks_regularly: string; leadership_misunderstands: string };
  dreams: { magic_wand: string; ideal_day: string; done_right: string };
  must_haves: { must_have_1: string; must_have_2: string };
  tools: { daily_tools: string; love_about_current: string; hate_about_current: string; wish_had: string };
}

interface SavedFiles {
  md: { url: string; filename: string } | null;
  docx: { url: string; filename: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: "quote_to_cash", label: "Quote to Cash", icon: "💰", color: "text-emerald-400" },
  { key: "people", label: "People", icon: "👥", color: "text-blue-400" },
  { key: "data", label: "Data", icon: "📊", color: "text-violet-400" },
  { key: "processes", label: "Processes", icon: "⚙️", color: "text-amber-400" },
  { key: "communication", label: "Communication", icon: "📅", color: "text-cyan-400" },
  { key: "issues", label: "Issues", icon: "🚧", color: "text-red-400" },
  { key: "dreams", label: "Dreams", icon: "✨", color: "text-pink-400" },
  { key: "must_haves", label: "Must Haves", icon: "🎯", color: "text-orange-400" },
  { key: "tools", label: "Tools", icon: "🛠️", color: "text-teal-400" },
] as const;

const EMPTY: InterviewResponses = {
  interviewee_name: "", department: "", interviewee_role: "", interviewer: "",
  interview_date: new Date().toISOString().split("T")[0], org_id: "",
  quote_to_cash: { flow: "", manual_steps: "", collection_tracking: "", delays_errors: "" },
  people: { team_size: "", key_roles: "", skill_gaps: "", coverage_when_out: "" },
  data: { what_is_tracked: "", where_it_lives: "", how_decisions_made: "", wish_had: "" },
  processes: { core_workflows: "", manual_that_should_be_automated: "", falls_through_cracks: "", how_new_people_learn: "" },
  communication: { meeting_cadence: "", reporting_to_leadership: "", tools_used: "", cross_dept_handoffs: "" },
  issues: { biggest_frustration: "", slows_team_down: "", breaks_regularly: "", leadership_misunderstands: "" },
  dreams: { magic_wand: "", ideal_day: "", done_right: "" },
  must_haves: { must_have_1: "", must_have_2: "" },
  tools: { daily_tools: "", love_about_current: "", hate_about_current: "", wish_had: "" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ id, icon, label, color, index, children }: {
  id: string; icon: string; label: string; color: string; index: number; children: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-pm-card border border-pm-border rounded-xl p-6 mb-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-pm-border text-xs font-bold text-pm-muted">{index + 1}</div>
        <span className="text-lg">{icon}</span>
        <h2 className={`text-base font-semibold ${color}`}>{label}</h2>
        <div className="flex-1 h-px bg-pm-border" />
      </div>
      {children}
    </div>
  );
}

function QA({ q, value, onChange, rows = 3 }: {
  q: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-pm-text mb-1.5">{q}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder="Share what comes to mind..."
        className="w-full rounded-lg border border-pm-border bg-pm-bg text-pm-text placeholder-pm-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pm-accent/50 focus:border-pm-accent resize-y"
      />
    </div>
  );
}

function TI({ label, value, onChange, placeholder = "", type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-pm-muted mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-pm-border bg-pm-bg text-pm-text placeholder-pm-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pm-accent/50 focus:border-pm-accent" />
    </div>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

function UploadPanel({
  orgs, onParsed,
}: {
  orgs: Organization[];
  onParsed: (responses: Partial<InterviewResponses>, orgId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [orgId, setOrgId] = useState("");
  const [department, setDepartment] = useState("");
  const [intervieweeName, setIntervieweeName] = useState("");
  const [intervieweeRole, setIntervieweeRole] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpload = async () => {
    if (!file) { setErrorMsg("Please select a file."); return; }
    if (!orgId) { setErrorMsg("Please select a client organization."); return; }
    if (!department.trim()) { setErrorMsg("Please enter the department name."); return; }

    setStatus("uploading");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("org_id", orgId);
    fd.append("department", department);
    fd.append("interviewer", interviewer);
    fd.append("interviewee_name", intervieweeName);
    fd.append("interviewee_role", intervieweeRole);
    fd.append("interview_date", interviewDate);

    try {
      const res = await fetch("/api/pm/discovery-interviews/parse-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Merge parsed sections back into the form
      onParsed({
        ...data.parsed_sections,
        interviewee_name: intervieweeName,
        department,
        interviewee_role: intervieweeRole,
        interviewer,
        interview_date: interviewDate,
        org_id: orgId,
      }, orgId);

      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  };

  return (
    <div className="bg-pm-card border border-dashed border-pm-accent/40 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">📂</span>
        <h3 className="font-semibold text-pm-text">Upload Existing Interview Notes</h3>
        <span className="ml-auto text-xs text-pm-muted bg-pm-border px-2 py-0.5 rounded-full">Optional</span>
      </div>
      <p className="text-pm-muted text-sm mb-5">
        Upload a <code className="text-pm-accent">.txt</code>, <code className="text-pm-accent">.md</code>, or <code className="text-pm-accent">.docx</code> file.
        GPT-4o will extract and map the content to the 9 interview sections automatically.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Client Organization *</label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
            className="w-full rounded-lg border border-pm-border bg-pm-bg text-pm-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pm-accent/50">
            <option value="">— Select —</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <TI label="Department *" value={department} onChange={setDepartment} placeholder="e.g. Sales, Finance" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <TI label="Interviewee Name" value={intervieweeName} onChange={setIntervieweeName} placeholder="Full name" />
        <TI label="Title / Role" value={intervieweeRole} onChange={setIntervieweeRole} placeholder="e.g. VP of Operations" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <TI label="Interviewer" value={interviewer} onChange={setInterviewer} placeholder="Your name" />
        <TI label="Interview Date" value={interviewDate} onChange={setInterviewDate} type="date" />
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-pm-border rounded-lg py-6 cursor-pointer hover:border-pm-accent/60 hover:bg-pm-accent/5 transition-colors"
      >
        {file ? (
          <>
            <span className="text-2xl">📄</span>
            <span className="text-sm font-medium text-pm-text">{file.name}</span>
            <span className="text-xs text-pm-muted">{(file.size / 1024).toFixed(1)} KB · click to change</span>
          </>
        ) : (
          <>
            <span className="text-2xl text-pm-muted">⬆️</span>
            <span className="text-sm text-pm-muted">Click to select file</span>
            <span className="text-xs text-pm-muted">.txt · .md · .docx</span>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStatus("idle"); }}
        />
      </div>

      {errorMsg && (
        <p className="mt-3 text-sm text-red-400">{errorMsg}</p>
      )}

      {status === "done" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
          <span>✓</span>
          <span>Notes parsed — review the pre-filled form below, then save.</span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleUpload}
          disabled={status === "uploading" || !file}
          className="px-5 py-2 rounded-lg bg-pm-accent text-white text-sm font-medium hover:bg-pm-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "uploading" ? "Parsing with AI…" : "Upload & Parse Notes"}
        </button>
      </div>
    </div>
  );
}

// ─── Post-save download bar ───────────────────────────────────────────────────

function DownloadBar({ files, generating }: { files: SavedFiles | null; generating: boolean }) {
  if (generating) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-pm-card border border-pm-border text-sm text-pm-muted">
        <span className="animate-spin">⟳</span> Generating .md and .docx files…
      </div>
    );
  }
  if (!files) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
      <span className="text-emerald-400 text-sm font-medium">✓ Interview saved · Download files:</span>
      {files.md?.url && (
        <a
          href={files.md.url}
          download={files.md.filename}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-pm-card border border-pm-border text-sm text-pm-text hover:border-pm-muted transition-colors"
        >
          📝 <span>{files.md.filename}</span>
        </a>
      )}
      {files.docx?.url && (
        <a
          href={files.docx.url}
          download={files.docx.filename}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-pm-card border border-pm-border text-sm text-pm-text hover:border-pm-muted transition-colors"
        >
          📄 <span>{files.docx.filename}</span>
        </a>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function DepartmentInterviewForm({ orgs }: { orgs: Organization[] }) {
  const [form, setForm] = useState<InterviewResponses>(EMPTY);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<SavedFiles | null>(null);
  const [generatingFiles, setGeneratingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const handleOrgChange = useCallback(async (orgId: string) => {
    setForm((f) => ({ ...f, org_id: orgId }));
    if (!orgId) { setDepartments([]); return; }
    try {
      const res = await fetch(`/api/pm/departments?org_id=${orgId}`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch { setDepartments([]); }
  }, []);

  const set = <K extends keyof InterviewResponses>(key: K, value: InterviewResponses[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  type SectionKey = "quote_to_cash" | "people" | "data" | "processes" | "communication" | "issues" | "dreams" | "must_haves" | "tools";
  const setSub = (section: SectionKey, field: string, value: string) =>
    setForm((f) => ({ ...f, [section]: { ...(f[section] as Record<string, string>), [field]: value } }));

  // Merge parsed upload data into the form
  const handleParsed = useCallback((parsed: Partial<InterviewResponses>, orgId: string) => {
    setForm((f) => ({ ...f, ...parsed, org_id: orgId }));
    if (orgId) handleOrgChange(orgId);
    // Scroll to the form sections
    setTimeout(() => document.getElementById("section-quote_to_cash")?.scrollIntoView({ behavior: "smooth" }), 300);
  }, [handleOrgChange]);

  const handleSave = async () => {
    if (!form.interviewee_name.trim() || !form.department.trim()) {
      setError("Interviewee name and department are required.");
      return;
    }
    if (!form.org_id) {
      setError("Select a client organization to save.");
      return;
    }

    setSaving(true);
    setError(null);

    const action_items = [form.must_haves.must_have_1, form.must_haves.must_have_2]
      .filter(Boolean).map((item) => ({ item, assigned_to: null, due_date: null }));

    const key_findings = Object.values(form.issues)
      .filter(Boolean).map((finding) => ({ finding, category: "issues", severity: "medium" }));

    try {
      const res = await fetch("/api/pm/discovery-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: form.org_id,
          title: `${form.department} Department — Discovery Interview`,
          interviewee_name: form.interviewee_name,
          interviewee_role: form.interviewee_role || `${form.department} Department Head`,
          interview_date: form.interview_date,
          focus_areas: ["quote-to-cash", "people", "data", "processes", "communication", "issues", "tools"],
          key_findings,
          action_items,
          status: "completed",
          summary: JSON.stringify({ responses: form, captured_by: form.interviewer }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setSavedId(data.id);

      // Auto-generate files
      setGeneratingFiles(true);
      try {
        const fileRes = await fetch(`/api/pm/discovery-interviews/${data.id}/export-files`, { method: "POST" });
        const fileData = await fileRes.json();
        if (fileRes.ok) {
          setSavedFiles({
            md: fileData.md?.url ? { url: fileData.md.url, filename: fileData.md.filename } : null,
            docx: fileData.docx?.url ? { url: fileData.docx.url, filename: fileData.docx.filename } : null,
          });
        }
      } finally {
        setGeneratingFiles(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(EMPTY);
    setSavedId(null);
    setSavedFiles(null);
    setGeneratingFiles(false);
    setError(null);
    setDepartments([]);
    setShowUpload(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pm-text">Department Head Interview</h1>
          <p className="text-pm-muted text-sm mt-1">BusinessOS Discovery · Department intake questionnaire</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            showUpload
              ? "bg-pm-accent/10 border-pm-accent/40 text-pm-accent"
              : "border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-muted"
          }`}
        >
          📂 {showUpload ? "Hide Upload" : "Upload Existing Notes"}
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && <UploadPanel orgs={orgs} onParsed={handleParsed} />}

      {/* Jump nav */}
      <div className="flex flex-wrap gap-1.5 mb-6 print:hidden">
        {SECTIONS.map((s, i) => (
          <button key={s.key}
            onClick={() => document.getElementById(`section-${s.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-muted transition-colors"
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {/* Identity card */}
      <div className="bg-pm-card border border-pm-border rounded-xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-pm-accent/20 text-xs font-bold text-pm-accent">★</div>
          <h2 className="text-base font-semibold text-pm-text">Interview Details</h2>
          <div className="flex-1 h-px bg-pm-border" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <TI label="Interviewee Name *" value={form.interviewee_name} onChange={(v) => set("interviewee_name", v)} placeholder="Full name" />
          <TI label="Title / Role" value={form.interviewee_role} onChange={(v) => set("interviewee_role", v)} placeholder="e.g. VP of Operations" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Department *</label>
            <input type="text" value={form.department} onChange={(e) => set("department", e.target.value)}
              placeholder="e.g. Sales, Finance, Operations"
              list="dept-suggestions"
              className="w-full rounded-lg border border-pm-border bg-pm-bg text-pm-text placeholder-pm-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pm-accent/50 focus:border-pm-accent" />
            {departments.length > 0 && (
              <datalist id="dept-suggestions">
                {departments.map((d) => <option key={d.id} value={d.name} />)}
              </datalist>
            )}
          </div>
          <TI label="Interviewer" value={form.interviewer} onChange={(v) => set("interviewer", v)} placeholder="Your name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TI label="Interview Date" value={form.interview_date} onChange={(v) => set("interview_date", v)} type="date" />
          <div>
            <label className="block text-sm font-medium text-pm-muted mb-1">Client Organization *</label>
            <select value={form.org_id} onChange={(e) => handleOrgChange(e.target.value)}
              className="w-full rounded-lg border border-pm-border bg-pm-bg text-pm-text px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pm-accent/50">
              <option value="">— Select to save —</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 1. Quote to Cash */}
      <SectionCard id="section-quote_to_cash" index={0} icon="💰" label="Quote to Cash" color="text-emerald-400">
        <QA q="Walk me through how a lead or opportunity becomes revenue in your department." value={form.quote_to_cash.flow} onChange={(v) => setSub("quote_to_cash", "flow", v)} rows={4} />
        <QA q="What steps in billing, invoicing, or fulfillment are manual today?" value={form.quote_to_cash.manual_steps} onChange={(v) => setSub("quote_to_cash", "manual_steps", v)} />
        <QA q="How do you track collections and outstanding balances?" value={form.quote_to_cash.collection_tracking} onChange={(v) => setSub("quote_to_cash", "collection_tracking", v)} />
        <QA q="Where are the biggest delays or errors in this flow?" value={form.quote_to_cash.delays_errors} onChange={(v) => setSub("quote_to_cash", "delays_errors", v)} />
      </SectionCard>

      {/* 2. People */}
      <SectionCard id="section-people" index={1} icon="👥" label="People" color="text-blue-400">
        <QA q="How many people are in your department and what are the key roles?" value={form.people.team_size} onChange={(v) => setSub("people", "team_size", v)} />
        <QA q="Where are the skill gaps or capacity constraints?" value={form.people.skill_gaps} onChange={(v) => setSub("people", "skill_gaps", v)} />
        <QA q="What happens when someone is out — how does work get covered?" value={form.people.coverage_when_out} onChange={(v) => setSub("people", "coverage_when_out", v)} />
        <QA q="What does your ideal team structure look like in 12–18 months?" value={form.people.key_roles} onChange={(v) => setSub("people", "key_roles", v)} />
      </SectionCard>

      {/* 3. Data */}
      <SectionCard id="section-data" index={2} icon="📊" label="Data" color="text-violet-400">
        <QA q="What data does your department track and report on?" value={form.data.what_is_tracked} onChange={(v) => setSub("data", "what_is_tracked", v)} />
        <QA q="Where does that data actually live today?" value={form.data.where_it_lives} onChange={(v) => setSub("data", "where_it_lives", v)} />
        <QA q="How do you use data to make decisions?" value={form.data.how_decisions_made} onChange={(v) => setSub("data", "how_decisions_made", v)} />
        <QA q="What data do you wish you had but don&apos;t?" value={form.data.wish_had} onChange={(v) => setSub("data", "wish_had", v)} />
      </SectionCard>

      {/* 4. Processes */}
      <SectionCard id="section-processes" index={3} icon="⚙️" label="Processes" color="text-amber-400">
        <QA q="Describe your 2–3 most important core workflows from start to finish." value={form.processes.core_workflows} onChange={(v) => setSub("processes", "core_workflows", v)} rows={4} />
        <QA q="What's currently manual that you believe should be automated?" value={form.processes.manual_that_should_be_automated} onChange={(v) => setSub("processes", "manual_that_should_be_automated", v)} />
        <QA q="Where do things most often fall through the cracks?" value={form.processes.falls_through_cracks} onChange={(v) => setSub("processes", "falls_through_cracks", v)} />
        <QA q="How do new employees learn how your department works?" value={form.processes.how_new_people_learn} onChange={(v) => setSub("processes", "how_new_people_learn", v)} />
      </SectionCard>

      {/* 5. Communication */}
      <SectionCard id="section-communication" index={4} icon="📅" label="Communication Rhythms" color="text-cyan-400">
        <QA q="How often and how does your team communicate internally?" value={form.communication.meeting_cadence} onChange={(v) => setSub("communication", "meeting_cadence", v)} />
        <QA q="How do you report up to leadership — what, how often, and in what format?" value={form.communication.reporting_to_leadership} onChange={(v) => setSub("communication", "reporting_to_leadership", v)} />
        <QA q="What communication tools does your team use day-to-day?" value={form.communication.tools_used} onChange={(v) => setSub("communication", "tools_used", v)} />
        <QA q="How do cross-department handoffs work? Where do they break down?" value={form.communication.cross_dept_handoffs} onChange={(v) => setSub("communication", "cross_dept_handoffs", v)} />
      </SectionCard>

      {/* 6. Issues */}
      <SectionCard id="section-issues" index={5} icon="🚧" label="Issues & Pain Points" color="text-red-400">
        <QA q="What is your single biggest frustration with how things work today?" value={form.issues.biggest_frustration} onChange={(v) => setSub("issues", "biggest_frustration", v)} rows={4} />
        <QA q="What slows your team down the most?" value={form.issues.slows_team_down} onChange={(v) => setSub("issues", "slows_team_down", v)} />
        <QA q="What breaks or fails on a regular basis?" value={form.issues.breaks_regularly} onChange={(v) => setSub("issues", "breaks_regularly", v)} />
        <QA q="What do you wish leadership better understood about your challenges?" value={form.issues.leadership_misunderstands} onChange={(v) => setSub("issues", "leadership_misunderstands", v)} />
      </SectionCard>

      {/* 7. Dreams */}
      <SectionCard id="section-dreams" index={6} icon="✨" label="Dreams for a New System" color="text-pink-400">
        <QA q="If you could wave a magic wand and change anything about how your department operates, what would you change?" value={form.dreams.magic_wand} onChange={(v) => setSub("dreams", "magic_wand", v)} rows={4} />
        <QA q="Describe what your ideal day looks like with better systems in place." value={form.dreams.ideal_day} onChange={(v) => setSub("dreams", "ideal_day", v)} />
        <QA q='What does "done right" look like for your department in 2 years?' value={form.dreams.done_right} onChange={(v) => setSub("dreams", "done_right", v)} />
      </SectionCard>

      {/* 8. Must Haves */}
      <SectionCard id="section-must_haves" index={7} icon="🎯" label="Must Haves (Top 1–2)" color="text-orange-400">
        <p className="text-pm-muted text-sm mb-4">If we can only do 1 or 2 things in a new system, what would they have to be for this to be worth it?</p>
        <QA q="Must Have #1" value={form.must_haves.must_have_1} onChange={(v) => setSub("must_haves", "must_have_1", v)} rows={2} />
        <QA q="Must Have #2" value={form.must_haves.must_have_2} onChange={(v) => setSub("must_haves", "must_have_2", v)} rows={2} />
      </SectionCard>

      {/* 9. Tools */}
      <SectionCard id="section-tools" index={8} icon="🛠️" label="Tools & Technology" color="text-teal-400">
        <QA q="What tools and technology do you use to do your job every day?" value={form.tools.daily_tools} onChange={(v) => setSub("tools", "daily_tools", v)} rows={4} />
        <QA q="What do you love about your current tools?" value={form.tools.love_about_current} onChange={(v) => setSub("tools", "love_about_current", v)} />
        <QA q="What do you hate or find frustrating about your current tools?" value={form.tools.hate_about_current} onChange={(v) => setSub("tools", "hate_about_current", v)} />
        <QA q="Are there tools you&apos;ve heard of or wish you had?" value={form.tools.wish_had} onChange={(v) => setSub("tools", "wish_had", v)} />
      </SectionCard>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Download bar (shown after save) */}
      {(generatingFiles || savedFiles) && (
        <div className="mb-4">
          <DownloadBar files={savedFiles} generating={generatingFiles} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pb-12 print:hidden">
        <button type="button" onClick={() => window.print()}
          className="px-4 py-2 rounded-lg border border-pm-border text-pm-muted text-sm hover:text-pm-text hover:border-pm-muted transition-colors">
          🖨️ Print
        </button>
        <div className="flex gap-3">
          {savedId && (
            <button type="button" onClick={handleReset}
              className="px-4 py-2 rounded-lg border border-pm-border text-pm-muted text-sm hover:text-pm-text hover:border-pm-muted transition-colors">
              New Interview
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-6 py-2 rounded-lg bg-pm-accent text-white text-sm font-medium hover:bg-pm-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? "Saving…" : savedId ? "Saved ✓" : "Save Interview"}
          </button>
        </div>
      </div>
    </div>
  );
}
