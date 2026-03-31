"use client";

interface DimensionComparison {
  label: string;
  before_score: number;
  after_score: number;
  delta: number;
}

interface OverallScore {
  grade: string;
  score: number;
}

interface BeforeAfterData {
  before_url: string;
  after_url: string;
  before_overall: OverallScore | null;
  after_overall: OverallScore | null;
  dimensions: Record<string, DimensionComparison>;
  generated_at: string;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-pm-muted">→ no change</span>;
  return (
    <span className={`text-xs font-semibold ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} pts
    </span>
  );
}

function GradeChip({ grade, score }: { grade: string; score: number }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-600/20 text-emerald-400",
    B: "bg-blue-600/20 text-blue-400",
    C: "bg-amber-600/20 text-amber-400",
    D: "bg-orange-600/20 text-orange-400",
    "D-": "bg-orange-600/20 text-orange-400",
    F: "bg-red-600/20 text-red-400",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors[grade] ?? colors.F}`}>
      <span className="text-xl font-bold">{grade}</span>
      <span className="text-sm opacity-75">{score}%</span>
    </div>
  );
}

export function BeforeAfterReport({ data }: { data: BeforeAfterData }) {
  const totalDelta = Object.values(data.dimensions).reduce((sum, d) => sum + d.delta, 0);
  const improved = Object.values(data.dimensions).filter((d) => d.delta > 0).length;

  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-pm-text">Before / After Report</h4>
          <p className="text-xs text-pm-muted mt-0.5">
            Generated {new Date(data.generated_at).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
          totalDelta > 0 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
        }`}>
          {totalDelta > 0 ? `+${totalDelta}` : totalDelta} total pts
        </div>
      </div>

      {/* Overall comparison */}
      {(data.before_overall || data.after_overall) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-pm-muted font-medium uppercase tracking-wider">Before</p>
            <p className="text-xs text-pm-muted truncate">{data.before_url}</p>
            {data.before_overall && (
              <GradeChip grade={data.before_overall.grade} score={data.before_overall.score} />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-pm-muted font-medium uppercase tracking-wider">After</p>
            <p className="text-xs text-pm-muted truncate">{data.after_url}</p>
            {data.after_overall && (
              <GradeChip grade={data.after_overall.grade} score={data.after_overall.score} />
            )}
          </div>
        </div>
      )}

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <span className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 text-xs rounded-full font-medium">
          {improved} of {Object.keys(data.dimensions).length} dimensions improved
        </span>
        {data.before_overall && data.after_overall && (
          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
            data.after_overall.score > data.before_overall.score
              ? "bg-emerald-600/20 text-emerald-400"
              : "bg-red-600/20 text-red-400"
          }`}>
            Overall: {data.before_overall.grade} → {data.after_overall.grade}
          </span>
        )}
      </div>

      {/* Per-dimension breakdown */}
      <div className="space-y-3">
        {Object.entries(data.dimensions).map(([key, dim]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-pm-text">{dim.label}</span>
              <DeltaBadge delta={dim.delta} />
            </div>
            <div className="flex items-center gap-2">
              {/* Before bar */}
              <div className="flex-1 h-2 bg-pm-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-pm-muted/60"
                  style={{ width: `${dim.before_score}%` }}
                />
              </div>
              <span className="text-xs text-pm-muted w-7 text-right tabular-nums">{dim.before_score}</span>
              <span className="text-xs text-pm-muted">→</span>
              {/* After bar */}
              <div className="flex-1 h-2 bg-pm-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${dim.delta >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${dim.after_score}%` }}
                />
              </div>
              <span className={`text-xs font-semibold w-7 text-right tabular-nums ${
                dim.delta > 0 ? "text-emerald-400" : dim.delta < 0 ? "text-red-400" : "text-pm-muted"
              }`}>{dim.after_score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
