/**
 * Prelude — Trace CSV formatter
 *
 * Produces a flat CSV crossable with Conservatory exports,
 * Google Search Console data, and Ahrefs/SEMrush exports.
 *
 * Columns:
 *   query, rank, url, title, page_type, opened, topics,
 *   summary, citation, audit_score, schema_types, has_faq,
 *   top_issues, model, timestamp, is_simulated
 */

import type { TraceResult } from "../utils/types.js"

export function formatTraceCsv(result: TraceResult): string {
  const header = [
    "query",
    "rank",
    "url",
    "title",
    "page_type",
    "opened",
    "topics",
    "summary",
    "citation",
    "audit_score",
    "schema_types",
    "has_faq",
    "top_issues",
    "model",
    "timestamp",
    "is_simulated",
  ].join(",")

  if (result.results.length === 0) {
    return header
  }

  const rows = result.results.map((r) =>
    [
      esc(result.query),
      r.rank,
      esc(r.url),
      esc(r.title),
      esc(r.pageType),
      r.opened ? "true" : "false",
      esc(r.topics.join("; ")),
      esc(r.summary),
      esc(r.citation ?? ""),
      r.auditScore ?? "",
      esc((r.schemaTypes ?? []).join("; ")),
      r.hasFaq !== undefined ? String(r.hasFaq) : "",
      esc(
        (r.auditIssues ?? [])
          .map((x) => `[${x.severity}] ${x.title}`)
          .join("; "),
      ),
      esc(result.model),
      esc(result.timestamp),
      result.isSimulated ? "true" : "false",
    ].join(","),
  )

  return [header, ...rows].join("\n")
}

function esc(v: string | number): string {
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
