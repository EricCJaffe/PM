"use client";

import { useState } from "react";
import { SiteAuditTab } from "@/components/SiteAuditTab";

interface Org {
  id: string;
  name: string;
  slug: string;
}

export function SiteAuditStandalone({ orgs }: { orgs: Org[] }) {
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? "");

  return (
    <div>
      {/* Org selector (only show if multiple orgs) */}
      {orgs.length > 1 && (
        <div className="mb-4">
          <label className="text-sm text-pm-muted block mb-1">Organization</label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 max-w-xs"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Audit component */}
      <div className="bg-pm-card border border-pm-border rounded-xl">
        {selectedOrgId ? (
          <SiteAuditTab key={selectedOrgId} orgId={selectedOrgId} />
        ) : (
          <div className="p-6 text-pm-muted text-sm">Select an organization to begin.</div>
        )}
      </div>
    </div>
  );
}
