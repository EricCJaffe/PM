export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const color =
    value === 100
      ? "bg-pm-complete"
      : value > 50
        ? "bg-pm-in-progress"
        : value > 0
          ? "bg-blue-500"
          : "bg-pm-not-started";

  return (
    <div className={`w-full bg-pm-border rounded-full h-2 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}
