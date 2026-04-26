#!/usr/bin/env node

/**
 * Prelude CLI — LLM Readiness Audit + ChatGPT Search Trace
 *
 * Usage:
 *   symphony-prelude audit <url> [--format json|csv|markdown|terminal] [--output file]
 *   symphony-prelude trace <query> [options]
 *   symphony-prelude trace --query-file queries.txt [options]
 *
 * By Symphony · https://symphonyui.com
 */

import { Command } from "commander"
import ora from "ora"
import chalk from "chalk"
import { readFile } from "node:fs/promises"
import { runAudit } from "./commands/audit.js"
import { runTrace } from "./commands/trace.js"
import { formatTerminal } from "./formatters/terminal.js"
import { formatJson } from "./formatters/json.js"
import { formatCsv } from "./formatters/csv.js"
import { formatMarkdown } from "./formatters/markdown.js"
import { formatTraceTerminal } from "./formatters/trace-terminal.js"
import { formatTraceCsv } from "./formatters/trace-csv.js"
import { formatTraceMarkdown } from "./formatters/trace-markdown.js"
import { PRELUDE_FULL_NAME, PRELUDE_VERSION, CONSERVATORY_URL, PRELUDE_REPO_URL } from "./utils/constants.js"
import type { OutputFormat, TraceResult } from "./utils/types.js"

const program = new Command()

program
  .name("symphony-prelude")
  .version(PRELUDE_VERSION)
  .description(
    `${PRELUDE_FULL_NAME} — Open-source LLM Readiness Audit CLI\n${PRELUDE_REPO_URL}`,
  )

// ── Audit command ──────────────────────────────────────────────────────────

program
  .command("audit")
  .description("Audit a webpage for AI search readiness (no API key required)")
  .argument("<url>", "URL to audit")
  .option("-f, --format <format>", "Output format: terminal, json, csv, markdown", "terminal")
  .option("-o, --output <file>", "Write output to file instead of stdout")
  .action(async (url: string, opts: { format: string; output?: string }) => {
    const format = opts.format as OutputFormat

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    const spinner =
      format === "terminal"
        ? ora({ text: "Fetching and analyzing...", spinner: "dots" }).start()
        : null

    try {
      const result = await runAudit(url)
      spinner?.stop()

      let output: string
      switch (format) {
        case "json":
          output = formatJson(result)
          break
        case "csv":
          output = formatCsv(result)
          break
        case "markdown":
          output = formatMarkdown(result)
          break
        default:
          output = formatTerminal(result)
      }

      if (opts.output) {
        const { writeFile } = await import("node:fs/promises")
        await writeFile(opts.output, output, "utf-8")
        console.log(chalk.green(`✓ Report saved to ${opts.output}`))
      } else {
        console.log(output)
      }
    } catch (error) {
      spinner?.fail("Audit failed")
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"))
      process.exit(1)
    }
  })

// ── Trace command ──────────────────────────────────────────────────────────

program
  .command("trace")
  .description(
    "Trace what OpenAI web_search_preview sees for a query — approximates ChatGPT Search behaviour.\n" +
      "Requires OPENAI_API_KEY. Uses Responses API with web_search_preview tool.",
  )
  .argument("[query]", "Search query to trace (omit when using --query-file)")
  .option("-n, --max-results <n>", "Max results to capture per query", "5")
  .option("-f, --format <format>", "Output format: terminal, json, csv, markdown", "terminal")
  .option("-o, --output <file>", "Write output to file")
  .option(
    "--query-file <file>",
    "Path to a text file with one query per line (batch mode)",
  )
  .option(
    "--domain <domain>",
    "Restrict search to this domain (adds site:<domain> prefix automatically)",
  )
  .option(
    "--audit",
    "Run local AEO audit on each discovered URL (slower, no extra API cost)",
    false,
  )
  .option(
    "--model <model>",
    "OpenAI model to use (o4-mini recommended for full tracing; gpt-4o for broad source discovery)",
    "o4-mini",
  )
  .action(
    async (
      query: string | undefined,
      opts: {
        maxResults: string
        format: string
        output?: string
        queryFile?: string
        domain?: string
        audit: boolean
        model: string
      },
    ) => {
      const maxResults = parseInt(opts.maxResults, 10)
      const format = opts.format as OutputFormat

      // ── Batch mode: --query-file ─────────────────────────────────────
      if (opts.queryFile) {
        await runBatchTrace(opts.queryFile, maxResults, format, opts)
        return
      }

      // ── Single query mode ────────────────────────────────────────────
      if (!query) {
        console.error(
          chalk.red(
            "Error: provide a <query> argument or --query-file <file>",
          ),
        )
        process.exit(1)
      }

      const spinner = ora({
        text: `Tracing: "${query}"${opts.domain ? ` on ${opts.domain}` : ""}...`,
        spinner: "dots",
      }).start()

      try {
        const result = await runTrace(query, {
          maxResults,
          domain: opts.domain,
          audit: opts.audit,
          model: opts.model,
        })
        spinner.stop()

        const output = formatTraceOutput(result, format)

        if (opts.output) {
          const { writeFile } = await import("node:fs/promises")
          await writeFile(opts.output, output, "utf-8")
          console.log(chalk.green(`✓ Trace saved to ${opts.output}`))
        } else {
          console.log(output)
        }
      } catch (error) {
        spinner.fail("Trace failed")
        console.error(
          chalk.red(error instanceof Error ? error.message : "Unknown error"),
        )
        process.exit(1)
      }
    },
  )

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTraceOutput(result: TraceResult, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(result, null, 2)
    case "csv":
      return formatTraceCsv(result)
    case "markdown":
      return formatTraceMarkdown(result)
    default:
      return formatTraceTerminal(result)
  }
}

