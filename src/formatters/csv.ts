/**
 * Prelude — CSV formatter
 */

import type { AuditResult } from "../utils/types.js"

export function formatCsv(result: AuditResult): string {
  const header = "id,severity,category,title,description,suggestion,fixable_with"
  const rows = result.issues.map((i) =>
    [i.id, i.severity, i.category, esc(i.title), esc(i.description), esc(i.suggestion), i.fixableWith].join(","),
  )
  return [header, ...rows].join("\n")
}

function esc(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
