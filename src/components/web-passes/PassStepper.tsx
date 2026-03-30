"use client";
import type { WebPass, WebPassStatus } from "@/types/pm";

const PASS_LABELS: Record<string, string> = {
  discovery: "Discovery",
  foundation: "Foundation & Look",
  content: "Content",
  polish: "Polish & QA",
  "go-live": "Go-Live",
};

const STATUS_COLOR: Record<WebPassStatus, string> = {
  locked: "bg-pm-border text-pm-muted border-pm-border",
  active: "bg-blue-600/20 text-blue-400 border-blue-500/50",
  "in-review": "bg-amber-500/20 text-amber-400 border-amber-500/50",
  approved: "bg-emerald-600/20 text-emerald-400 border-emerald-500/50",
  rejected: "bg-red-600/20 text-red-400 border-red-500/50",
};

const STATUS_DOT: Record<WebPassStatus, string> = {
  locked: "bg-pm-muted",
  active: "bg-blue-400",
  "in-review": "bg-amber-400 animate-pulse",
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
};

export function PassStepper({
  passes,
  activePassId,
  onSelectPass,
  onUnlockPass,
}: {
  passes: WebPass[];
  activePassId: string | null;
  onSelectPass: (pass: WebPass) => void;
  onUnlockPass?: (pass: WebPass) => void;
}) {
  const sorted = [...passes].sort((a, b) => a.pass_number - b.pass_number);

  return (
    <div className="flex items-stretch gap-0 mb-8 overflow-x-auto">
      {sorted.map((pass, i) => {
        const isActive = pass.id === activePassId;
        // All non-locked passes are clickable (including approved — admin can go back)
        const isClickable = pass.status !== "locked";

        return (
          <div key={pass.id} className="flex items-center flex-shrink-0">
            {i > 0 && (
              <div className={`h-px w-6 shrink-0 ${
                sorted[i - 1].status === "approved" ? "bg-emerald-500/50" : "bg-pm-border"
              }`} />
            )}

            <div className="relative">
              <button
                onClick={() => isClickable && onSelectPass(pass)}
                disabled={!isClickable}
                className={`
                  flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border transition-all text-left
                  ${STATUS_COLOR[pass.status]}
                  ${isActive ? "ring-2 ring-pm-accent ring-offset-1 ring-offset-pm-bg" : ""}
                  ${isClickable ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-60"}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[pass.status]}`} />
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {PASS_LABELS[pass.pass_type] ?? pass.pass_type}
                  </span>
                </div>
                <span className="text-xs capitalize opacity-75">{pass.status.replace("-", " ")}</span>
              </button>
              {/* Unlock button for approved passes */}
              {pass.status === "approved" && onUnlockPass && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUnlockPass(pass); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center hover:bg-amber-600 transition-colors"
                  title="Unlock to edit"
                >
                  &#9998;
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
