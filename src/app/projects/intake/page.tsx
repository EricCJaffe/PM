"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Step1Basics,
  Step2Toolstack,
  Step3Flags,
  Step4ClientContext,
  Step5Integrations,
  Step6Review,
} from "@/components/intake";

const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Toolstack" },
  { id: 3, label: "Flags" },
  { id: 4, label: "Client" },
  { id: 5, label: "Integrations" },
  { id: 6, label: "Review" },
];

function IntakeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const engagementId = searchParams.get("engagement_id");
  const prefillOrgId = searchParams.get("org_id");

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Step 1
    name: "",
    slug: "",
    org_id: prefillOrgId ?? "",
    template_slug: "custom",
    owner: "",
    description: "",
    target_date: "",
    budget: "",
    project_type: "client_web_app",
    is_greenfield: true,
    v1_done: "",

    // Step 2
    github_repo: "",
    vercel_project: "",
    supabase_ref: "",
    framework: "nextjs",
    stack_deviations: "",

    // Step 3
    seo_enabled: false,
    security_review: false,
    multi_tenant: false,
    a2a_enabled: false,
    payments_enabled: false,
    hipaa_scope: false,

    // Step 4
    problem_in_their_words: "",
    what_fixed_looks_like: "",
    technical_comfort: "basic",
    primary_contact_name: "",
    primary_contact_role: "",
    budget_range: "",
    hard_deadline: "",
    known_constraints: "",

    // Step 5
    integrations: [] as string[],
    integration_notes: "",
  });

  const update = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canProceed = () => {
    if (step === 1) return form.name && form.org_id && form.owner && form.v1_done;
    if (step === 4)
      return form.problem_in_their_words && form.primary_contact_name;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pm/projects/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug:
            form.slug ||
            form.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
          org_id: form.org_id,
          template_slug: form.template_slug,
          owner: form.owner,
          description: form.description || null,
          target_date: form.target_date || null,
          budget: form.budget ? parseFloat(form.budget) : null,
          engagement_id: engagementId ?? null,
          intake_data: {
            project_type: form.project_type,
            is_greenfield: form.is_greenfield,
            v1_done: form.v1_done,
            github_repo: form.github_repo || null,
            vercel_project: form.vercel_project || null,
            supabase_ref: form.supabase_ref || null,
            framework: form.framework,
            stack_deviations: form.stack_deviations || null,
            seo_enabled: form.seo_enabled,
            security_review: form.security_review,
            multi_tenant: form.multi_tenant,
            a2a_enabled: form.a2a_enabled,
            payments_enabled: form.payments_enabled,
            hipaa_scope: form.hipaa_scope,
            integrations: form.integrations,
            integration_notes: form.integration_notes || null,
          },
          client_context: {
            problem_in_their_words: form.problem_in_their_words,
            what_fixed_looks_like: form.what_fixed_looks_like,
            technical_comfort: form.technical_comfort,
            primary_contact_name: form.primary_contact_name,
            primary_contact_role: form.primary_contact_role,
            budget_range: form.budget_range || null,
            hard_deadline: form.hard_deadline || null,
            known_constraints: form.known_constraints || null,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreatedSlug(data.project?.slug ?? null);
        setDownloadUrl(data.download_url ?? null);
        setStep(7); // success
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success state ─────────────────────────────────────────────
  if (step === 7) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <span className="text-green-400 text-2xl">&#10003;</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-pm-text mb-2">
              Project created
            </h1>
            <p className="text-pm-muted">
              {form.name} is ready. Download your project files and drop them
              into your GitHub repo.
            </p>
          </div>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Download project files (.zip)
            </a>
          )}
          <div className="text-pm-muted text-sm space-y-1">
            <p>The zip contains:</p>
            <p className="text-pm-text/70">
              PROJECT_INIT.md &middot; CLIENT_CONTEXT.md &middot;
              AUTOMATION_MAP.md &middot; PROMPT_LIBRARY.md
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            {createdSlug && (
              <button
                onClick={() => router.push(`/projects/${createdSlug}`)}
                className="border border-pm-border text-pm-text hover:text-white px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Open project
              </button>
            )}
            {engagementId && (
              <button
                onClick={() => router.back()}
                className="border border-pm-border text-pm-muted hover:text-pm-text px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Back to engagement
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className="text-sm text-pm-muted hover:text-pm-text mb-4 inline-block"
          >
            &larr; Projects
          </Link>
          <h1 className="text-2xl font-bold text-pm-text">
            New project intake
          </h1>
          <p className="text-pm-muted mt-1">
            {engagementId
              ? "Converting engagement to project"
              : "Full project kickoff"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (s.id < step) setStep(s.id);
                }}
                className={`flex items-center gap-2 ${
                  step === s.id
                    ? "text-orange-400"
                    : step > s.id
                      ? "text-green-400 cursor-pointer"
                      : "text-pm-muted/40"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                    step === s.id
                      ? "border-orange-400 bg-orange-900/30"
                      : step > s.id
                        ? "border-green-400 bg-green-900/30"
                        : "border-pm-border"
                  }`}
                >
                  {step > s.id ? "\u2713" : s.id}
                </div>
                <span className="text-xs hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-px ${
                    step > s.id ? "bg-green-700" : "bg-pm-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-pm-card rounded-xl border border-pm-border p-6">
          {step === 1 && <Step1Basics form={form} update={update} />}
          {step === 2 && <Step2Toolstack form={form} update={update} />}
          {step === 3 && <Step3Flags form={form} update={update} />}
          {step === 4 && <Step4ClientContext form={form} update={update} />}
          {step === 5 && <Step5Integrations form={form} update={update} />}
          {step === 6 && <Step6Review form={form} />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-pm-muted hover:text-pm-text text-sm px-4 py-2 disabled:opacity-30"
          >
            &larr; Back
          </button>
          {step < 6 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Continue &rarr;
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? "Creating project..." : "Create project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectIntakePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-pm-muted">Loading...</p>
        </div>
      }
    >
      <IntakeForm />
    </Suspense>
  );
}
