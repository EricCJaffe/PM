/**
 * Rubric loader utility for site audits.
 * Loads vertical-specific scoring rubrics from docs/SEO/ at runtime.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { AuditVertical } from "@/types/pm";

const RUBRIC_FILES: Record<string, string> = {
  church: "SCORING_RUBRIC_CHURCH.md",
  agency: "SCORING_RUBRIC_AGENCY.md",
  nonprofit: "SCORING_RUBRIC_NONPROFIT.md",
};

/**
 * Load the scoring rubric markdown for a given vertical.
 * Returns empty string for "general" (no vertical-specific rubric).
 */
export function loadRubric(vertical: AuditVertical): string {
  const filename = RUBRIC_FILES[vertical];
  if (!filename) return "";

  try {
    const rubricPath = join(process.cwd(), "docs", "SEO", filename);
    return readFileSync(rubricPath, "utf-8");
  } catch {
    console.warn(`Could not load rubric file for vertical: ${vertical}`);
    return `Score across: SEO (20%), Entity Authority (15%), AI Discoverability (20%), Conversion (20%), Content (15%), A2A (10%). Grade: A=90+, B=80-89, C=70-79, D=60-69, F<60.`;
  }
}

/**
 * Load the audit PDF design spec, used for report generation.
 */
export function loadAuditSpec(): string {
  try {
    const specPath = join(process.cwd(), "docs", "SEO", "AUDIT_PDF_SPEC.md");
    return readFileSync(specPath, "utf-8");
  } catch {
    return "";
  }
}
