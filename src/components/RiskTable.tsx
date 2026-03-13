import type { Risk } from "@/types/pm";

const levelColors = {
  low: "text-pm-complete",
  medium: "text-pm-in-progress",
  high: "text-pm-blocked",
};

export function RiskTable({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) {
    return <p className="text-pm-muted text-center py-8 mt-6">No risks logged yet.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pm-border text-pm-muted text-left">
            <th className="py-2 pr-4">Risk</th>
            <th className="py-2 pr-4">Probability</th>
            <th className="py-2 pr-4">Impact</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Owner</th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk) => (
            <tr key={risk.id} className="border-b border-pm-border/50 hover:bg-pm-card/50">
              <td className="py-2 pr-4">
                <div className="font-medium text-pm-text">{risk.title}</div>
                {risk.description && (
                  <div className="text-xs text-pm-muted truncate max-w-md">{risk.description}</div>
                )}
              </td>
              <td className={`py-2 pr-4 capitalize ${levelColors[risk.probability]}`}>
                {risk.probability}
              </td>
              <td className={`py-2 pr-4 capitalize ${levelColors[risk.impact]}`}>
                {risk.impact}
              </td>
              <td className="py-2 pr-4 text-pm-muted capitalize">{risk.status}</td>
              <td className="py-2 pr-4 text-pm-muted">{risk.owner || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
