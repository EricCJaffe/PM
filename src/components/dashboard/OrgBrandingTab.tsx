"use client";

import { useState, useEffect } from "react";
import type { Organization, CoBrandMode } from "@/types/pm";

const CO_BRAND_MODES: { value: CoBrandMode; label: string; description: string }[] = [
  { value: "agency-only", label: "Agency Only", description: "Only show our branding on documents" },
  { value: "co-branded", label: "Co-Branded", description: "Show both agency and client logos side by side" },
  { value: "client-only", label: "Client Only", description: "Show only the client's branding" },
  { value: "white-label", label: "White Label", description: "Fully rebrand output under client's identity" },
];

interface OrgBrandingForm {
  client_logo_url: string;
  client_logo_icon_url: string;
  client_company_name: string;
  primary_color_override: string;
  secondary_color_override: string;
  accent_color_override: string;
  co_brand_mode: CoBrandMode;
  cover_bg_override: string;
  content_bg_override: string;
  footer_text_override: string;
  email_from_name_override: string;
  notes: string;
}

export function OrgBrandingTab({ org }: { org: Organization }) {
  const [form, setForm] = useState<OrgBrandingForm>({
    client_logo_url: "",
    client_logo_icon_url: "",
    client_company_name: "",
    primary_color_override: "",
    secondary_color_override: "",
    accent_color_override: "",
    co_brand_mode: "agency-only",
    cover_bg_override: "",
    content_bg_override: "",
    footer_text_override: "",
    email_from_name_override: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/pm/branding/org?org_id=${org.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            client_logo_url: data.client_logo_url ?? "",
            client_logo_icon_url: data.client_logo_icon_url ?? "",
            client_company_name: data.client_company_name ?? "",
            primary_color_override: data.primary_color_override ?? "",
            secondary_color_override: data.secondary_color_override ?? "",
            accent_color_override: data.accent_color_override ?? "",
            co_brand_mode: data.co_brand_mode ?? "agency-only",
            cover_bg_override: data.cover_bg_override ?? "",
            content_bg_override: data.content_bg_override ?? "",
            footer_text_override: data.footer_text_override ?? "",
            email_from_name_override: data.email_from_name_override ?? "",
            notes: data.notes ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [org.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = { org_id: org.id };
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v === "" ? null : v;
      }
      payload.co_brand_mode = form.co_brand_mode;

      await fetch("/api/pm/branding/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function update(key: keyof OrgBrandingForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <p className="text-pm-muted">Loading branding...</p>;

  return (
    <div className="space-y-8">
      <p className="text-sm text-pm-muted">
        Client-level branding overrides for <strong className="text-pm-text">{org.name}</strong>.
        These settings override platform defaults for this client&apos;s documents, emails, and share pages.
      </p>

      {/* Co-Brand Mode */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
          Co-Branding Mode
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CO_BRAND_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => update("co_brand_mode", mode.value)}
              className={`text-left p-4 rounded-lg border transition-colors ${
                form.co_brand_mode === mode.value
                  ? "border-pm-accent bg-pm-accent/10"
                  : "border-pm-border bg-pm-bg hover:border-pm-muted"
              }`}
            >
              <div className="font-medium text-pm-text">{mode.label}</div>
              <div className="text-xs text-pm-muted mt-1">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Client Identity */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
          Client Identity
        </h3>
        <div className="space-y-3">
          <Field label="Company Name Override" value={form.client_company_name} onChange={(v) => update("client_company_name", v)} hint="Leave blank to use org name" />
          <Field label="Client Logo URL" value={form.client_logo_url} onChange={(v) => update("client_logo_url", v)} hint="Used in co-branded and client-only documents" />
          <Field label="Client Icon URL" value={form.client_logo_icon_url} onChange={(v) => update("client_logo_icon_url", v)} hint="Square icon variant" />

          {form.client_logo_url && (
            <div className="p-4 bg-pm-bg rounded-lg">
              <p className="text-xs text-pm-muted mb-2">Client Logo Preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.client_logo_url} alt="Client logo" className="h-12 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* Color Overrides */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
          Color Overrides
        </h3>
        <p className="text-xs text-pm-muted mb-3">Leave blank to use platform defaults.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField label="Primary Color" value={form.primary_color_override} onChange={(v) => update("primary_color_override", v)} />
          <ColorField label="Secondary Color" value={form.secondary_color_override} onChange={(v) => update("secondary_color_override", v)} />
          <ColorField label="Accent Color" value={form.accent_color_override} onChange={(v) => update("accent_color_override", v)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ColorField label="Cover/Dark Background" value={form.cover_bg_override} onChange={(v) => update("cover_bg_override", v)} />
          <ColorField label="Content/Light Background" value={form.content_bg_override} onChange={(v) => update("content_bg_override", v)} />
        </div>
      </div>

      {/* Other Overrides */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
          Other Overrides
        </h3>
        <div className="space-y-3">
          <Field label="Footer Text" value={form.footer_text_override} onChange={(v) => update("footer_text_override", v)} hint="Custom footer for this client's documents and emails" />
          <Field label="Email From Name" value={form.email_from_name_override} onChange={(v) => update("email_from_name_override", v)} hint="Custom sender name for emails to this client" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
          Notes
        </h3>
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          placeholder="Internal notes about this client's branding preferences..."
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:ring-1 focus:ring-pm-accent"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saving ? "Saving..." : "Save Client Branding"}
        </button>
        {saved && <span className="text-pm-complete text-sm">Saved!</span>}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-pm-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:ring-1 focus:ring-pm-accent"
      />
      {hint && <p className="text-xs text-pm-muted mt-1">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-pm-muted mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {value && (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded border border-pm-border cursor-pointer"
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Inherit from platform"
          className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pm-accent"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="text-xs text-pm-muted hover:text-pm-blocked"
            title="Clear override"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
