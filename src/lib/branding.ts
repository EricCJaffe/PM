import { createServiceClient } from "./supabase/server";
import type { PlatformBranding, OrgBranding, ResolvedBranding, CoBrandMode } from "@/types/pm";

// ─── Defaults (used when DB row doesn't exist yet) ───────────────────

const PLATFORM_DEFAULTS: Omit<PlatformBranding, "id" | "created_at" | "updated_at"> = {
  company_name: "Foundation Stone Advisors",
  company_short_name: "FSA",
  tagline: "Pouring the Foundation for Your Success",
  logo_url: null,
  logo_icon_url: null,
  favicon_url: null,
  primary_color: "#1B2A4A",
  secondary_color: "#5B9BD5",
  accent_color: "#c4793a",
  text_on_primary: "#ffffff",
  text_on_light: "#1a1a1a",
  bg_dark: "#1c2b1e",
  bg_light: "#f5f0e8",
  font_heading: "Helvetica",
  font_body: "Helvetica",
  email_from_name: "BusinessOS PM",
  email_from_address: "admin@foundationstoneadvisors.com",
  website_url: "https://pm.foundationstoneadvisors.com",
  support_email: null,
  footer_text: "Foundation Stone Advisors — Project Management",
  location: "Orange Park, FL",
};

// ─── Core Resolver ───────────────────────────────────────────────────

/**
 * Get resolved branding for a given context.
 *
 * - No orgId → pure platform branding
 * - With orgId → platform merged with org overrides (co-brand mode respected)
 *
 * This is THE function all client-facing output should call.
 * Emails, PDFs, share pages, proposals — everything goes through here.
 */
export async function getBranding(orgId?: string | null): Promise<ResolvedBranding> {
  const supabase = createServiceClient();

  // Fetch platform branding (singleton)
  const { data: platformRow } = await supabase
    .from("pm_platform_branding")
    .select("*")
    .limit(1)
    .single();

  const platform = (platformRow as PlatformBranding | null) ?? PLATFORM_DEFAULTS as unknown as PlatformBranding;

  // Base resolved branding from platform
  const resolved: ResolvedBranding = {
    agency_name: platform.company_name,
    agency_short_name: platform.company_short_name,
    agency_tagline: platform.tagline,
    agency_logo_url: platform.logo_url,
    agency_logo_icon_url: platform.logo_icon_url,
    client_name: null,
    client_logo_url: null,
    client_logo_icon_url: null,
    co_brand_mode: "agency-only",
    primary_color: platform.primary_color,
    secondary_color: platform.secondary_color,
    accent_color: platform.accent_color,
    text_on_primary: platform.text_on_primary,
    text_on_light: platform.text_on_light,
    bg_dark: platform.bg_dark,
    bg_light: platform.bg_light,
    font_heading: platform.font_heading,
    font_body: platform.font_body,
    email_from_name: platform.email_from_name,
    email_from_address: platform.email_from_address,
    website_url: platform.website_url,
    footer_text: platform.footer_text ?? `${platform.company_name} — Project Management`,
    location: platform.location,
  };

  if (!orgId) return resolved;

  // Fetch org branding overrides
  const { data: orgRow } = await supabase
    .from("pm_org_branding")
    .select("*")
    .eq("org_id", orgId)
    .single();

  if (!orgRow) return resolved;

  const org = orgRow as OrgBranding;

  // Apply org overrides
  resolved.client_name = org.client_company_name;
  resolved.client_logo_url = org.client_logo_url;
  resolved.client_logo_icon_url = org.client_logo_icon_url;
  resolved.co_brand_mode = org.co_brand_mode;

  // Color overrides
  if (org.primary_color_override) resolved.primary_color = org.primary_color_override;
  if (org.secondary_color_override) resolved.secondary_color = org.secondary_color_override;
  if (org.accent_color_override) resolved.accent_color = org.accent_color_override;
  if (org.cover_bg_override) resolved.bg_dark = org.cover_bg_override;
  if (org.content_bg_override) resolved.bg_light = org.content_bg_override;

  // Footer override
  if (org.footer_text_override) resolved.footer_text = org.footer_text_override;

  // Email from name override
  if (org.email_from_name_override) resolved.email_from_name = org.email_from_name_override;

  return resolved;
}

// ─── Helper: Build "Prepared by" line based on co-brand mode ─────────

export function buildPreparedBy(branding: ResolvedBranding): string {
  switch (branding.co_brand_mode) {
    case "agency-only":
      return branding.agency_name;
    case "co-branded":
      return branding.client_name
        ? `${branding.agency_name} & ${branding.client_name}`
        : branding.agency_name;
    case "client-only":
      return branding.client_name ?? branding.agency_name;
    case "white-label":
      return branding.client_name ?? branding.agency_name;
    default:
      return branding.agency_name;
  }
}

// ─── Helper: Build email FROM string ─────────────────────────────────

export function buildEmailFrom(branding: ResolvedBranding): string {
  return `${branding.email_from_name} <${branding.email_from_address}>`;
}

// ─── Helper: Build footer HTML for emails ────────────────────────────

export function buildEmailFooterHtml(branding: ResolvedBranding): string {
  const line = branding.footer_text;
  const link = branding.website_url
    ? `<br/><a href="${branding.website_url}" style="color: ${branding.secondary_color}; text-decoration: none;">${branding.website_url.replace(/^https?:\/\//, "")}</a>`
    : "";
  return `<p style="color: #94a3b8; font-size: 12px;">${line}${link}</p>`;
}

// ─── Helper: Build co-branded logo section for HTML documents ────────

export function buildLogoHtml(branding: ResolvedBranding, opts?: { height?: string }): string {
  const h = opts?.height ?? "48px";
  const logos: string[] = [];

  const showAgencyLogo = branding.co_brand_mode !== "client-only";
  const showClientLogo = branding.co_brand_mode !== "agency-only" && branding.client_logo_url;

  if (showAgencyLogo && branding.agency_logo_url) {
    logos.push(`<img src="${branding.agency_logo_url}" alt="${branding.agency_name}" style="height:${h};object-fit:contain;" />`);
  } else if (showAgencyLogo) {
    logos.push(`<span style="font-size:18pt;font-weight:700;color:${branding.text_on_primary};">${branding.agency_name}</span>`);
  }

  if (showClientLogo && branding.client_logo_url) {
    if (logos.length > 0) {
      logos.push(`<span style="color:${branding.text_on_primary};font-size:14pt;margin:0 12px;">×</span>`);
    }
    logos.push(`<img src="${branding.client_logo_url}" alt="${branding.client_name ?? "Client"}" style="height:${h};object-fit:contain;" />`);
  }

  return `<div style="display:flex;align-items:center;gap:8px;">${logos.join("")}</div>`;
}

// ─── Helper: CSS variables from branding (for HTML documents) ────────

export function brandingToCssVars(branding: ResolvedBranding): string {
  return `
    --brand-primary: ${branding.primary_color};
    --brand-secondary: ${branding.secondary_color};
    --brand-accent: ${branding.accent_color};
    --brand-text-on-primary: ${branding.text_on_primary};
    --brand-text-on-light: ${branding.text_on_light};
    --brand-bg-dark: ${branding.bg_dark};
    --brand-bg-light: ${branding.bg_light};
    --brand-font-heading: ${branding.font_heading}, Arial, sans-serif;
    --brand-font-body: ${branding.font_body}, Arial, sans-serif;
  `.trim();
}

// ─── Re-export defaults for client components that need fallbacks ─────

export { PLATFORM_DEFAULTS };
