"use client";

import { useState } from "react";
import { SiteAuditTab } from "@/components/SiteAuditTab";

interface Org {
  id: string;
  name: string;
  slug: string;
}

const PROSPECT_VALUE = "__prospect__";

export function SiteAuditStandalone({ orgs }: { orgs: Org[] }) {
  const [selectedValue, setSelectedValue] = useState(orgs[0]?.id ?? PROSPECT_VALUE);
  const [prospectName, setProspectName] = useState("");

  const isProspect = selectedValue === PROSPECT_VALUE;
  const selectedOrgId = isProspect ? null : selectedValue;

  // Can proceed if: org selected, OR prospect with a name entered
  const canProceed = !isProspect || prospectName.trim().length > 0;

  return (
    <div>
      {/* Org / Prospect selector — always show so user can switch to prospect mode */}
      <div className="mb-4 flex items-end gap-4">
        <div>
          <label className="text-sm text-pm-muted block mb-1">Client</label>
          <select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 max-w-xs"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            <option value={PROSPECT_VALUE}>Prospect (non-client)</option>
          </select>
        </div>

        {isProspect && (
          <div>
            <label className="text-sm text-pm-muted block mb-1">Prospect name</label>
            <input
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="bg-pm-bg border border-pm-border rounded-lg px-3 py-2 text-pm-text text-sm focus:outline-none focus:border-blue-500 w-64"
            />
          </div>
        )}
      </div>

      {/* Audit component */}
      <div className="bg-pm-card border border-pm-border rounded-xl">
        {canProceed ? (
          <SiteAuditTab
            key={isProspect ? `prospect-${prospectName}` : selectedOrgId!}
            orgId={selectedOrgId}
            prospectName={isProspect ? prospectName.trim() : null}
          />
        ) : (
          <div className="p-6 text-pm-muted text-sm">
            Enter a prospect name to begin.
          </div>
        )}
      </div>
    </div>
  );
}
