"use client";
import { useState, useEffect, useCallback } from "react";
import type { Organization, BaseVocabTerm, DepartmentVocab, Department } from "@/types/pm";
import { BASE_VOCAB_TERMS } from "@/types/pm";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function VocabTab({ org }: { org: Organization }) {
  const [vocab, setVocab] = useState<Record<BaseVocabTerm, string>>(() =>
    Object.fromEntries(BASE_VOCAB_TERMS.map((t) => [t, capitalize(t)])) as Record<BaseVocabTerm, string>
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadVocab = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ org_id: org.id });
      if (selectedDeptId) params.set("department_id", selectedDeptId);

      const res = await fetch(`/api/pm/departments/vocab?${params}`);
      const data = await res.json();

      const resolved: Record<BaseVocabTerm, string> = Object.fromEntries(
        BASE_VOCAB_TERMS.map((t) => [t, capitalize(t)])
      ) as Record<BaseVocabTerm, string>;

      if (Array.isArray(data)) {
        for (const item of data as { base_term: BaseVocabTerm; display_label: string }[]) {
          if (BASE_VOCAB_TERMS.includes(item.base_term)) {
            resolved[item.base_term] = item.display_label;
          }
        }
      }

      setVocab(resolved);
      setDirty(false);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [org.id, selectedDeptId]);

  useEffect(() => {
    fetch(`/api/pm/departments?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(() => {});
  }, [org.id]);

  useEffect(() => {
    loadVocab();
  }, [loadVocab]);

  function handleChange(term: BaseVocabTerm, value: string) {
    setVocab((prev) => ({ ...prev, [term]: value }));
    setDirty(true);
    setSaveMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

    const overrides = BASE_VOCAB_TERMS.map((term) => ({
      base_term: term,
      display_label: vocab[term].trim() || capitalize(term),
    }));

    try {
      const res = await fetch("/api/pm/departments/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: org.id,
          department_id: selectedDeptId,
          overrides,
        }),
      });

      if (res.ok) {
        setSaveMessage("Vocabulary saved successfully.");
        setDirty(false);
      } else {
        setSaveMessage("Failed to save. Please try again.");
      }
    } catch {
      setSaveMessage("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const defaults = Object.fromEntries(
      BASE_VOCAB_TERMS.map((t) => [t, capitalize(t)])
    ) as Record<BaseVocabTerm, string>;
    setVocab(defaults);
    setDirty(true);
    setSaveMessage(null);
  }

  if (loading) {
    return <div className="text-pm-muted text-center py-8">Loading vocabulary...</div>;
  }

  return (
    <div>
      {/* Info banner */}
      <div className="mb-4 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-pm-muted">
          <strong className="text-pm-text">Vocabulary Customization</strong> — Rename
          standard terms to match this organization&apos;s language. For example, rename
          &quot;People&quot; to &quot;Team Members&quot; or &quot;Meetings&quot; to
          &quot;Huddles.&quot; Overrides can apply org-wide or to a specific department.
        </p>
      </div>

      {/* Department scope picker */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-pm-muted">Scope:</label>
        <select
          value={selectedDeptId ?? ""}
          onChange={(e) => {
            setSelectedDeptId(e.target.value || null);
            setDirty(false);
            setSaveMessage(null);
          }}
          className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text focus:outline-none focus:border-blue-500"
        >
          <option value="">Org-wide (all departments)</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Vocabulary table */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pm-border">
              <th className="text-left text-xs font-semibold text-pm-muted uppercase tracking-wider py-2 px-3 w-1/3">
                Base Term
              </th>
              <th className="text-left text-xs font-semibold text-pm-muted uppercase tracking-wider py-2 px-3">
                Display Label
              </th>
            </tr>
          </thead>
          <tbody>
            {BASE_VOCAB_TERMS.map((term) => (
              <tr key={term} className="border-b border-pm-border last:border-0">
                <td className="py-3 px-3">
                  <span className="text-sm text-pm-muted font-mono">{term}</span>
                </td>
                <td className="py-3 px-3">
                  <input
                    type="text"
                    value={vocab[term]}
                    onChange={(e) => handleChange(term, e.target.value)}
                    className="bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-sm text-pm-text w-full max-w-xs focus:outline-none focus:border-blue-500"
                    placeholder={capitalize(term)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={handleReset}
          className="text-sm text-pm-muted hover:text-pm-text transition-colors"
        >
          Reset to Defaults
        </button>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("success") ? "text-green-400" : "text-red-400"}`}>
              {saveMessage}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 bg-pm-accent hover:bg-pm-accent-hover text-white text-sm rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
