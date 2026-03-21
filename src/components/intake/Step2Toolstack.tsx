"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const FRAMEWORKS = [
  { value: "nextjs", label: "Next.js (default)" },
  { value: "remix", label: "Remix" },
  { value: "other", label: "Other" },
];

export function Step2Toolstack({ form, update }: Props) {
  return (
    <div className="space-y-5">
      <h3 className="text-pm-text font-semibold text-lg">Toolstack</h3>
      <p className="text-pm-muted text-sm">
        Fill in what you know now. These can be updated later.
      </p>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">GitHub repo</label>
        <input
          value={form.github_repo}
          onChange={(e) => update("github_repo", e.target.value)}
          placeholder="e.g. EricCJaffe/project-name"
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Vercel project</label>
        <input
          value={form.vercel_project}
          onChange={(e) => update("vercel_project", e.target.value)}
          placeholder="e.g. project-name"
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Supabase project ref</label>
        <input
          value={form.supabase_ref}
          onChange={(e) => update("supabase_ref", e.target.value)}
          placeholder="e.g. abcdefghijklmnop"
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">Framework</label>
        <select
          value={form.framework}
          onChange={(e) => update("framework", e.target.value)}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        >
          {FRAMEWORKS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-pm-muted mb-1">
          Stack deviations from default
        </label>
        <textarea
          value={form.stack_deviations}
          onChange={(e) => update("stack_deviations", e.target.value)}
          placeholder="Any notable differences from the standard Next.js + Supabase + Tailwind stack?"
          rows={2}
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
}