async function runBatchTrace(
  queryFile: string,
  maxResults: number,
  format: OutputFormat,
  opts: {
    output?: string
    domain?: string
    audit: boolean
    model: string
  },
): Promise<void> {
  let raw: string
  try {
    raw = await readFile(queryFile, "utf-8")
  } catch {
    console.error(chalk.red(`Cannot read query file: ${queryFile}`))
    process.exit(1)
  }

  const queries = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))

  if (queries.length === 0) {
    console.error(chalk.red("No queries found in file (empty lines and # comments are skipped)"))
    process.exit(1)
  }

  console.log(
    chalk.cyan(
      `\n  ♪ Prelude Batch Trace — ${queries.length} quer${queries.length === 1 ? "y" : "ies"}`,
    ),
  )

  const allResults: TraceResult[] = []

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]
    const spinner = ora({
      text: `[${i + 1}/${queries.length}] "${q}"`,
      spinner: "dots",
    }).start()

    try {
      const result = await runTrace(q, {
        maxResults,
        domain: opts.domain,
        audit: opts.audit,
        model: opts.model,
      })
      spinner.succeed(`[${i + 1}/${queries.length}] "${q}" — ${result.results.length} result(s)`)
      allResults.push(result)
    } catch (err) {
      spinner.fail(`[${i + 1}/${queries.length}] "${q}" — failed`)
      console.error(
        chalk.red(
          "  " + (err instanceof Error ? err.message : "Unknown error"),
        ),
      )
    }

    // Small pause between queries to avoid rate limits
    if (i < queries.length - 1) {
      await sleep(800)
    }
  }

  if (allResults.length === 0) {
    console.error(chalk.red("\nAll traces failed."))
    process.exit(1)
  }

  let output: string
  if (format === "json") {
    output = JSON.stringify(allResults, null, 2)
  } else if (format === "csv") {
    // Combine all CSVs; keep header only once
    const csvParts = allResults.map((r, i) => {
      const csv = formatTraceCsv(r)
      return i === 0 ? csv : csv.split("\n").slice(1).join("\n")
    })
    output = csvParts.join("\n")
  } else if (format === "markdown") {
    output = allResults.map((r) => formatTraceMarkdown(r)).join("\n\n---\n\n")
  } else {
    output = allResults.map((r) => formatTraceTerminal(r)).join("\n")
  }

  if (opts.output) {
    const { writeFile } = await import("node:fs/promises")
    await writeFile(opts.output, output, "utf-8")
    console.log(
      chalk.green(
        `\n✓ Batch trace saved to ${opts.output} (${allResults.length} queries)`,
      ),
    )
  } else {
    console.log(output)
  }

  // Summary
  const totalSources = allResults.reduce((s, r) => s + r.sources.length, 0)
  const totalResults = allResults.reduce((s, r) => s + r.results.length, 0)
  console.log(
    chalk.dim(
      `\n  Queries: ${allResults.length} | Total sources: ${totalSources} | Total results: ${totalResults}`,
    ),
  )
  console.log(
    chalk.dim(
      `  → Fix issues automatically with Conservatory: ${CONSERVATORY_URL}`,
    ),
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

program.parse()
