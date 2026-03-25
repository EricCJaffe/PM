"use client";

import { useState, useEffect } from "react";
import type { DocumentIntakeField, Member } from "@/types/pm";
import type { Organization } from "@/types/pm";
import { LineItemsEditor } from "./LineItemsEditor";

interface IntakeFormProps {
  fields: DocumentIntakeField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onAiAssist?: (fieldKey: string) => void;
  aiLoading?: string | null;
  orgId?: string;
}

interface UserProfile {
  display_name: string;
  job_title?: string;
}

export function IntakeForm({ fields, values, onChange, onAiAssist, aiLoading }: IntakeFormProps) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [siteMembers, setSiteMembers] = useState<Member[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Fetch organizations
  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setOrgs(d); })
      .catch(() => {});
  }, []);

  // Fetch current user profile (for provider_title auto-fill)
  useEffect(() => {
    fetch("/api/pm/auth/profile")
      .then((r) => r.json())
      .then((d) => { if (d && !d.error) setUserProfile(d); })
      .catch(() => {});
  }, []);

  // Fetch site org members (for Prepared By dropdown)
  useEffect(() => {
    // Find the site org to get its members
    const siteOrg = orgs.find((o) => o.is_site_org);
    if (!siteOrg) return;
    fetch(`/api/pm/members?org_id=${siteOrg.id}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSiteMembers(d); })
      .catch(() => {});
  }, [orgs]);

  // Group fields by section
  const sections = new Map<string, DocumentIntakeField[]>();
  for (const f of fields) {
    const group = sections.get(f.section) ?? [];
    group.push(f);
    sections.set(f.section, group);
  }

  function setValue(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  function setValues(updates: Record<string, string>) {
    onChange({ ...values, ...updates });
  }

  return (
    <div className="space-y-8">
      {/* Org selector — always first */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-pm-muted mb-1">Client Organization</label>
        <select
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          value={values._org_id ?? ""}
          onChange={(e) => {
            const org = orgs.find((o) => o.id === e.target.value);
            // Batch all auto-fill values in a single update
            const updates: Record<string, string> = { _org_id: e.target.value };
            if (org) {
              updates.client_name = org.name;
              if (org.contact_name) updates.client_contact_name = org.contact_name;
              if (org.contact_email) updates.client_contact_email = org.contact_email;
            }
            setValues(updates);
          }}
        >
          <option value="">Select an organization...</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {Array.from(sections.entries()).map(([sectionName, sectionFields]) => (
        <div key={sectionName}>
          <h3 className="text-sm font-semibold text-pm-text mb-3 border-b border-pm-border pb-2">
            {sectionName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionFields.map((field) => (
              <div
                key={field.field_key}
                className={field.field_type === "textarea" ? "md:col-span-2" : ""}
              >
                <FieldInput
                  field={field}
                  value={values[field.field_key] ?? field.default_value ?? ""}
                  onChange={(v) => {
                    if (field.field_key === "prepared_by") {
                      // Auto-fill provider_title from user profile when selecting yourself
                      const updates: Record<string, string> = { prepared_by: v };
                      if (userProfile && v === userProfile.display_name && userProfile.job_title) {
                        updates.provider_title = userProfile.job_title;
                      }
                      setValues(updates);
                    } else {
                      setValue(field.field_key, v);
                    }
                  }}
                  onAiAssist={onAiAssist ? () => onAiAssist(field.field_key) : undefined}
                  aiLoading={aiLoading === field.field_key}
                  siteMembers={field.field_key === "prepared_by" ? siteMembers : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onAiAssist,
  aiLoading,
  siteMembers,
}: {
  field: DocumentIntakeField;
  value: string;
  onChange: (v: string) => void;
  onAiAssist?: () => void;
  aiLoading?: boolean;
  siteMembers?: Member[];
}) {
  const cls = "w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500";

  // Render team member dropdown for prepared_by
  const isTeamMemberSelect = field.field_key === "prepared_by" && siteMembers && siteMembers.length > 0;
  const isLineItems = field.field_key === "line_items";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-pm-muted">
          {field.label}
          {field.is_required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {onAiAssist && field.field_type === "textarea" && !isLineItems && (
          <button
            type="button"
            onClick={onAiAssist}
            disabled={aiLoading}
            className="text-xs px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50"
          >
            {aiLoading ? "Generating..." : "AI Assist"}
          </button>
        )}
      </div>

      {isLineItems ? (
        <LineItemsEditor value={value || "[]"} onChange={onChange} />
      ) : isTeamMemberSelect ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select team member...</option>
          {siteMembers.map((m) => (
            <option key={m.id} value={m.display_name}>
              {m.display_name}{m.role ? ` (${m.role})` : ""}
            </option>
          ))}
        </select>
      ) : field.field_type === "textarea" ? (
        <textarea
          className={`${cls} resize-none`}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
        />
      ) : field.field_type === "select" ? (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(field.options ?? []).map((opt) => (
            <option key={typeof opt === "string" ? opt : String(opt)} value={typeof opt === "string" ? opt : String(opt)}>
              {typeof opt === "string" ? opt : String(opt)}
            </option>
          ))}
        </select>
      ) : field.field_type === "toggle" ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="w-4 h-4 rounded border-pm-border bg-pm-bg text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-pm-muted">{field.help_text ?? "Enable"}</span>
        </label>
      ) : field.field_type === "currency" ? (
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-pm-muted text-sm">$</span>
          <input
            type="number"
            className={`${cls} pl-7`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? ""}
          />
        </div>
      ) : (
        <input
          type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
        />
      )}

      {field.help_text && field.field_type !== "toggle" && (
        <p className="text-xs text-pm-muted mt-1">{field.help_text}</p>
      )}
    </div>
  );
}
