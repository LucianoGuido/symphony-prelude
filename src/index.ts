/**
 * Prelude — Public API
 *
 * Exports the core audit and trace functions for programmatic usage.
 */

export { runAudit } from "./commands/audit.js"
export { runTrace } from "./commands/trace.js"
export { computeAeoScore } from "./scoring/aeo-score.js"
export { fetchPage } from "./analyzers/fetcher.js"
export { analyzeHeadings } from "./analyzers/headings.js"
export { analyzeMeta } from "./analyzers/meta.js"
export { analyzeSchema } from "./analyzers/schema.js"
export { analyzeChunking } from "./analyzers/chunking.js"
export { analyzeSignals } from "./analyzers/signals.js"
export { analyzeRobots } from "./analyzers/robots.js"
export { formatTerminal } from "./formatters/terminal.js"
export { formatJson } from "./formatters/json.js"
export { formatCsv } from "./formatters/csv.js"
export { formatMarkdown } from "./formatters/markdown.js"

export type {
  AuditResult,
  AeoScore,
  AuditIssue,
  FetchedPage,
  TraceResult,
  TraceEntry,
  OutputFormat,
} from "./utils/types.js"
