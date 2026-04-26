/**
 * Prelude — Markdown formatter (for outreach reports)
 */

import { CONSERVATORY_URL, PRELUDE_FULL_NAME, PRELUDE_VERSION } from "../utils/constants.js"
import type { AuditResult } from "../utils/types.js"

export function formatMarkdown(result: AuditResult): string {
  const lines: string[] = []
  const date = new Date(result.fetchedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  lines.push(`# LLM Readiness Audit Report`)
  lines.push("")
  lines.push(`**URL:** ${result.url}  `)
  lines.push(`**Date:** ${date}  `)
  lines.push(`**Tool:** ${PRELUDE_FULL_NAME} v${PRELUDE_VERSION}`)
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(`## Overall Score: ${result.score.overall}/100 (Grade: ${result.score.grade})`)
  lines.push("")
  lines.push("| Dimension | Score |")
  lines.push("|---|---|")
  lines.push(`| Meta & Discovery | ${result.score.meta}/100 |`)
  lines.push(`| Schema & Entity | ${result.score.schema}/100 |`)
  lines.push(`| Headings | ${result.score.headings}/100 |`)
  lines.push(`| Content Chunking | ${result.score.chunking}/100 |`)
  lines.push(`| Trust Signals | ${result.score.signals}/100 |`)
  lines.push("")

  lines.push("## Quick Stats")
  lines.push("")
  lines.push(`- **Headings:** ${result.headings.totalHeadings} (H1: ${result.headings.h1Count}) — ${result.headings.hierarchyValid ? "✓ Valid" : "✗ Broken hierarchy"}`)
  lines.push(`- **Schema types:** ${result.schema.schemaTypes.length > 0 ? result.schema.schemaTypes.join(", ") : "None detected"}`)
  lines.push(`- **Chunking quality:** ${result.chunking.quality} (${result.chunking.viableChunks} viable chunks of ${result.chunking.totalParagraphs} paragraphs)`)
  lines.push(`- **Word count:** ~${result.chunking.totalWords}`)
  lines.push(`- **Robots.txt:** ${result.robots.robotsTxtFound ? "Found" : "Not found"} | GPTBot: ${botLabel(result.robots.gptBotAllowed)} | ClaudeBot: ${botLabel(result.robots.claudeBotAllowed)}`)
  lines.push("")

  if (result.issues.length > 0) {
    lines.push(`## Issues (${result.issues.length})`)
    lines.push("")

    const sorted = [...result.issues].sort((a, b) => sevW(b.severity) - sevW(a.severity))

    for (const issue of sorted) {
      const fix = issue.fixableWith === "conservatory" ? " 🔧" : ""
      lines.push(`### [${issue.severity.toUpperCase()}] ${issue.title}${fix}`)
      lines.push("")
      lines.push(issue.description)
      lines.push("")
      lines.push(`**Suggestion:** ${issue.suggestion}`)
      lines.push("")
    }
  }

  const autoFixCount = result.issues.filter((i) => i.fixableWith === "conservatory").length
  if (autoFixCount > 0) {
    lines.push("---")
    lines.push("")
    lines.push(`> 🔧 **${autoFixCount} issue(s) can be auto-fixed** with [Conservatory](${CONSERVATORY_URL}).`)
    lines.push(`> Conservatory generates a GitHub Pull Request with the exact code changes needed.`)
    lines.push("")
  }

  return lines.join("\n")
}

function botLabel(allowed: boolean | null): string {
  if (allowed === null) return "N/A"
  return allowed ? "✓ Allowed" : "✗ Blocked"
}

function sevW(s: string): number {
  const w: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return w[s] ?? 0
}
