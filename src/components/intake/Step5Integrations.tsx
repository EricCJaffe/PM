"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const INTEGRATION_OPTIONS = [
  { id: "stripe", label: "Stripe", description: "Payments & billing" },
  { id: "docuseal", label: "DocuSeal", description: "Document signing" },
  { id: "resend", label: "Resend", description: "Transactional email" },
  { id: "github", label: "GitHub", description: "Code & version control" },
  { id: "google-analytics", label: "Google Analytics", description: "Web analytics" },
  { id: "calendly", label: "Calendly", description: "Scheduling" },
  { id: "twilio", label: "Twilio", description: "SMS & voice" },
  { id: "custom", label: "Custom / Other", description: "Specify in notes" },
];

export function Step5Integrations({ form, update }: Props) {
  const integrations: string[] = form.integrations ?? [];

  const toggle = (id: string) => {
    const next = integrations.includes(id)
      ? integrations.filter((i: string) => i !== id)
      : [...integrations, id];
    update("integrations", next);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-pm-text font-semibold text-lg">Integrations</h3>
      <p className="text-pm-muted text-sm">
        Select any third-party services this project will use.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {INTEGRATION_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              integrations.includes(opt.id)
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-pm-border hover:border-pm-muted/50"
            }`}
          >
            <input
              type="checkbox"
              checked={integrations.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              className="w-4 h-4 rounded border-pm-border bg-pm-bg text-blue-500 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-pm-text">{opt.label}</div>
              <div className="text-xs text-pm-muted">{opt.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          Integration notes
        </label>
        <textarea
          value={form.integration_notes}
          onChange={(e) => update("integration_notes", e.target.value)}
          placeholder="Any specific requirements, API keys needed, or custom integrations to note?"
          rows={3}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
