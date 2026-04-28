import type { TraceResult } from "../utils/types.js"

export interface TraceTopUrlRow {
  rank: number
  url: string
  title: string
  snippet: string
  type: string
  ref: string
}

export interface TraceInsights {
  goodSignals: string[]
  warnings: string[]
  opportunities: string[]
}

const SOURCE_TYPE_ORDER = ["opened", "citation", "source", "find"]
const SOURCE_TYPE_LABELS: Record<string, string> = {
  opened: "open",
  citation: "cited",
  source: "src",
  find: "find",
}

export function deriveTraceTopUrlRows(result: TraceResult): TraceTopUrlRow[] {
  return result.results.map((entry) => {
    const sourceTypes = entry.sourceTypes ?? []
    const inferredTypes = entry.opened ? ["opened"] : []
    const types = unique([...sourceTypes, ...inferredTypes])
      .sort((a, b) => sourceTypeWeight(a) - sourceTypeWeight(b))

    return {
      rank: entry.rank,
      url: entry.url,
      title: entry.title || entry.url,
      snippet: entry.summary || entry.citation || "",
      type: types.length > 0 ? types.map((type) => SOURCE_TYPE_LABELS[type] ?? type).join("+") : entry.pageType || "src",
      ref: formatRefs(entry.refs ?? []),
    }
  })
}

export function deriveTraceInsights(result: TraceResult): TraceInsights {
  const rows = deriveTraceTopUrlRows(result)
  const openedCount = result.results.filter((entry) => entry.opened || entry.sourceTypes?.includes("opened")).length
  const citedCount = result.results.filter((entry) => entry.sourceTypes?.includes("citation")).length
  const rowsWithSnippets = rows.filter((row) => row.snippet.trim().length > 0)
  const internalRows = rows.filter((row) => !isHomepage(row.url))
  const assetActions = result.searchActions.filter((action) => action.url && isAssetUrl(action.url))
  const duplicateGroups = findCanonicalDuplicateGroups(rows.map((row) => row.url))
  const legalRows = rows.filter((row) => isLegalUrl(row.url))
  const homepageRows = rows.filter((row) => isHomepage(row.url))

  const goodSignals: string[] = []
  const warnings: string[] = []
  const opportunities: string[] = []

  if (openedCount > 0) {
    goodSignals.push(`OpenAI web search opened ${openedCount} page${plural(openedCount)} from the target set.`)
  }
  if (internalRows.length > 0) {
    goodSignals.push(`${internalRows.length} internal URL${plural(internalRows.length)} surfaced beyond the homepage.`)
  }
  if (citedCount > 0 || rowsWithSnippets.length > 0) {
    const count = Math.max(citedCount, rowsWithSnippets.length)
    goodSignals.push(`${count} URL${plural(count)} included citation or snippet context.`)
  }

  if (duplicateGroups.length > 0) {
    warnings.push(`Duplicate canonical variants detected: ${duplicateGroups[0].join(" and ")}.`)
  }
  if (rows.length > 0 && rowsWithSnippets.length === 0) {
    warnings.push("No snippets were returned for the top URLs; the trace can show discovery, but not extracted content depth.")
  }
  if (legalRows.length > 0) {
    warnings.push(`Legal or policy pages appeared in Top URLs: ${legalRows.map((row) => row.url).join(", ")}.`)
  }
  if (assetActions.length > 0) {
    warnings.push(`${assetActions.length} asset URL${plural(assetActions.length)} opened during the trace and excluded from Top URLs.`)
  }

  if (rows.length === 0) {
    opportunities.push("Create or strengthen crawlable pages that directly answer this query.")
  } else if (homepageRows.length > 0 && internalRows.length === 0) {
    opportunities.push("Create or strengthen a dedicated landing page so the query does not resolve only to the homepage.")
  }
  if (rowsWithSnippets.length < rows.length) {
    opportunities.push("Add clearer extractable summaries, headings, and metadata to improve what AI search can quote.")
  }
  if (duplicateGroups.length > 0) {
    opportunities.push("Consolidate www/non-www and canonical URL variants to reduce duplicate discovery.")
  }

  return {
    goodSignals: goodSignals.length > 0 ? goodSignals : ["The trace completed and produced observable search actions."],
    warnings,
    opportunities,
  }
}

function sourceTypeWeight(value: string): number {
  const index = SOURCE_TYPE_ORDER.indexOf(value)
  return index === -1 ? SOURCE_TYPE_ORDER.length : index
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function formatRefs(refs: string[]): string {
  if (refs.length === 0) return "—"
  if (refs.length <= 2) return refs.join(", ")
  return `${refs.slice(0, 2).join(", ")} +${refs.length - 2}`
}

function plural(count: number): string {
  return count === 1 ? "" : "s"
}

function isHomepage(rawUrl: string): boolean {
  try {
    const path = new URL(rawUrl).pathname
    return path === "" || path === "/"
  } catch {
    return false
  }
}

function isAssetUrl(rawUrl: string): boolean {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase()
    return /\.(avif|css|gif|ico|jpe?g|js|json|map|mp3|mp4|png|svg|webm|webp|woff2?)$/.test(pathname)
  } catch {
    return false
  }
}

function isLegalUrl(rawUrl: string): boolean {
  try {
    const path = new URL(rawUrl).pathname.toLowerCase()
    return /terms|privacy|policy|legal|cookie/.test(path)
  } catch {
    return false
  }
}

function findCanonicalDuplicateGroups(urls: string[]): string[][] {
  const groups = new Map<string, string[]>()

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl)
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase()
      const path = parsed.pathname.replace(/\/$/, "") || "/"
      const key = `${host}${path}${parsed.search}`
      const group = groups.get(key) ?? []
      group.push(rawUrl)
      groups.set(key, group)
    } catch {
      // Ignore malformed URLs in duplicate analysis.
    }
  }

  return [...groups.values()].filter((group) => new Set(group).size > 1)
}
