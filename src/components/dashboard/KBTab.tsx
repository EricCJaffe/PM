"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Organization, KBArticle, KBCategory } from "@/types/pm";
import { Modal, Field, Input, Select, ModalActions } from "../Modal";

const CATEGORIES: { value: KBCategory; label: string; icon: string }[] = [
  { value: "company-profile", label: "Company Profile", icon: "🏢" },
  { value: "client-profile", label: "Client Profile", icon: "👤" },
  { value: "strategy", label: "Strategy & Decisions", icon: "🎯" },
  { value: "playbook", label: "Playbook & Process", icon: "📘" },
  { value: "lessons-learned", label: "Lessons Learned", icon: "💡" },
  { value: "industry", label: "Industry Knowledge", icon: "🏭" },
  { value: "relationship", label: "Relationship Context", icon: "🤝" },
  { value: "general", label: "General", icon: "📝" },
];

const categoryMap = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Article Editor Modal ────────────────────────────────────────────

function ArticleModal({
  article,
  orgId,
  scope,
  onClose,
}: {
  article: KBArticle | null;
  orgId: string | null;
  scope: "global" | "org";
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(article?.title ?? "");
  const [category, setCategory] = useState<KBCategory>(article?.category ?? (scope === "org" ? "client-profile" : "company-profile"));
  const [content, setContent] = useState(article?.content ?? "");
  const [tags, setTags] = useState(article?.tags?.join(", ") ?? "");
  const [isPinned, setIsPinned] = useState(article?.is_pinned ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      category,
      content,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_pinned: isPinned,
    };

    if (article) {
      await fetch(`/api/pm/kb/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/pm/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          org_id: scope === "org" ? orgId : null,
        }),
      });
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!article) return;
    if (!confirm(`Delete "${article.title}"? This knowledge will be removed from all AI context.`)) return;
    await fetch(`/api/pm/kb/${article.id}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  return (
    <Modal title={article ? "Edit Knowledge Article" : "New Knowledge Article"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="e.g. Company Values & Approach" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as KBCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Comma-separated">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. values, culture" />
          </Field>
        </div>
        <Field label="Content" hint="Markdown supported. This content is injected into AI context for all features.">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text font-mono text-sm focus:outline-none focus:border-blue-500 min-h-[300px] resize-y"
            rows={14}
            placeholder={scope === "org"
              ? "Describe this client — their industry, key contacts, preferences, history with us, communication style, strategic goals..."
              : "Describe the company — values, approach, methodology, brand voice, decision frameworks..."
            }
          />
        </Field>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded border-pm-border"
          />
          <span className="text-sm text-pm-muted">Pin — always include in AI context (high priority)</span>
        </label>
        <div className="flex items-center justify-between pt-2">
          {article ? (
            <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300">
              Delete article
            </button>
          ) : <span />}
          <ModalActions onClose={onClose} saving={saving} label={article ? "Save Changes" : "Create Article"} />
        </div>
      </form>
    </Modal>
  );
}

// ─── Article Card ────────────────────────────────────────────────────

function ArticleCard({ article, onClick }: { article: KBArticle; onClick: () => void }) {
  const cat = categoryMap[article.category];
  const preview = article.content.slice(0, 180).replace(/\n/g, " ");

  return (
    <button onClick={onClick} className="card text-left w-full hover:border-pm-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{cat?.icon ?? "📝"}</span>
          <div className="min-w-0">
            <div className="font-medium text-pm-text flex items-center gap-1.5">
              {article.title}
              {article.is_pinned && <span className="text-yellow-400 text-xs" title="Pinned">★</span>}
            </div>
            <div className="text-xs text-pm-muted mt-0.5">
              {cat?.label ?? article.category}
              {article.org_id === null && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] uppercase">Global</span>}
            </div>
          </div>
        </div>
        <span className="text-xs text-pm-muted shrink-0">{formatDate(article.updated_at)}</span>
      </div>
      {preview && (
        <p className="text-sm text-pm-muted mt-2 line-clamp-2">{preview}{article.content.length > 180 ? "..." : ""}</p>
      )}
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {article.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-pm-bg text-pm-muted text-xs rounded">{tag}</span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main KB Tab ─────────────────────────────────────────────────────

export function KBTab({
  org,
  scope = "org",
}: {
  org?: Organization;
  scope?: "global" | "org";
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<KBArticle | null | "new">(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (scope === "global") {
      params.set("scope", "global");
    } else if (org) {
      params.set("org_id", org.id);
    }

    fetch(`/api/pm/kb?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setArticles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [org, scope]);

  // Separate global vs org articles for display
  const globalArticles = articles.filter((a) => a.org_id === null);
  const orgArticles = articles.filter((a) => a.org_id !== null);

  const filterAndSearch = (list: KBArticle[]) => {
    let result = list;
    if (filterCategory) result = result.filter((a) => a.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  };

  const filteredGlobal = filterAndSearch(globalArticles);
  const filteredOrg = filterAndSearch(orgArticles);
  const categories = [...new Set(articles.map((a) => a.category))];

  if (loading) {
    return <div className="text-pm-muted text-center py-8">Loading knowledge base...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-pm-muted">{articles.length} articles</span>
          {categories.length > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-2 py-0.5 rounded text-xs ${!filterCategory ? "bg-pm-accent text-white" : "text-pm-muted border border-pm-border"}`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  className={`px-2 py-0.5 rounded text-xs ${filterCategory === c ? "bg-pm-accent text-white" : "text-pm-muted border border-pm-border"}`}
                >
                  {categoryMap[c]?.icon} {categoryMap[c]?.label ?? c}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search KB..."
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text w-48 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setEditing("new")}
            className="px-3 py-1.5 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium"
          >
            + New Article
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-4 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-pm-muted">
          <strong className="text-pm-text">Knowledge Base</strong> — Articles here are automatically included as context in all AI features (chat, reports, proposals, document generation, SOP scanning). {scope === "org" ? "Client-specific articles apply to this client only. Global articles (marked with a badge) apply everywhere." : "Global articles are included in all AI interactions across every client."}
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-pm-muted text-lg mb-2">No knowledge articles yet</p>
          <p className="text-pm-muted text-sm mb-4">
            {scope === "org"
              ? "Add articles about this client — their industry, preferences, history, and key context — to help the AI make better decisions."
              : "Add articles about your company — values, approach, methodology, and decision frameworks — to establish the AI's institutional memory."
            }
          </p>
          <button
            onClick={() => setEditing("new")}
            className="px-4 py-2 bg-pm-accent hover:bg-pm-accent-hover text-white rounded-lg text-sm font-medium"
          >
            Create First Article
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Org-specific articles (shown first in org scope) */}
          {scope === "org" && filteredOrg.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">
                Client Knowledge ({filteredOrg.length})
              </h3>
              <div className="space-y-2">
                {filteredOrg.map((a) => (
                  <ArticleCard key={a.id} article={a} onClick={() => setEditing(a)} />
                ))}
              </div>
            </div>
          )}

          {/* Global articles */}
          {filteredGlobal.length > 0 && (
            <div>
              {scope === "org" && (
                <h3 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-3">
                  Company Knowledge ({filteredGlobal.length})
                </h3>
              )}
              <div className="space-y-2">
                {filteredGlobal.map((a) => (
                  <ArticleCard key={a.id} article={a} onClick={() => setEditing(a)} />
                ))}
              </div>
            </div>
          )}

          {filteredGlobal.length === 0 && filteredOrg.length === 0 && (
            <p className="text-pm-muted text-center py-8">No articles match your filter.</p>
          )}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <ArticleModal
          article={editing === "new" ? null : editing}
          orgId={org?.id ?? null}
          scope={scope}
          onClose={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
