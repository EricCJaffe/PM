"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { DocumentSection } from "@/types/pm";

// Lazy-load to avoid SSR issues with Tiptap
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] bg-pm-bg border border-pm-border rounded-lg animate-pulse" />
  ),
});

interface SectionEditorProps {
  documentId: string;
  sections: DocumentSection[];
  onUpdate: (sectionId: string, contentHtml: string) => void;
  onToggleLock: (sectionId: string, locked: boolean) => void;
}

function SectionAssist({
  documentId,
  section,
  onUpdate,
}: {
  documentId: string;
  section: DocumentSection;
  onUpdate: (html: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAssist() {
    if (!instruction.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pm/docgen/${documentId}/sections/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: section.id,
          instruction: instruction.trim(),
          content_html: section.content_html,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assist failed");
      onUpdate(data.content_html);
      setInstruction("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-pm-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-pm-muted hover:text-pm-text hover:bg-pm-bg/40 transition-colors text-left"
      >
        <span className="text-purple-400">✦</span>
        AI Assist — targeted edit
        <span className="ml-auto text-pm-muted/60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 bg-pm-bg/30">
          <p className="text-xs text-pm-muted/70">
            Describe a specific change (e.g. "update the price to $3,500/mo", "add a row for hosting", "shorten to 2 paragraphs"). Formatting is preserved.
          </p>
          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAssist()}
              placeholder="What should change in this section?"
              className="flex-1 bg-pm-bg border border-pm-border rounded px-2 py-1 text-sm text-pm-text placeholder-pm-muted/50 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAssist}
              disabled={loading || !instruction.trim()}
              className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded font-medium whitespace-nowrap"
            >
              {loading ? "Editing..." : "Apply"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function SectionEditor({ documentId, sections, onUpdate, onToggleLock }: SectionEditorProps) {
  return (
    <div className="space-y-4">
      {/* Editing tips banner */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-300/80 space-y-1">
        <p className="font-medium text-blue-300">Tips for editing sections without losing formatting</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-300/70">
          <li>Click directly inside a table cell to edit that cell — the table stays intact.</li>
          <li>Use the toolbar to add/remove rows and columns; avoid selecting across table boundaries.</li>
          <li>For price changes or small wording tweaks, use <strong className="text-blue-300">AI Assist</strong> (below each section) — it preserves all tables and structure.</li>
          <li><strong className="text-blue-300">Lock a section</strong> once it&apos;s finalized so &quot;Regenerate&quot; skips it.</li>
          <li>To reuse this document for a new deal, use <strong className="text-blue-300">Duplicate as New Document</strong> in the header, then update intake data and apply targeted AI edits.</li>
        </ul>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="bg-pm-card border border-pm-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-pm-bg/50 border-b border-pm-border">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-pm-text">{section.title}</h4>
              {section.ai_generated && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-600/20 text-purple-400 rounded">
                  AI
                </span>
              )}
            </div>
            <button
              onClick={() => onToggleLock(section.id, !section.is_locked)}
              className={`text-xs px-2 py-1 rounded ${
                section.is_locked
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
              }`}
              title={section.is_locked ? "Unlock (allow AI to overwrite)" : "Lock (prevent AI overwrite)"}
            >
              {section.is_locked ? "Locked" : "Unlocked"}
            </button>
          </div>
          <div className="p-3">
            <RichTextEditor
              value={section.content_html}
              onChange={(html) => onUpdate(section.id, html)}
              placeholder={`Enter content for ${section.title}...`}
            />
          </div>
          <SectionAssist
            documentId={documentId}
            section={section}
            onUpdate={(html) => onUpdate(section.id, html)}
          />
        </div>
      ))}
    </div>
  );
}
