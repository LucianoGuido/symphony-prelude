/**
 * Prelude — Terminal formatter (colored output)
 */

import chalk from "chalk"
import { CTA_MESSAGE, PRELUDE_FULL_NAME, PRELUDE_VERSION } from "../utils/constants.js"
import type { AuditResult } from "../utils/types.js"

const SEVERITY_COLORS = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red.bold,
  medium: chalk.yellow,
  low: chalk.dim,
} as const

const QUALITY_COLORS = {
  excellent: chalk.green.bold,
  good: chalk.green,
  fair: chalk.yellow,
  poor: chalk.red.bold,
} as const

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width)
  const empty = width - filled
  const color = score >= 75 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty)) + ` ${score}/100`
}

export function formatTerminal(result: AuditResult): string {
  const lines: string[] = []

  lines.push("")
  lines.push(chalk.bold.cyan(`  ♪ ${PRELUDE_FULL_NAME} v${PRELUDE_VERSION}`))
  lines.push(chalk.dim(`  LLM Readiness Audit`))
  lines.push("")
  lines.push(chalk.dim("  ─────────────────────────────────────────"))
  lines.push(`  ${chalk.bold("URL:")}   ${result.url}`)
  lines.push(`  ${chalk.bold("Date:")}  ${new Date(result.fetchedAt).toLocaleString()}`)
  lines.push("")

  // Score
  const gradeColor = result.score.overall >= 75 ? chalk.green.bold : result.score.overall >= 50 ? chalk.yellow.bold : chalk.red.bold
  lines.push(`  ${chalk.bold("LLM Readiness Score:")} ${gradeColor(`${result.score.overall}/100`)} ${chalk.dim(`(Grade: ${result.score.grade})`)}`)
  lines.push("")

  // Dimension scores
  lines.push(chalk.bold("  Score Breakdown:"))
  lines.push(`    Meta & Discovery  ${bar(result.score.meta)}`)
  lines.push(`    Schema & Entity   ${bar(result.score.schema)}`)
  lines.push(`    Headings          ${bar(result.score.headings)}`)
  lines.push(`    Content Chunking  ${bar(result.score.chunking)}`)
  lines.push(`    Trust Signals     ${bar(result.score.signals)}`)
  lines.push("")

  // Quick stats
  lines.push(chalk.bold("  Quick Stats:"))
  lines.push(`    Headings: ${result.headings.totalHeadings} (H1: ${result.headings.h1Count}) ${result.headings.hierarchyValid ? chalk.green("✓ valid") : chalk.red("✗ broken")}`)
  lines.push(`    Schema types: ${result.schema.schemaTypes.length > 0 ? result.schema.schemaTypes.join(", ") : chalk.dim("none")}`)
  lines.push(`    Chunking quality: ${QUALITY_COLORS[result.chunking.quality](result.chunking.quality)} (${result.chunking.viableChunks} viable of ${result.chunking.totalParagraphs} paragraphs)`)
  lines.push(`    Words: ~${result.chunking.totalWords}`)
  lines.push(`    Robots.txt: ${result.robots.robotsTxtFound ? chalk.green("found") : chalk.dim("not found")} | GPTBot: ${formatBotStatus(result.robots.gptBotAllowed)} | ClaudeBot: ${formatBotStatus(result.robots.claudeBotAllowed)}`)
  lines.push("")

  // Issues
  if (result.issues.length > 0) {
    lines.push(chalk.bold(`  Issues Found: ${result.issues.length}`))
    lines.push("")

    const sorted = [...result.issues].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))

    for (const issue of sorted) {
      const sev = SEVERITY_COLORS[issue.severity](`[${issue.severity.toUpperCase()}]`)
      const fix = issue.fixableWith === "conservatory" ? chalk.cyan(" [auto-fixable]") : ""
      lines.push(`    ${sev} ${issue.title}${fix}`)
      lines.push(chalk.dim(`         ${issue.description}`))
      lines.push(chalk.dim(`         → ${issue.suggestion}`))
      lines.push("")
    }
  } else {
    lines.push(chalk.green.bold("  ✓ No issues found — your page is well-structured for AI search."))
    lines.push("")
  }

  // CTA
  const autoFixable = result.issues.filter((i) => i.fixableWith === "conservatory").length
  if (autoFixable > 0) {
    lines.push(chalk.dim("  ─────────────────────────────────────────"))
    lines.push(chalk.cyan.bold(`  ${autoFixable} issue(s) can be auto-fixed with Conservatory.`))
    lines.push(CTA_MESSAGE)
  }

  return lines.join("\n")
}

function formatBotStatus(allowed: boolean | null): string {
  if (allowed === null) return chalk.dim("n/a")
  return allowed ? chalk.green("allowed") : chalk.red("blocked")
}

function severityWeight(s: string): number {
  const w: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return w[s] ?? 0
}
