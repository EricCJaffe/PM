"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const FLAGS = [
  {
    key: "seo_enabled",
    label: "SEO",
    description: "Sitemap, meta tags, structured data, Google Search Console",
  },
  {
    key: "security_review",
    label: "Security review",
    description: "OWASP checklist, penetration testing, security audit before launch",
  },
  {
    key: "multi_tenant",
    label: "Multi-tenant",
    description: "Multiple organizations sharing one codebase with data isolation",
  },
  {
    key: "a2a_enabled",
    label: "AI / A2A agents",
    description: "Agent-to-agent communication, AI-powered features, MCP integration",
  },
  {
    key: "payments_enabled",
    label: "Payments",
    description: "Stripe integration, billing, subscriptions, invoicing",
  },
  {
    key: "hipaa_scope",
    label: "HIPAA scope",
    description: "Health data handling, BAA required, encryption at rest",
  },
];

export function Step3Flags({ form, update }: Props) {
  return (
    <div className="space-y-5">
      <h3 className="text-pm-text font-semibold text-lg">Feature flags</h3>
      <p className="text-pm-muted text-sm">
        These flags determine which checklists, reviews, and scaffolding get included.
      </p>

      <div className="space-y-3">
        {FLAGS.map((flag) => (
          <label
            key={flag.key}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              form[flag.key]
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-pm-border hover:border-pm-muted/50"
            }`}
          >
            <input
              type="checkbox"
              checked={!!form[flag.key]}
              onChange={(e) => update(flag.key, e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-pm-border bg-pm-bg text-blue-500 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-pm-text">{flag.label}</div>
              <div className="text-xs text-pm-muted mt-0.5">{flag.description}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
