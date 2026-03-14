"use client";
import { useEffect, useRef } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className="bg-pm-card border border-pm-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-pm-border">
          <h2 className="text-lg font-semibold text-pm-text">{title}</h2>
          <button onClick={onClose} className="text-pm-muted hover:text-pm-text text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label, children, hint,
}: {
  label: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-pm-muted mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-pm-muted mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500";
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input className={inputCls} {...props} />;
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select className={inputCls} {...props} />;
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={`${inputCls} resize-none`} rows={3} {...props} />;

export function ModalActions({ onClose, saving, label = "Save" }: { onClose: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex gap-3 justify-end pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-pm-muted hover:text-pm-text border border-pm-border rounded-lg">Cancel</button>
      <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}
