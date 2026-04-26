/**
 * Prelude — Audit command
 *
 * Orchestrates all analyzers, computes the AEO score,
 * and returns the full audit result.
 */

import { fetchPage } from "../analyzers/fetcher.js"
import { analyzeHeadings, resetHeadingCounter } from "../analyzers/headings.js"
import { analyzeMeta, resetMetaCounter } from "../analyzers/meta.js"
import { analyzeSchema, resetSchemaCounter } from "../analyzers/schema.js"
import { analyzeChunking, resetChunkingCounter } from "../analyzers/chunking.js"
import { analyzeSignals, resetSignalsCounter } from "../analyzers/signals.js"
import { analyzeRobots, resetRobotsCounter } from "../analyzers/robots.js"
import { computeAeoScore } from "../scoring/aeo-score.js"
import { CTA_URL_TEMPLATE } from "../utils/constants.js"
import type { AuditResult } from "../utils/types.js"

export async function runAudit(url: string): Promise<AuditResult> {
  // Reset counters for fresh issue IDs
  resetHeadingCounter()
  resetMetaCounter()
  resetSchemaCounter()
  resetChunkingCounter()
  resetSignalsCounter()
  resetRobotsCounter()

  // Fetch and parse the page
  const page = await fetchPage(url)

  // Run all analyzers
  const headings = analyzeHeadings(page.headings)
  const meta = analyzeMeta(page)
  const schema = analyzeSchema(page.html)
  const chunking = analyzeChunking(page.html)
  const signals = analyzeSignals(page)
  const robots = await analyzeRobots(url)

  // Compute composite score
  const score = computeAeoScore({ headings, meta, schema, chunking, signals })

  // Collect all issues
  const issues = [
    ...headings.issues,
    ...meta.issues,
    ...schema.issues,
    ...chunking.issues,
    ...signals.issues,
    ...robots.issues,
  ]

  return {
    url: page.url,
    title: page.title,
    description: page.description,
    fetchedAt: page.fetchedAt,
    score,
    headings,
    meta,
    schema,
    chunking,
    signals,
    robots,
    issues,
    cta: CTA_URL_TEMPLATE(page.url),
  }
}
