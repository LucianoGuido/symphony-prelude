/**
 * Prelude — Trace Markdown formatter
 *
 * Produces a shareable Markdown report of the trace result.
 * Suitable for:
 *  - Committing to a repo as a ChatGPT Search audit snapshot
 *  - Importing into Conservatory's future Markdown export
 *  - Publishing as AEO research content
 */

import type { TraceResult } from "../utils/types.js"

export function formatTraceMarkdown(result: TraceResult): string {
  const lines: string[] = []

  lines.push(`# ChatGPT Search Trace — "${result.query}"`)
  lines.push("")
  lines.push(`| Field | Value |`)
  lines.push(`|-------|-------|`)
  lines.push(`| Query | \`${result.query}\` |`)
  lines.push(`| Model | ${result.model} |`)
  lines.push(`| Timestamp | ${result.timestamp} |`)
  lines.push(
    `| Mode | ${result.isSimulated ? "⚠️ Simulation (web_search_preview unavailable)" : "✅ Real OpenAI web_search_preview (Responses API)"} |`,
  )
  lines.push("")

  if (result.isSimulated) {
    lines.push(
      "> **⚠️ Simulation Mode** — The `web_search_preview` tool was not available for the selected model.\n" +
        "> Results are model-generated estimates. Use `o4-mini` for full traces, or `gpt-4o` for broad source discovery.",
    )
    lines.push("")
  }

  // ── Search actions ────────────────────────────────────────────────────
  if (result.searchActions.length > 0) {
    lines.push("## Search Actions")
    lines.push("")
    lines.push("| # | Action | Query / URL |")
    lines.push("|---|--------|-------------|")
    result.searchActions.forEach((a, i) => {
      lines.push(
        `| ${i + 1} | \`${String(a.type ?? "search")}\` | ${escapeCell(formatActionDetail(a))} |`,
      )
    })
    lines.push("")
  }

  // ── Sources ───────────────────────────────────────────────────────────
  if (result.sources.length > 0) {
    lines.push("## Sources Consulted")
    lines.push("")
    result.sources.slice(0, 20).forEach((src, i) => {
      const snip = src.snippet ? ` — *"${src.snippet.slice(0, 80)}…"*` : ""
      lines.push(`${i + 1}. [${src.title || src.url}](${src.url})${snip}`)
    })
    if (result.sources.length > 20) {
      lines.push(`\n*…and ${result.sources.length - 20} more sources.*`)
    }
    lines.push("")
  }

  // ── Results table ─────────────────────────────────────────────────────
  lines.push("## Results")
  lines.push("")

  if (result.results.length === 0) {
    lines.push(
      "> No URL results were extracted. The model may have answered from training data.\n" +
        "> Try `--domain your-site.com` or switch to `o4-mini`.",
    )
    lines.push("")
  } else {
    const hasAudit = result.results.some((r) => r.auditScore !== undefined)

    if (hasAudit) {
      lines.push(
        "| # | URL | Title | Type | Opened | AEO Score | Schema | FAQ | Topics |",
      )
      lines.push(
        "|---|-----|-------|------|--------|-----------|--------|-----|--------|",
      )
      for (const r of result.results) {
        lines.push(formatTableRow([
          String(r.rank),
          `[${truncate(r.url, 40)}](${r.url})`,
          truncate(r.title, 40),
          r.pageType,
          r.opened ? "✅" : "—",
          r.auditScore !== undefined ? `${r.auditScore}/100` : "—",
          (r.schemaTypes ?? []).join(", ") || "—",
          r.hasFaq !== undefined ? (r.hasFaq ? "✅" : "—") : "—",
          truncate(r.topics.join(", "), 50) || "—",
        ]))
      }
    } else {
      lines.push("| # | URL | Title | Type | Opened | Topics |")
      lines.push("|---|-----|-------|------|--------|--------|")
      for (const r of result.results) {
        lines.push(formatTableRow([
          String(r.rank),
          `[${truncate(r.url, 40)}](${r.url})`,
          truncate(r.title, 40),
          r.pageType,
          r.opened ? "✅" : "—",
          truncate(r.topics.join(", "), 50) || "—",
        ]))
      }
    }
    lines.push("")

    // Per-result details
    lines.push("## Result Details")
    lines.push("")
    for (const r of result.results) {
      lines.push(
        `### #${r.rank} ${r.opened ? "*(opened)*" : ""} [${r.title || r.url}](${r.url})`,
      )
      lines.push("")
      if (r.summary) {
        lines.push(`**Summary:** ${r.summary}`)
        lines.push("")
      }
      if (r.citation && r.citation !== r.summary) {
        lines.push(`**Citation:** *"${r.citation}"*`)
        lines.push("")
      }
      if (r.auditScore !== undefined) {
        lines.push(`**AEO Score:** ${r.auditScore}/100`)
        if (r.schemaTypes && r.schemaTypes.length > 0) {
          lines.push(`**Schema:** ${r.schemaTypes.join(", ")}`)
        }
        if (r.hasFaq !== undefined) {
          lines.push(`**FAQ Schema:** ${r.hasFaq ? "Yes" : "No"}`)
        }
        if (r.auditIssues && r.auditIssues.length > 0) {
          lines.push("")
          lines.push("**Top Issues:**")
          for (const issue of r.auditIssues) {
            lines.push(`- \`${issue.severity.toUpperCase()}\` ${issue.title}`)
          }
        }
        lines.push("")
      }
    }
  }

  // ── Disclaimer ────────────────────────────────────────────────────────
  lines.push("---")
  lines.push("")
  lines.push(
    "> **Note:** This trace uses the OpenAI Responses API with the `web_search_preview` tool. " +
      "It approximates — but does not replicate — ChatGPT Search exactly. " +
      "The ChatGPT product may use additional personalisation, session context, " +
      "and ranking signals not available via the API.",
  )
  lines.push("")
  lines.push(
    "*Generated by [Prelude](https://github.com/LucianoGuido/symphony-prelude) — " +
      "Open-source AEO CLI by [Symphony](https://symphonyui.com). " +
      "Fix issues automatically with [Conservatory](https://conservatory.app).*",
  )

  return lines.join("\n")
}

function formatActionDetail(action: TraceResult["searchActions"][number]): string {
  if (action.type === "find_in_page") {
    const pattern = action.pattern ?? action.query ?? ""
    if (action.url && pattern) return `${action.url} (find: ${pattern})`
    return pattern ? `find: ${pattern}` : action.url ?? "—"
  }

  return action.query ?? action.url ?? "—"
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|")
}

function formatTableRow(cells: string[]): string {
  return `| ${cells.map(escapeCell).join(" | ")} |`
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}
