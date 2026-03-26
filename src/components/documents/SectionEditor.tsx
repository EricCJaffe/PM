"use client";

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
  sections: DocumentSection[];
  onUpdate: (sectionId: string, contentHtml: string) => void;
  onToggleLock: (sectionId: string, locked: boolean) => void;
}

export function SectionEditor({ sections, onUpdate, onToggleLock }: SectionEditorProps) {
  return (
    <div className="space-y-4">
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
        </div>
      ))}
    </div>
  );
}
