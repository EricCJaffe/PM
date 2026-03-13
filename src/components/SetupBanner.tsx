export function SetupBanner({
  missing,
  migrations,
}: {
  missing: string[];
  migrations: string[];
}) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-6">
        <h2 className="text-lg font-semibold text-yellow-400 mb-2">
          Database Setup Required
        </h2>
        <p className="text-pm-text mb-3">
          The following tables are missing and need to be created:
        </p>
        <ul className="list-disc list-inside text-sm text-pm-muted mb-4 space-y-1">
          {missing.map((t) => (
            <li key={t} className="font-mono">{t}</li>
          ))}
        </ul>
        <p className="text-pm-text text-sm">
          Run the following migration(s) in your{" "}
          <span className="font-semibold">Supabase SQL Editor</span>:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {migrations.map((m) => (
            <code
              key={m}
              className="px-2 py-1 bg-pm-bg rounded text-sm text-blue-400 font-mono"
            >
              {m}
            </code>
          ))}
        </div>
        <p className="text-xs text-pm-muted mt-4">
          Find migration files in <code className="font-mono">supabase/migrations/</code> in the project root.
        </p>
      </div>
    </div>
  );
}
