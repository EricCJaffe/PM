"use client";

import { useState, useEffect } from "react";
import type { DocumentIntakeField } from "@/types/pm";
import type { Organization } from "@/types/pm";

interface IntakeFormProps {
  fields: DocumentIntakeField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onAiAssist?: (fieldKey: string) => void;
  aiLoading?: string | null;
  orgId?: string;
}

export function IntakeForm({ fields, values, onChange, onAiAssist, aiLoading }: IntakeFormProps) {
  const [orgs, setOrgs] = useState<Organization[]>([]);

  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setOrgs(d); })
      .catch(() => {});
  }, []);

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

  return (
    <div className="space-y-8">
      {/* Org selector — always first */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-pm-muted mb-1">Client Organization</label>
        <select
          className="w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500"
          value={values._org_id ?? ""}
          onChange={(e) => {
            setValue("_org_id", e.target.value);
            // Auto-fill client name from org
            const org = orgs.find((o) => o.id === e.target.value);
            if (org) {
              if (!values.client_name) setValue("client_name", org.name);
              if (!values.client_contact_name && org.contact_name) setValue("client_contact_name", org.contact_name);
              if (!values.client_contact_email && org.contact_email) setValue("client_contact_email", org.contact_email);
            }
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
                  onChange={(v) => setValue(field.field_key, v)}
                  onAiAssist={onAiAssist ? () => onAiAssist(field.field_key) : undefined}
                  aiLoading={aiLoading === field.field_key}
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
}: {
  field: DocumentIntakeField;
  value: string;
  onChange: (v: string) => void;
  onAiAssist?: () => void;
  aiLoading?: boolean;
}) {
  const cls = "w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-sm font-medium text-pm-muted">
          {field.label}
          {field.is_required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {onAiAssist && field.field_type === "textarea" && (
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

      {field.field_type === "textarea" ? (
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
