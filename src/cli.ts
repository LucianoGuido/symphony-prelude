#!/usr/bin/env node

/**
 * Prelude CLI — LLM Readiness Audit + ChatGPT Search Trace
 *
 * Usage:
 *   symphony-prelude audit <url>
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
import { formatTraceTerminal } from "./formatters/trace-terminal.js"
import { CONSERVATORY_REPORT_CTA, PRELUDE_FULL_NAME, PRELUDE_VERSION, PRELUDE_REPO_URL } from "./utils/constants.js"
import type { TraceResult } from "./utils/types.js"

const program = new Command()

program
  .name("symphony-prelude")
  .version(PRELUDE_VERSION)
  .description(
    `${PRELUDE_FULL_NAME} — Terminal-first LLM Readiness Diagnostic CLI\n${PRELUDE_REPO_URL}`,
  )

// ── Audit command ──────────────────────────────────────────────────────────

program
  .command("audit")
  .description("Audit a webpage for AI search readiness in your terminal (no API key required)")
  .argument("<url>", "URL to audit")
  .action(async (url: string) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    const spinner = ora({ text: "Fetching and analyzing...", spinner: "dots" }).start()

    try {
      const result = await runAudit(url)
      spinner.stop()
      console.log(formatTerminal(result))
    } catch (error) {
      spinner.fail("Audit failed")
      console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"))
      process.exit(1)
    }
  })

// ── Trace command ──────────────────────────────────────────────────────────

program
  .command("trace")
  .description(
    "Trace what OpenAI web_search_preview sees for a query in your terminal — approximates ChatGPT Search behaviour.\n" +
      "Requires OPENAI_API_KEY. Uses Responses API with web_search_preview tool.",
  )
  .argument("[query]", "Search query to trace (omit when using --query-file)")
  .option("-n, --max-results <n>", "Max results to capture per query", "5")
  .option(
    "--query-file <file>",
    "Path to a text file with one query per line (batch mode)",
  )
  .option(
    "--domain <domain>",
    "Restrict search to this domain and filter results to matching subdomains",
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
        queryFile?: string
        domain?: string
        audit: boolean
        model: string
      },
    ) => {
      const maxResults = parseInt(opts.maxResults, 10)

      // ── Batch mode: --query-file ─────────────────────────────────────
      if (opts.queryFile) {
        await runBatchTrace(opts.queryFile, maxResults, opts)
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
        text: `Tracing OpenAI web search for "${query}"${opts.domain ? ` on ${opts.domain}` : ""}... this can take a few seconds`,
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

        console.log(formatTraceTerminal(result))
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

async function runBatchTrace(
  queryFile: string,
  maxResults: number,
  opts: {
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
      text: `[${i + 1}/${queries.length}] Tracing OpenAI web search for "${q}"${opts.domain ? ` on ${opts.domain}` : ""}... this can take a few seconds`,
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

  console.log(allResults.map((r) => formatTraceTerminal(r)).join("\n"))

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
      `  → ${CONSERVATORY_REPORT_CTA.replace("\n", "\n    ")}`,
    ),
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

program.parse()
