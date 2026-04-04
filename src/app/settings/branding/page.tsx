"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PlatformBranding } from "@/types/pm";

type BrandingForm = Omit<PlatformBranding, "id" | "created_at" | "updated_at">;

const DEFAULTS: BrandingForm = {
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
};

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
      <label className="block text-xs font-medium text-pm-muted mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-pm-border bg-pm-bg cursor-pointer"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text font-mono focus:outline-none focus:border-blue-500"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-pm-muted mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
      />
      {hint && <p className="text-xs text-pm-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function BrandingPage() {
  const [form, setForm] = useState<BrandingForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pm/branding")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          const { id, created_at, updated_at, ...rest } = data;
          setForm({ ...DEFAULTS, ...rest });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof BrandingForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value || null }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/pm/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-pm-muted">Loading branding settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/settings" className="text-sm text-pm-muted hover:text-pm-accent transition-colors">
          &larr; Back to Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-pm-text mb-1">Platform Branding</h1>
      <p className="text-pm-muted text-sm mb-8">
        Configure your company identity used in PDFs, emails, portals, and share pages.
      </p>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Identity */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Company Name"
              value={form.company_name}
              onChange={(v) => set("company_name", v)}
              placeholder="Foundation Stone Advisors"
            />
            <TextField
              label="Short Name / Abbreviation"
              value={form.company_short_name}
              onChange={(v) => set("company_short_name", v)}
              placeholder="FSA"
            />
            <div className="md:col-span-2">
              <TextField
                label="Tagline"
                value={form.tagline ?? ""}
                onChange={(v) => set("tagline", v)}
                placeholder="Pouring the Foundation for Your Success"
              />
            </div>
            <TextField
              label="Location"
              value={form.location ?? ""}
              onChange={(v) => set("location", v)}
              placeholder="Orange Park, FL"
            />
            <TextField
              label="Website URL"
              value={form.website_url ?? ""}
              onChange={(v) => set("website_url", v)}
              placeholder="https://yourcompany.com"
              type="url"
            />
          </div>
        </div>

        {/* Logos */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Logos</h2>
          <div className="grid grid-cols-1 gap-4">
            <TextField
              label="Full Logo URL"
              value={form.logo_url ?? ""}
              onChange={(v) => set("logo_url", v)}
              placeholder="https://yourcompany.com/logo.png"
              hint="Used in document headers, portals, and PDFs"
            />
            <TextField
              label="Icon / Square Logo URL"
              value={form.logo_icon_url ?? ""}
              onChange={(v) => set("logo_icon_url", v)}
              placeholder="https://yourcompany.com/icon.png"
              hint="Used for favicons, avatars, and compact headers"
            />
            <TextField
              label="Favicon URL"
              value={form.favicon_url ?? ""}
              onChange={(v) => set("favicon_url", v)}
              placeholder="https://yourcompany.com/favicon.ico"
            />
          </div>
          {form.logo_url && (
            <div className="mt-4 p-3 bg-pm-bg rounded-lg border border-pm-border">
              <p className="text-xs text-pm-muted mb-2">Logo preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logo_url} alt="Logo preview" className="h-10 object-contain" />
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorField label="Primary Color" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
            <ColorField label="Secondary Color" value={form.secondary_color} onChange={(v) => set("secondary_color", v)} />
            <ColorField label="Accent Color" value={form.accent_color} onChange={(v) => set("accent_color", v)} />
            <ColorField label="Text on Primary" value={form.text_on_primary} onChange={(v) => set("text_on_primary", v)} />
            <ColorField label="Text on Light" value={form.text_on_light} onChange={(v) => set("text_on_light", v)} />
            <ColorField label="Dark Background" value={form.bg_dark} onChange={(v) => set("bg_dark", v)} />
            <ColorField label="Light Background" value={form.bg_light} onChange={(v) => set("bg_light", v)} />
          </div>

          {/* Swatch preview */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              { label: "Primary", color: form.primary_color },
              { label: "Secondary", color: form.secondary_color },
              { label: "Accent", color: form.accent_color },
            ].map(({ label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded-lg border border-pm-border"
                  style={{ background: color }}
                />
                <span className="text-xs text-pm-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Typography</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Heading Font"
              value={form.font_heading}
              onChange={(v) => set("font_heading", v)}
              placeholder="Helvetica"
              hint="Used for headings in PDFs and documents"
            />
            <TextField
              label="Body Font"
              value={form.font_body}
              onChange={(v) => set("font_body", v)}
              placeholder="Helvetica"
              hint="Used for body text in PDFs and documents"
            />
          </div>
        </div>

        {/* Email */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-pm-text uppercase tracking-wider">Email</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="From Name"
              value={form.email_from_name}
              onChange={(v) => set("email_from_name", v)}
              placeholder="BusinessOS PM"
            />
            <TextField
              label="From Address"
              value={form.email_from_address}
              onChange={(v) => set("email_from_address", v)}
              placeholder="admin@yourcompany.com"
              type="email"
            />
            <TextField
              label="Support Email"
              value={form.support_email ?? ""}
              onChange={(v) => set("support_email", v)}
              placeholder="support@yourcompany.com"
              type="email"
            />
            <div className="md:col-span-2">
              <TextField
                label="Footer Text"
                value={form.footer_text ?? ""}
                onChange={(v) => set("footer_text", v)}
                placeholder="Company Name — Project Management"
                hint="Appears at the bottom of PDFs, reports, and emails"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center gap-4 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save Branding"}
          </button>
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Branding saved
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
