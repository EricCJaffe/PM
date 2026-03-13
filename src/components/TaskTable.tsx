import type { Task } from "@/types/pm";
import { StatusBadge } from "./StatusBadge";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-pm-muted text-center py-8 mt-6">No tasks yet.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pm-border text-pm-muted text-left">
            <th className="py-2 pr-4">Task</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Owner</th>
            <th className="py-2 pr-4">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-pm-border/50 hover:bg-pm-card/50">
              <td className="py-2 pr-4">
                <div className="font-medium text-pm-text">{task.name}</div>
                {task.description && (
                  <div className="text-xs text-pm-muted truncate max-w-md">{task.description}</div>
                )}
              </td>
              <td className="py-2 pr-4">
                <StatusBadge status={task.status} />
              </td>
              <td className="py-2 pr-4 text-pm-muted">{task.owner || "—"}</td>
              <td className="py-2 pr-4 text-pm-muted">{task.due_date || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
