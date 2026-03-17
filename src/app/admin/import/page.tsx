"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Org {
  id: string;
  name: string;
  slug: string;
}

export default function AsanaImportPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    project_slug?: string;
    phases_created?: number;
    tasks_created?: number;
    error?: string;
  } | null>(null);
  const [jsonPreview, setJsonPreview] = useState<string | null>(null);
  const [asanaData, setAsanaData] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/pm/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrgs(data);
          if (data.length > 0) setSelectedOrg(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setAsanaData(data);
        const name = data.name || data.data?.name || "Unknown Project";
        const taskCount = data.tasks?.length || data.sections?.reduce((sum: number, s: { tasks?: unknown[] }) => sum + (s.tasks?.length || 0), 0) || 0;
        const sectionCount = data.sections?.length || 0;
        setJsonPreview(`Project: ${name}\nSections: ${sectionCount}\nTasks: ${taskCount}`);
      } catch {
        setJsonPreview("Error: Invalid JSON file");
        setAsanaData(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!asanaData || !selectedOrg) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/pm/import/asana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: selectedOrg, asana_data: asanaData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-pm-text mb-2">Import from Asana</h1>
      <p className="text-pm-muted text-sm mb-6">
        Upload an Asana project export (JSON format) to import projects, sections as phases, and tasks with subtasks.
      </p>

      <div className="space-y-4">
        {/* Org selection */}
        <div>
          <label className="text-xs text-pm-muted block mb-1">Target Client / Organization</label>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="w-full bg-pm-card border border-pm-border rounded-lg px-3 py-2 text-sm text-pm-text focus:outline-none focus:border-blue-500"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* File upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-pm-border hover:border-pm-accent rounded-lg py-8 text-sm text-pm-muted hover:text-pm-accent transition-colors"
          >
            Click to upload Asana JSON export
          </button>
        </div>

        {/* Preview */}
        {jsonPreview && (
          <div className="card">
            <h3 className="text-sm font-medium text-pm-text mb-2">Preview</h3>
            <pre className="text-xs text-pm-muted whitespace-pre-wrap">{jsonPreview}</pre>
          </div>
        )}

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={importing || !asanaData || !selectedOrg}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {importing ? "Importing..." : "Import to BusinessOS"}
        </button>

        {/* Result */}
        {result && (
          <div className={`card ${result.success ? "border-pm-complete/30" : "border-red-500/30"} border`}>
            {result.success ? (
              <div>
                <h3 className="text-sm font-medium text-pm-complete mb-1">Import Successful</h3>
                <p className="text-xs text-pm-muted">
                  Created {result.phases_created} phases and {result.tasks_created} tasks.
                </p>
                <button
                  onClick={() => router.push(`/projects`)}
                  className="mt-3 text-sm text-pm-accent hover:underline"
                >
                  View Projects
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-1">Import Failed</h3>
                <p className="text-xs text-pm-muted">{result.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="card mt-6">
          <h3 className="text-sm font-medium text-pm-text mb-2">How to export from Asana</h3>
          <ol className="text-xs text-pm-muted space-y-1 list-decimal list-inside">
            <li>Open your Asana project</li>
            <li>Click the dropdown arrow next to the project name</li>
            <li>Select &quot;Export/Print&quot; then &quot;JSON&quot;</li>
            <li>Save the file and upload it here</li>
          </ol>
          <p className="text-xs text-pm-muted mt-3">
            The importer maps Asana sections to phases and preserves task names, descriptions, assignees, due dates, and subtasks.
          </p>
        </div>
      </div>
    </div>
  );
}
