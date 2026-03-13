interface Stat {
  label: string;
  value: string | number;
  color?: string;
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card text-center">
          <div className={`text-2xl font-bold ${stat.color ?? "text-pm-text"}`}>
            {stat.value}
          </div>
          <div className="text-sm text-pm-muted mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
