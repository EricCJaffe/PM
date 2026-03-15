"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types/pm";
import { Modal, Field, Input, Textarea, ModalActions } from "./Modal";

export function SaveAsTemplateButton({ project }: { project: Project }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
  });

  function openModal() {
    // Pre-populate from project name
    const slug = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-template";
    setForm({
      name: project.name + " Template",
      slug,
      description: `Template created from project "${project.name}". Includes all phases and tasks.`,
    });
    setOpen(true);
  }

  function updateSlug(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/pm/templates/from-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          name: form.name,
          slug: form.slug,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOpen(false);
      router.push("/templates");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="px-3 py-1.5 border border-pm-border text-pm-muted hover:text-pm-text hover:bg-pm-card rounded-md text-sm font-medium transition-colors"
        title="Save this project's structure as a reusable template"
      >
        Save as Template
      </button>

      {open && (
        <Modal title="Save as Template" onClose={() => setOpen(false)}>
          <p className="text-sm text-pm-muted mb-4">
            This will save the current phases and tasks from &quot;{project.name}&quot; as a reusable project template.
          </p>
          <form onSubmit={handleSubmit}>
            <Field label="Template Name">
              <Input value={form.name} onChange={(e) => updateSlug(e.target.value)} required />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <ModalActions onClose={() => setOpen(false)} saving={saving} label="Save Template" />
          </form>
        </Modal>
      )}
    </>
  );
}
