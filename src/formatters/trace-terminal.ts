/**
 * Prelude — Trace terminal formatter
 *
 * Rich colored output for the trace command showing:
 * - Search actions performed (search, open_page, find_in_page)
 * - Sources/citations consulted
 * - Per-entry AEO audit enrichment (when available)
 */

import chalk from "chalk"
import type { TraceResult } from "../utils/types.js"
import { PRELUDE_FULL_NAME, CONSERVATORY_REPORT_CTA } from "../utils/constants.js"
import { deriveTraceInsights, deriveTraceTopUrlRows } from "./trace-report.js"

export function formatTraceTerminal(result: TraceResult): string {
  const lines: string[] = []

  lines.push("")
  lines.push(chalk.bold.cyan(`  ♪ ${PRELUDE_FULL_NAME} — ChatGPT Search Trace`))
  lines.push(chalk.dim(`  Query    : "${result.query}"`))
  lines.push(chalk.dim(`  Model    : ${result.model}`))
  lines.push(chalk.dim(`  Timestamp: ${result.timestamp}`))

  if (result.isSimulated) {
    lines.push("")
    lines.push(
      chalk.yellow(
        "  ⚠  SIMULATION MODE — web_search_preview tool not available for this model.\n" +
          "     Results are model-generated estimates, not real web search data.\n" +
          "     Use o4-mini for full traces, or gpt-4o for broad source discovery.",
      ),
    )
  }

  // ── Search actions ─────────────────────────────────────────────────────
  if (result.searchActions.length > 0) {
    lines.push("")
    lines.push(chalk.bold("  Search Actions"))
    lines.push(chalk.dim("  " + "─".repeat(48)))
    for (const action of result.searchActions) {
      const actionType = String(action.type ?? "search")
      const icon =
        actionType === "search"
          ? "🔍"
          : actionType === "open_page"
            ? "📄"
            : actionType === "find_in_page"
              ? "🔎"
              : "⚙️"
      const detail = formatActionDetail(action)
      lines.push(`  ${icon} ${chalk.dim(actionType.padEnd(14))} ${chalk.white(detail)}`)
    }
  }

  // ── Sources consulted ──────────────────────────────────────────────────
  if (result.sources.length > 0) {
    lines.push("")
    lines.push(chalk.bold(`  Sources Consulted (${result.sources.length})`))
    lines.push(chalk.dim("  " + "─".repeat(48)))
    result.sources.slice(0, 10).forEach((src, i) => {
      lines.push(`  ${chalk.dim(`${i + 1}.`)} ${chalk.cyan(src.url)}`)
      if (src.title && src.title !== src.url) {
        lines.push(`     ${chalk.white(src.title)}`)
      }
      if (src.snippet) {
        lines.push(chalk.dim(`     "${truncate(src.snippet, 100)}"`))
      }
    })
    if (result.sources.length > 10) {
      lines.push(chalk.dim(`  … and ${result.sources.length - 10} more`))
    }
  }

  // ── Top URLs ───────────────────────────────────────────────────────────
  if (result.results.length > 0) {
    const rows = deriveTraceTopUrlRows(result)
    lines.push("")
    lines.push(chalk.bold(`  Top URLs (${rows.length})`))
    lines.push(chalk.dim("  " + "─".repeat(48)))
    lines.push(
      "  " +
        [
          chalk.bold("Rank".padEnd(4)),
          chalk.bold("URL".padEnd(34)),
          chalk.bold("Title".padEnd(30)),
          chalk.bold("Snippet".padEnd(38)),
          chalk.bold("Type".padEnd(18)),
          chalk.bold("Ref".padEnd(24)),
        ].join("  "),
    )
    lines.push(chalk.dim("  " + "─".repeat(158)))

    for (const row of rows) {
      lines.push(
        "  " +
          [
            `#${row.rank}`.padEnd(4),
            chalk.cyan(fit(row.url, 34)),
            fit(row.title, 30),
            chalk.dim(fit(row.snippet || "no snippet", 38)),
            fit(row.type, 18),
            chalk.green(fit(row.ref, 24)),
          ].join("  "),
      )
    }

    const audited = result.results.filter((r) => r.auditScore !== undefined)
    if (audited.length > 0) {
      lines.push("")
      lines.push(chalk.bold("  Audit Details"))
      for (const r of audited) {
        if (r.auditScore !== undefined) {
          const scoreColor =
            r.auditScore >= 75
              ? chalk.green
              : r.auditScore >= 50
                ? chalk.yellow
                : chalk.red
          lines.push(
            `    #${r.rank} ${scoreColor(`${r.auditScore}/100`)}` +
              (r.schemaTypes && r.schemaTypes.length > 0
                ? chalk.dim(` | Schema: ${r.schemaTypes.join(", ")}`)
                : "") +
              (r.hasFaq ? chalk.dim(" | FAQ ✓") : ""),
          )
          if (r.auditIssues && r.auditIssues.length > 0) {
            for (const issue of r.auditIssues) {
              const c = issue.severity === "critical" ? chalk.red : chalk.yellow
              lines.push(c(`       [${issue.severity.toUpperCase()}] ${issue.title}`))
            }
          }
        }
      }
    }

    lines.push("")
    lines.push(chalk.bold("  Trace Insights"))
    lines.push(chalk.dim("  " + "─".repeat(48)))
    const insights = deriveTraceInsights(result)
    appendInsightGroup(lines, "Good signals", insights.goodSignals, chalk.green)
    appendInsightGroup(lines, "Warnings", insights.warnings, chalk.yellow)
    appendInsightGroup(lines, "Opportunities", insights.opportunities, chalk.cyan)
  } else if (!result.isSimulated) {
    lines.push("")
    lines.push(
      chalk.dim(
        "  No URL results were extracted from this trace.\n" +
          "  The model may have answered from training data without opening pages.\n" +
          "  Try adding a site: prefix (e.g. --domain your-site.com) or use o4-mini.",
      ),
    )
  }

  // ── CTA ───────────────────────────────────────────────────────────────
  lines.push("")
  const [ctaQuestion, ctaAction] = CONSERVATORY_REPORT_CTA.split("\n")
  lines.push(chalk.dim(`  → ${ctaQuestion}`))
  lines.push(chalk.dim(`    ${ctaAction}`))
  lines.push("")

  return lines.join("\n")
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

function fit(s: string, width: number): string {
  const value = truncate(s.replace(/\s+/g, " ").trim(), width)
  return value.padEnd(width)
}

function appendInsightGroup(
  lines: string[],
  label: string,
  items: string[],
  color: (value: string) => string,
): void {
  if (items.length === 0) return
  lines.push(`  ${color(label + ":")}`)
  for (const item of items) {
    lines.push(chalk.dim(`    - ${item}`))
  }
}

function formatActionDetail(action: TraceResult["searchActions"][number]): string {
  if (action.type === "find_in_page") {
    const pattern = action.pattern ?? action.query ?? ""
    if (action.url && pattern) return `${action.url} (find: ${pattern})`
    return pattern ? `find: ${pattern}` : action.url ?? ""
  }

  return action.query ?? action.url ?? ""
}
