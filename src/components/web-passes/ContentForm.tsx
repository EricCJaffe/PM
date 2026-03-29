"use client";
import { useState } from "react";
import type { WebPass, Pass1FormData, Pass2FormData, Pass2PageContent } from "@/types/pm";

const PAGE_LABELS: Record<string, string> = {
  home: "Home",
  about: "About Us",
  services: "Services",
  contact: "Contact",
  blog: "Blog",
  team: "Team",
  gallery: "Gallery",
  donate: "Donate",
  give: "Give",
  sermons: "Sermons",
  events: "Events",
};

function blankPage(page_slug: string): Pass2PageContent {
  return {
    page_slug,
    page_title: PAGE_LABELS[page_slug] ?? page_slug,
    hero_headline: "",
    hero_subtext: "",
    body_content: "",
    cta_label: "",
    cta_url: "",
    photo_preference: "stock",
    extra_notes: "",
  };
}

export function ContentForm({
  pass,
  onSaved,
}: {
  pass: WebPass;
  onSaved: (updated: WebPass) => void;
}) {
  const pass1 = (pass.form_data ?? {}) as Partial<Pass1FormData>;
  const pages: string[] = pass1.pages ?? ["home", "about", "services", "contact"];

  const existingContentData = (pass.form_data as Record<string, unknown>)?.content_pages as
    | Record<string, Pass2PageContent>
    | undefined;

  const [contentPages, setContentPages] = useState<Record<string, Pass2PageContent>>(
    () => {
      const init: Record<string, Pass2PageContent> = {};
      for (const slug of pages) {
        init[slug] = existingContentData?.[slug] ?? blankPage(slug);
      }
      return init;
    }
  );

  const [activePage, setActivePage] = useState<string>(pages[0] ?? "home");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updatePage = (slug: string, field: keyof Pass2PageContent, value: string) => {
    setContentPages((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pm/web-passes/${pass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_data: {
            ...pass.form_data,
            content_pages: contentPages,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
      onSaved(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const current = contentPages[activePage];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-pm-text">Page Content</h4>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-pm-accent hover:opacity-90 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Content"}
        </button>
      </div>

      <p className="text-sm text-pm-muted">
        Fill in content for each page. Leave fields blank to use AI-generated placeholder copy.
      </p>

      {/* Page tabs */}
      <div className="flex gap-1 flex-wrap">
        {pages.map((slug) => {
          const page = contentPages[slug];
          const hasContent = page?.hero_headline || page?.body_content;
          return (
            <button
              key={slug}
              onClick={() => setActivePage(slug)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === slug
                  ? "bg-pm-accent text-white"
                  : "border border-pm-border text-pm-muted hover:text-pm-text"
              }`}
            >
              {PAGE_LABELS[slug] ?? slug}
              {hasContent && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
            </button>
          );
        })}
      </div>

      {/* Page editor */}
      {current && (
        <div className="card space-y-4">
          <h5 className="font-medium text-pm-text">{PAGE_LABELS[activePage] ?? activePage} Page</h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Hero Headline</label>
              <input
                value={current.hero_headline}
                onChange={(e) => updatePage(activePage, "hero_headline", e.target.value)}
                placeholder="Your main heading for this page"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Hero Subtext</label>
              <input
                value={current.hero_subtext}
                onChange={(e) => updatePage(activePage, "hero_subtext", e.target.value)}
                placeholder="Supporting line below the headline"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Body Content</label>
            <textarea
              value={current.body_content}
              onChange={(e) => updatePage(activePage, "body_content", e.target.value)}
              placeholder="Main content for this page — paragraphs, lists, service descriptions, etc."
              rows={5}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">Call-to-Action Label</label>
              <input
                value={current.cta_label}
                onChange={(e) => updatePage(activePage, "cta_label", e.target.value)}
                placeholder="e.g. Get Started, Contact Us, Learn More"
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pm-muted mb-1">CTA Link (optional)</label>
              <input
                value={current.cta_url}
                onChange={(e) => updatePage(activePage, "cta_url", e.target.value)}
                placeholder="/contact or https://..."
                className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Photo Preference</label>
            <div className="flex gap-3">
              {(["stock", "none"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`photo-${activePage}`}
                    value={opt}
                    checked={current.photo_preference === opt}
                    onChange={() => updatePage(activePage, "photo_preference", opt)}
                    className="accent-pm-accent"
                  />
                  <span className="text-sm text-pm-muted capitalize">{opt === "stock" ? "Use stock photos" : "No photos"}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Extra Notes for Designer</label>
            <textarea
              value={current.extra_notes}
              onChange={(e) => updatePage(activePage, "extra_notes", e.target.value)}
              placeholder="Any specific instructions for this page..."
              rows={2}
              className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-pm-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save All Content"}
        </button>
      </div>
    </div>
  );
}
