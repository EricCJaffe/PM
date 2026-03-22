"use client";

import { useState, useEffect } from "react";

interface PlatformBrandingForm {
  company_name: string;
  company_short_name: string;
  tagline: string;
  logo_url: string;
  logo_icon_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_on_primary: string;
  text_on_light: string;
  bg_dark: string;
  bg_light: string;
  font_heading: string;
  font_body: string;
  email_from_name: string;
  email_from_address: string;
  website_url: string;
  support_email: string;
  footer_text: string;
  location: string;
}

const FONT_OPTIONS = ["Helvetica", "Arial", "Georgia", "Inter", "Roboto", "system-ui"];

export default function AdminBrandingPanel() {
  const [form, setForm] = useState<PlatformBrandingForm>({
    company_name: "",
    company_short_name: "",
    tagline: "",
    logo_url: "",
    logo_icon_url: "",
    favicon_url: "",
    primary_color: "#1B2A4A",
    secondary_color: "#5B9BD5",
    accent_color: "#c4793a",
    text_on_primary: "#ffffff",
    text_on_light: "#1a1a1a",
    bg_dark: "#1c2b1e",
    bg_light: "#f5f0e8",
    font_heading: "Helvetica",
    font_body: "Helvetica",
    email_from_name: "",
    email_from_address: "",
    website_url: "",
    support_email: "",
    footer_text: "",
    location: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/pm/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({
            company_name: data.company_name ?? "",
            company_short_name: data.company_short_name ?? "",
            tagline: data.tagline ?? "",
            logo_url: data.logo_url ?? "",
            logo_icon_url: data.logo_icon_url ?? "",
            favicon_url: data.favicon_url ?? "",
            primary_color: data.primary_color ?? "#1B2A4A",
            secondary_color: data.secondary_color ?? "#5B9BD5",
            accent_color: data.accent_color ?? "#c4793a",
            text_on_primary: data.text_on_primary ?? "#ffffff",
            text_on_light: data.text_on_light ?? "#1a1a1a",
            bg_dark: data.bg_dark ?? "#1c2b1e",
            bg_light: data.bg_light ?? "#f5f0e8",
            font_heading: data.font_heading ?? "Helvetica",
            font_body: data.font_body ?? "Helvetica",
            email_from_name: data.email_from_name ?? "",
            email_from_address: data.email_from_address ?? "",
            website_url: data.website_url ?? "",
            support_email: data.support_email ?? "",
            footer_text: data.footer_text ?? "",
            location: data.location ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v === "" ? null : v;
      }
      // Always send non-null for required fields
      payload.company_name = form.company_name || "Foundation Stone Advisors";
      payload.company_short_name = form.company_short_name || "FSA";
      payload.primary_color = form.primary_color || "#1B2A4A";
      payload.secondary_color = form.secondary_color || "#5B9BD5";
      payload.accent_color = form.accent_color || "#c4793a";

      await fetch("/api/pm/branding", {
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

  function update(key: keyof PlatformBrandingForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <p className="text-pm-muted">Loading branding settings...</p>;

  return (
    <div className="space-y-8">
      <p className="text-sm text-pm-muted">
        Platform-level branding applied to all client-facing output — PDFs, emails, share pages, proposals.
        Per-client overrides can be set in each organization&apos;s dashboard.
      </p>

      {/* Identity */}
      <Section title="Company Identity">
        <Field label="Company Name" value={form.company_name} onChange={(v) => update("company_name", v)} />
        <Field label="Short Name" value={form.company_short_name} onChange={(v) => update("company_short_name", v)} hint="e.g. FSA" />
        <Field label="Tagline" value={form.tagline} onChange={(v) => update("tagline", v)} />
        <Field label="Location" value={form.location} onChange={(v) => update("location", v)} />
        <Field label="Website URL" value={form.website_url} onChange={(v) => update("website_url", v)} />
      </Section>

      {/* Logos */}
      <Section title="Logos">
        <Field label="Primary Logo URL" value={form.logo_url} onChange={(v) => update("logo_url", v)} hint="Full logo (used on covers, headers)" />
        <Field label="Icon Logo URL" value={form.logo_icon_url} onChange={(v) => update("logo_icon_url", v)} hint="Square icon variant" />
        <Field label="Favicon URL" value={form.favicon_url} onChange={(v) => update("favicon_url", v)} />
        {form.logo_url && (
          <div className="mt-2 p-4 bg-pm-bg rounded-lg">
            <p className="text-xs text-pm-muted mb-2">Logo Preview</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.logo_url} alt="Logo preview" className="h-12 object-contain" />
          </div>
        )}
      </Section>

      {/* Colors */}
      <Section title="Color Palette">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ColorField label="Primary" value={form.primary_color} onChange={(v) => update("primary_color", v)} />
          <ColorField label="Secondary" value={form.secondary_color} onChange={(v) => update("secondary_color", v)} />
          <ColorField label="Accent" value={form.accent_color} onChange={(v) => update("accent_color", v)} />
          <ColorField label="Text on Primary" value={form.text_on_primary} onChange={(v) => update("text_on_primary", v)} />
          <ColorField label="Text on Light" value={form.text_on_light} onChange={(v) => update("text_on_light", v)} />
          <ColorField label="Cover/Dark BG" value={form.bg_dark} onChange={(v) => update("bg_dark", v)} />
          <ColorField label="Content/Light BG" value={form.bg_light} onChange={(v) => update("bg_light", v)} />
        </div>
        {/* Preview swatch */}
        <div className="mt-4 rounded-lg overflow-hidden border border-pm-border">
          <div className="h-16 flex items-center px-4 gap-3" style={{ background: form.bg_dark }}>
            <span style={{ color: form.text_on_primary, fontWeight: 700 }}>{form.company_name || "Company"}</span>
            <span style={{ color: form.accent_color, fontSize: "0.75rem" }}>{form.tagline}</span>
          </div>
          <div className="h-12 flex items-center px-4 gap-3" style={{ background: form.primary_color }}>
            <span style={{ color: form.text_on_primary, fontSize: "0.875rem" }}>Section Header</span>
          </div>
          <div className="h-12 flex items-center px-4" style={{ background: form.bg_light }}>
            <span style={{ color: form.text_on_light, fontSize: "0.875rem" }}>Body content on light background</span>
          </div>
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Heading Font" value={form.font_heading} options={FONT_OPTIONS} onChange={(v) => update("font_heading", v)} />
          <SelectField label="Body Font" value={form.font_body} options={FONT_OPTIONS} onChange={(v) => update("font_body", v)} />
        </div>
      </Section>

      {/* Email */}
      <Section title="Email Settings">
        <Field label="From Name" value={form.email_from_name} onChange={(v) => update("email_from_name", v)} hint="Display name in outbound emails" />
        <Field label="From Address" value={form.email_from_address} onChange={(v) => update("email_from_address", v)} />
        <Field label="Support Email" value={form.support_email} onChange={(v) => update("support_email", v)} />
        <Field label="Footer Text" value={form.footer_text} onChange={(v) => update("footer_text", v)} hint="Shown at bottom of emails and documents" />
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>
        {saved && <span className="text-pm-complete text-sm">Saved!</span>}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

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
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-pm-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pm-accent"
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-pm-muted mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:ring-1 focus:ring-pm-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
