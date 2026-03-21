"use client";

import { useState, useRef } from "react";

interface NLPCommandBarProps {
  projectId?: string | null;
  orgId?: string | null;
  onUpdate?: () => void;
}

export function NLPCommandBar({ projectId, orgId, onUpdate }: NLPCommandBarProps) {
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ response: string; actions: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || processing) return;

    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/pm/nlp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          project_id: projectId || undefined,
          org_id: orgId || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult({ response: data.response, actions: data.actions || [] });
      setMessage("");
      onUpdate?.();
    } catch (err) {
      setResult({
        response: err instanceof Error ? err.message : "Failed to process",
        actions: [],
      });
    } finally {
      setProcessing(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Try: "Set Design Review due date to April 15" or "Mark onboarding complete"'
            className="w-full bg-pm-bg border border-pm-border rounded-lg pl-9 pr-3 py-2 text-sm text-pm-text placeholder:text-pm-muted/60 focus:outline-none focus:border-blue-500"
            disabled={processing}
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-pm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <button
          type="submit"
          disabled={processing || !message.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          {processing ? "..." : "Go"}
        </button>
      </form>

      {result && (
        <div className="p-3 bg-pm-surface border border-pm-border rounded-lg">
          <p className="text-sm text-pm-text">{result.response}</p>
          {result.actions.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.actions.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-pm-muted">
                  <span className="text-emerald-400 mt-0.5">&#x2713;</span>
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
