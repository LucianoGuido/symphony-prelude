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
import { PRELUDE_FULL_NAME, CONSERVATORY_URL } from "../utils/constants.js"

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

  // ── Results ────────────────────────────────────────────────────────────
  if (result.results.length > 0) {
    lines.push("")
    lines.push(chalk.bold(`  Top Results (${result.results.length})`))
    lines.push(chalk.dim("  " + "─".repeat(48)))

    for (const r of result.results) {
      const openedBadge = r.opened ? chalk.green(" [OPENED]") : ""
      lines.push("")
      lines.push(
        `  ${chalk.bold(`#${r.rank}`)}${openedBadge} ${chalk.cyan(r.url)}`,
      )
      if (r.title) lines.push(`     ${chalk.bold(r.title)}`)
      lines.push(
        chalk.dim(`     Type: ${r.pageType}`) +
          (r.topics.length > 0
            ? chalk.dim(` | Topics: ${r.topics.join(", ")}`)
            : ""),
      )
      if (r.summary) {
        lines.push(chalk.dim(`     ${truncate(r.summary, 160)}`))
      }
      if (r.citation && r.citation !== r.summary) {
        lines.push(chalk.dim(`     Citation: "${truncate(r.citation, 120)}"`))
      }

      // AEO audit enrichment
      if (r.auditScore !== undefined) {
        const scoreColor =
          r.auditScore >= 75
            ? chalk.green
            : r.auditScore >= 50
              ? chalk.yellow
              : chalk.red
        lines.push(
          `     AEO Score: ${scoreColor(`${r.auditScore}/100`)}` +
            (r.schemaTypes && r.schemaTypes.length > 0
              ? chalk.dim(` | Schema: ${r.schemaTypes.join(", ")}`)
              : "") +
            (r.hasFaq ? chalk.dim(" | FAQ ✓") : ""),
        )
        if (r.auditIssues && r.auditIssues.length > 0) {
          for (const issue of r.auditIssues) {
            const c = issue.severity === "critical" ? chalk.red : chalk.yellow
            lines.push(c(`     [${issue.severity.toUpperCase()}] ${issue.title}`))
          }
        }
      }
    }
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
  lines.push(
    chalk.dim(
      `  → Run ${chalk.cyan("symphony-prelude audit <url>")} on any result to check its AEO readiness.`,
    ),
  )
  lines.push(
    chalk.dim(
      `  → Fix issues automatically with Conservatory: ${CONSERVATORY_URL}`,
    ),
  )
  lines.push("")

  return lines.join("\n")
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

function formatActionDetail(action: TraceResult["searchActions"][number]): string {
  if (action.type === "find_in_page") {
    const pattern = action.pattern ?? action.query ?? ""
    if (action.url && pattern) return `${action.url} (find: ${pattern})`
    return pattern ? `find: ${pattern}` : action.url ?? ""
  }

  return action.query ?? action.url ?? ""
}
