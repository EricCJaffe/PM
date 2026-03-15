"use client";
import { useEffect, useState } from "react";
import type { AssignableMember } from "@/types/pm";

const selectCls = "w-full bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500";

interface OwnerPickerProps {
  orgId: string;
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function OwnerPicker({ orgId, value, onChange, disabled, placeholder = "Select owner…" }: OwnerPickerProps) {
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setMembers([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pm/members/assignable?org_id=${orgId}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setMembers(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setMembers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  const siteStaff = members.filter((m) => m.is_site_staff);
  const orgMembers = members.filter((m) => !m.is_site_staff);

  return (
    <select
      className={selectCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading || !orgId}
    >
      <option value="">{loading ? "Loading…" : placeholder}</option>
      {siteStaff.length > 0 && (
        <optgroup label={siteStaff[0].org_name}>
          {siteStaff.map((m) => (
            <option key={m.id} value={m.slug}>{m.display_name}</option>
          ))}
        </optgroup>
      )}
      {orgMembers.length > 0 && (
        <optgroup label={orgMembers[0].org_name}>
          {orgMembers.map((m) => (
            <option key={m.id} value={m.slug}>{m.display_name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
