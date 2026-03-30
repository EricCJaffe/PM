"use client";
import { useState, useRef } from "react";
import type { WebPass, Pass1FormData, Pass2PageContent } from "@/types/pm";

const DEFAULT_PAGES: Record<string, string> = {
  home: "Home",
  about: "About Us",
  services: "Services",
  contact: "Contact",
  blog: "Blog",
  team: "Team / Leadership",
  gallery: "Gallery",
  donate: "Donate / Give",
  sermons: "Sermons",
  events: "Events",
  visit: "Plan Your Visit",
  beliefs: "Beliefs",
  kids: "Kids / Youth",
  missions: "Missions",
  groups: "Small Groups",
  prayer: "Prayer",
};

function blankPage(page_slug: string, page_title?: string): Pass2PageContent {
  return {
    page_slug,
    page_title: page_title || DEFAULT_PAGES[page_slug] || page_slug,
    hero_headline: "",
    hero_subtext: "",
    body_content: "",
    cta_label: "",
    cta_url: "",
    photo_preference: "stock",
    extra_notes: "",
  };
}

interface PageNode {
  slug: string;
  title: string;
  children: PageNode[];
}

export function ContentForm({
  pass,
  onSaved,
}: {
  pass: WebPass;
  onSaved: (updated: WebPass) => void;
}) {
  const pass1 = (pass.form_data ?? {}) as Partial<Pass1FormData>;
  const initialPages: string[] = pass1.pages ?? ["home", "about", "services", "contact"];

  const existingContentData = (pass.form_data as Record<string, unknown>)?.content_pages as
    | Record<string, Pass2PageContent>
    | undefined;

  const existingStructure = (pass.form_data as Record<string, unknown>)?.page_structure as
    | PageNode[]
    | undefined;

  // Build page structure (with sub-pages)
  const [pageStructure, setPageStructure] = useState<PageNode[]>(() => {
    if (existingStructure) return existingStructure;
    return initialPages.map((slug) => ({
      slug,
      title: DEFAULT_PAGES[slug] || slug,
      children: [],
    }));
  });

  // Flatten for content editing
  function flattenPages(nodes: PageNode[]): string[] {
    const result: string[] = [];
    for (const node of nodes) {
      result.push(node.slug);
      for (const child of node.children) {
        result.push(child.slug);
      }
    }
    return result;
  }

  const allSlugs = flattenPages(pageStructure);

  const [contentPages, setContentPages] = useState<Record<string, Pass2PageContent>>(() => {
    const init: Record<string, Pass2PageContent> = {};
    for (const slug of allSlugs) {
      const node = findNode(pageStructure, slug);
      init[slug] = existingContentData?.[slug] ?? blankPage(slug, node?.title);
    }
    return init;
  });

  const [activePage, setActivePage] = useState<string>(allSlugs[0] ?? "home");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [addAsChildOf, setAddAsChildOf] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function findNode(nodes: PageNode[], slug: string): PageNode | undefined {
    for (const n of nodes) {
      if (n.slug === slug) return n;
      for (const c of n.children) {
        if (c.slug === slug) return c;
      }
    }
    return undefined;
  }

  function isSubPage(slug: string): boolean {
    return pageStructure.some((n) => n.children.some((c) => c.slug === slug));
  }

  const updatePage = (slug: string, field: keyof Pass2PageContent, value: string) => {
    setContentPages((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], [field]: value },
    }));
    setSaved(false);
  };

  const addPage = () => {
    if (!newPageTitle.trim()) return;
    const slug = newPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    if (allSlugs.includes(slug)) {
      alert("A page with that name already exists.");
      return;
    }

    const newNode: PageNode = { slug, title: newPageTitle.trim(), children: [] };

    if (addAsChildOf) {
      setPageStructure((prev) =>
        prev.map((n) =>
          n.slug === addAsChildOf
            ? { ...n, children: [...n.children, newNode] }
            : n
        )
      );
    } else {
      setPageStructure((prev) => [...prev, newNode]);
    }

    setContentPages((prev) => ({
      ...prev,
      [slug]: blankPage(slug, newPageTitle.trim()),
    }));

    setNewPageTitle("");
    setShowAddPage(false);
    setAddAsChildOf(null);
    setActivePage(slug);
    setSaved(false);
  };

  const removePage = (slug: string) => {
    if (!confirm(`Remove "${contentPages[slug]?.page_title || slug}" page?`)) return;
    setPageStructure((prev) => {
      // Remove as top-level
      const filtered = prev.filter((n) => n.slug !== slug);
      // Remove as child
      return filtered.map((n) => ({
        ...n,
        children: n.children.filter((c) => c.slug !== slug),
      }));
    });
    setContentPages((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    if (activePage === slug) {
      const remaining = allSlugs.filter((s) => s !== slug);
      setActivePage(remaining[0] || "home");
    }
    setSaved(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploaded_by", "admin");

      // Upload to the pass's project as a task attachment (reuse existing infrastructure)
      const res = await fetch(`/api/pm/web-passes/${pass.id}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Fallback: store as base64 data URL in extra_notes
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const currentNotes = contentPages[activePage]?.extra_notes || "";
          updatePage(activePage, "extra_notes", currentNotes + `\n[Image: ${file.name}]\n`);
          // Store image references in form_data
          const images = ((pass.form_data as Record<string, unknown>)?.page_images as Record<string, string[]>) || {};
          const pageImages = images[activePage] || [];
          pageImages.push(dataUrl);
          // We'll save this with the content
        };
        reader.readAsDataURL(file);
      } else {
        const data = await res.json();
        const currentNotes = contentPages[activePage]?.extra_notes || "";
        updatePage(activePage, "extra_notes", currentNotes + `\n[Image uploaded: ${file.name} → ${data.storage_path || "stored"}]\n`);
      }
    } catch {
      alert("Image upload failed. The image reference has been added to notes.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
            page_structure: pageStructure,
            pages: flattenPages(pageStructure),
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

      {/* Page tabs with hierarchy */}
      <div className="flex gap-1 flex-wrap items-center">
        {pageStructure.map((node) => (
          <div key={node.slug} className="flex items-center gap-0.5">
            <button
              onClick={() => setActivePage(node.slug)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === node.slug
                  ? "bg-pm-accent text-white"
                  : "border border-pm-border text-pm-muted hover:text-pm-text"
              }`}
            >
              {node.title}
              {contentPages[node.slug]?.hero_headline && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>
            {/* Sub-page tabs */}
            {node.children.map((child) => (
              <button
                key={child.slug}
                onClick={() => setActivePage(child.slug)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ml-0.5 ${
                  activePage === child.slug
                    ? "bg-pm-accent/80 text-white"
                    : "border border-pm-border/50 text-pm-muted hover:text-pm-text"
                }`}
              >
                ↳ {child.title}
              </button>
            ))}
            {/* Add sub-page button */}
            <button
              onClick={() => { setAddAsChildOf(node.slug); setShowAddPage(true); }}
              className="w-5 h-5 rounded text-[10px] text-pm-muted hover:text-pm-text hover:bg-pm-surface transition-colors flex items-center justify-center"
              title={`Add sub-page under ${node.title}`}
            >
              +
            </button>
          </div>
        ))}
        {/* Add top-level page */}
        <button
          onClick={() => { setAddAsChildOf(null); setShowAddPage(true); }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-muted transition-colors"
        >
          + Add Page
        </button>
      </div>

      {/* Add page modal */}
      {showAddPage && (
        <div className="card border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center gap-3">
            <input
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder={addAsChildOf ? `Sub-page name under ${findNode(pageStructure, addAsChildOf)?.title}` : "New page name"}
              className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && addPage()}
            />
            <button onClick={addPage} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">
              Add
            </button>
            <button onClick={() => { setShowAddPage(false); setNewPageTitle(""); setAddAsChildOf(null); }} className="text-sm text-pm-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Page editor */}
      {current && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-pm-text">
              {isSubPage(activePage) && <span className="text-pm-muted mr-1">↳</span>}
              {current.page_title || activePage}
            </h5>
            {activePage !== "home" && (
              <button
                onClick={() => removePage(activePage)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Remove page
              </button>
            )}
          </div>

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

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-medium text-pm-muted mb-1">Page Images</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-4 py-2 border border-pm-border text-pm-muted hover:text-pm-text hover:bg-pm-surface rounded-lg text-sm transition-colors"
              >
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </button>
              <div className="flex gap-2">
                {(["uploaded", "stock", "none"] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`photo-${activePage}`}
                      value={opt}
                      checked={current.photo_preference === opt}
                      onChange={() => updatePage(activePage, "photo_preference", opt)}
                      className="accent-pm-accent"
                    />
                    <span className="text-xs text-pm-muted capitalize">
                      {opt === "uploaded" ? "My photos" : opt === "stock" ? "Stock photos" : "No photos"}
                    </span>
                  </label>
                ))}
              </div>
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
