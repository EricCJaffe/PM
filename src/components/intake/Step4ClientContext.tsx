"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const COMFORT_LEVELS = [
  { value: "none", label: "None — needs everything explained simply" },
  { value: "basic", label: "Basic — can use apps, not tech-savvy" },
  { value: "moderate", label: "Moderate — understands concepts, not code" },
  { value: "high", label: "High — developer or very technical" },
];

export function Step4ClientContext({ form, update }: Props) {
  return (
    <div className="space-y-5">
      <h3 className="text-pm-text font-semibold text-lg">Client context</h3>
      <p className="text-pm-muted text-sm">
        This is the most important step. Capture the client&apos;s perspective in their own words.
      </p>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          The problem — in their words
        </label>
        <textarea
          value={form.problem_in_their_words}
          onChange={(e) => update("problem_in_their_words", e.target.value)}
          placeholder="What did the client say when describing their problem? Use their exact language."
          rows={4}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          What &ldquo;fixed&rdquo; looks like to them
        </label>
        <textarea
          value={form.what_fixed_looks_like}
          onChange={(e) => update("what_fixed_looks_like", e.target.value)}
          placeholder="Their definition of success — what outcome are they imagining?"
          rows={3}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          Technical comfort level
        </label>
        <select
          value={form.technical_comfort}
          onChange={(e) => update("technical_comfort", e.target.value)}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        >
          {COMFORT_LEVELS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">
            Primary contact name
          </label>
          <input
            value={form.primary_contact_name}
            onChange={(e) => update("primary_contact_name", e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">
            Contact role
          </label>
          <input
            value={form.primary_contact_role}
            onChange={(e) => update("primary_contact_role", e.target.value)}
            placeholder="e.g. Executive Director"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Budget range</label>
          <input
            value={form.budget_range}
            onChange={(e) => update("budget_range", e.target.value)}
            placeholder="e.g. $5k-$10k"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-pm-muted mb-1">Hard deadline</label>
          <input
            value={form.hard_deadline}
            onChange={(e) => update("hard_deadline", e.target.value)}
            placeholder="e.g. June 1 for event launch"
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          Known constraints
        </label>
        <textarea
          value={form.known_constraints}
          onChange={(e) => update("known_constraints", e.target.value)}
          placeholder="Budget limits, timeline pressures, existing systems that must be preserved, internal politics..."
          rows={3}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
