"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const FLAG_LABELS: Record<string, string> = {
  seo_enabled: "SEO",
  security_review: "Security Review",
  multi_tenant: "Multi-Tenant",
  a2a_enabled: "AI / A2A",
  payments_enabled: "Payments",
  hipaa_scope: "HIPAA",
};

export function Step6Review({ form }: Props) {
  const enabledFlags = Object.entries(FLAG_LABELS).filter(([key]) => form[key]);
  const disabledFlags = Object.entries(FLAG_LABELS).filter(([key]) => !form[key]);
  const integrations: string[] = form.integrations ?? [];

  return (
    <div className="space-y-6">
      <h3 className="text-pm-text font-semibold text-lg">Review & create</h3>
      <p className="text-pm-muted text-sm">
        Everything look right? You can go back to any step to make changes.
      </p>

      {/* Project basics */}
      <Section title="Project basics">
        <Row label="Name" value={form.name} />
        <Row label="Type" value={form.project_type} />
        <Row label="Template" value={form.template_slug} />
        <Row label="Owner" value={form.owner || "—"} />
        <Row label="Greenfield" value={form.is_greenfield ? "Yes" : "No"} />
        <Row label="V1 done" value={form.v1_done || "—"} />
        <Row label="Target date" value={form.target_date || "—"} />
        <Row label="Budget" value={form.budget ? `$${form.budget}` : "—"} />
      </Section>

      {/* Toolstack */}
      <Section title="Toolstack">
        <Row label="GitHub" value={form.github_repo || "Not set"} />
        <Row label="Vercel" value={form.vercel_project || "Not set"} />
        <Row label="Supabase" value={form.supabase_ref || "Not set"} />
        <Row label="Framework" value={form.framework} />
        {form.stack_deviations && (
          <Row label="Deviations" value={form.stack_deviations} />
        )}
      </Section>

      {/* Feature flags */}
      <Section title="Feature flags">
        <div className="flex flex-wrap gap-2">
          {enabledFlags.map(([, label]) => (
            <span
              key={label}
              className="text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800/50"
            >
              {label}
            </span>
          ))}
          {disabledFlags.map(([, label]) => (
            <span
              key={label}
              className="text-xs px-2 py-1 rounded-full bg-pm-bg text-pm-muted border border-pm-border"
            >
              {label}
            </span>
          ))}
        </div>
      </Section>

      {/* Client context */}
      <Section title="Client context">
        <Row label="Contact" value={`${form.primary_contact_name || "—"} — ${form.primary_contact_role || "—"}`} />
        <Row label="Comfort" value={form.technical_comfort} />
        {form.problem_in_their_words && (
          <div className="mt-2">
            <div className="text-xs text-pm-muted mb-1">Problem (their words):</div>
            <div className="text-sm text-pm-text/80 bg-pm-bg rounded-lg p-3 border border-pm-border">
              {form.problem_in_their_words}
            </div>
          </div>
        )}
        {form.what_fixed_looks_like && (
          <div className="mt-2">
            <div className="text-xs text-pm-muted mb-1">Success looks like:</div>
            <div className="text-sm text-pm-text/80 bg-pm-bg rounded-lg p-3 border border-pm-border">
              {form.what_fixed_looks_like}
            </div>
          </div>
        )}
        <Row label="Budget range" value={form.budget_range || "—"} />
        <Row label="Hard deadline" value={form.hard_deadline || "—"} />
        {form.known_constraints && (
          <Row label="Constraints" value={form.known_constraints} />
        )}
      </Section>

      {/* Integrations */}
      {integrations.length > 0 && (
        <Section title="Integrations">
          <div className="flex flex-wrap gap-2">
            {integrations.map((i: string) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50"
              >
                {i}
              </span>
            ))}
          </div>
          {form.integration_notes && (
            <div className="text-sm text-pm-muted mt-2">{form.integration_notes}</div>
          )}
        </Section>
      )}

      <div className="bg-green-900/10 border border-green-800/30 rounded-lg p-4">
        <p className="text-green-400 text-sm font-medium">
          Ready to create this project
        </p>
        <p className="text-pm-muted text-xs mt-1">
          This will create the project, phases from the template, vault files,
          and a downloadable zip with PROJECT_INIT.md, CLIENT_CONTEXT.md,
          AUTOMATION_MAP.md, and PROMPT_LIBRARY.md.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-pm-muted text-xs font-medium uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="bg-pm-bg rounded-lg border border-pm-border p-3 space-y-1">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-pm-muted w-24 shrink-0">{label}</span>
      <span className="text-sm text-pm-text">{value}</span>
    </div>
  );
}
