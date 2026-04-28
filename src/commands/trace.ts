/**
 * Prelude — Trace command v0.2.1
 *
 * Uses OpenAI Responses API with tools: [{ type: "web_search_preview" }] to
 * observe what URLs OpenAI's web search actually opens, what citations
 * it produces, and what actions (search / open_page / find_in_page)
 * it performs.
 *
 * ─── API SHAPE (openai SDK v4.60, ResponseFunctionWebSearch) ────────────────
 *
 * Each output item of type "web_search_call" has:
 *   { id, status, type: "web_search_call" }
 *
 * With include: ["web_search_call.action.sources"] the API additionally
 * populates an `action` field with one of:
 *   { type: "search",       queries: string[],            sources?: Source[] }
 *   { type: "open_page",    url: string,                  sources?: Source[] }
 *   { type: "find_in_page", url: string, pattern: string, sources?: Source[] }
 *
 * Where Source = { url: string, title: string, snippet?: string }
 *
 * Citations live in message.content[].annotations as url_citation objects:
 *   { type: "url_citation", url: string, title: string, start_index, end_index }
 *
 * ─── HONESTY NOTE ──────────────────────────────────────────────────────────
 * This traces OpenAI's web_search_preview tool via the Responses API.
 * It approximates — but does NOT replicate — ChatGPT Search exactly.
 * ChatGPT (the product) uses additional personalisation, session context,
 * and ranking signals not available via the API.
 * Results are observable and reproducible, but may differ from a
 * logged-in ChatGPT session.
 *
 * Requires OPENAI_API_KEY.
 */

import type {
  TraceResult,
  TraceEntry,
  TraceSource,
  TraceSearchAction,
} from "../utils/types.js"
import { runAudit } from "./audit.js"

// ── Options ────────────────────────────────────────────────────────────────

export interface TraceOptions {
  /** Max results to include in the final output (default 5) */
  maxResults?: number
  /** If set, restrict search to this domain (site: prefix applied automatically) */
  domain?: string
  /**
   * After tracing, run local AEO audit on each discovered URL.
   * Adds auditScore, schemaTypes, hasFaq, auditIssues to each entry.
   * Slower — each URL requires an HTTP fetch + analysis.
   */
  audit?: boolean
  /**
   * Model to use. Defaults to "o4-mini" because reasoning models expose
   * richer open_page / find_in_page traces.
   */
  model?: string
}

// ── Internal types for raw API output ─────────────────────────────────────
//
// The openai SDK v4.60 ResponseFunctionWebSearch type only exposes
// { id, status, type }. The `action` field is injected by the API when
// include: ["web_search_call.action.sources"] is set, so we handle it
// as an untyped extension.

interface RawActionBase {
  type: string
}
interface RawSearchAction extends RawActionBase {
  type: "search"
  queries?: string[]
  sources?: RawSource[]
}
interface RawOpenPageAction extends RawActionBase {
  type: "open_page"
  url?: string
  sources?: RawSource[]
}
interface RawFindInPageAction extends RawActionBase {
  type: "find_in_page"
  url?: string
  pattern?: string
  sources?: RawSource[]
}
type RawAction = RawSearchAction | RawOpenPageAction | RawFindInPageAction

interface RawSource {
  url: string
  title?: string
  snippet?: string
}

interface TraceSourceMeta {
  refs?: string[]
  sourceTypes?: string[]
}

interface RawAnnotation {
  type: string
  url?: string
  title?: string
  /** start_index in the text where the citation is referenced */
  start_index?: number
  end_index?: number
}

interface RawContentBlock {
  type: string
  text?: string
  annotations?: RawAnnotation[]
}

interface RawOutputItem {
  type: string
  // web_search_call fields
  id?: string
  status?: string
  /** Populated when include: ["web_search_call.action.sources"] is set */
  action?: RawAction
  // message fields
  content?: RawContentBlock[]
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function runTrace(
  query: string,
  options: TraceOptions = {},
): Promise<TraceResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required for the trace command.\n" +
        "Set it with: export OPENAI_API_KEY=sk-...\n" +
        "The audit command works without an API key.",
    )
  }

  const maxResults = options.maxResults ?? 5
  const model = options.model ?? "o4-mini"

  // Apply domain restriction if provided, unless the query already contains site:
  const effectiveQuery = buildEffectiveQuery(query, options.domain)
  const domainFilter = buildDomainFilter(options.domain ?? extractSiteDomain(effectiveQuery))

  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey })

  // ── Responses API call ────────────────────────────────────────────────────
  //
  // include: ["web_search_call.action.sources"] instructs the API to populate
  // the `action` field on each web_search_call item, including sources.
  // Without this, web_search_call only exposes { id, status, type }.

  let rawOutput: RawOutputItem[]
  let isSimulated = false

  try {
    const response = await client.responses.create({
      model,
      tools: [{ type: "web_search_preview" as const }],
      // Request action.sources so the API populates action.sources per web_search_call.
      // NOTE: "web_search_call.action.sources" is a valid API include value, but the
      // SDK v4.60 ResponseIncludable enum doesn't list it yet — cast through unknown.
      include: (["web_search_call.action.sources"] as unknown) as Parameters<
        typeof client.responses.create
      >[0]["include"],
      input: buildUserPrompt(effectiveQuery, maxResults, domainFilter),
    })

    // The SDK types response.output as ResponseOutputItem[], but `action` is
    // an extension field we get via `include`. Cast through unknown.
    rawOutput = ((response as unknown) as { output?: RawOutputItem[] }).output ?? []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    // Fallback if model doesn't support Responses API or web_search_preview
    if (
      msg.includes("web_search") ||
      msg.includes("responses") ||
      msg.includes("does not support") ||
      msg.includes("include")
    ) {
      return simulateFallback(client, query, effectiveQuery, maxResults, model)
    }
    throw err
  }

  // ── Parse output ──────────────────────────────────────────────────────────

  const searchActions: TraceSearchAction[] = []
  const sources: TraceSource[] = []
  let responseText = ""
  const openedUrls = new Set<string>()
  let searchIndex = 0
  let openIndex = 0
  let findIndex = 0
  let citationIndex = 0

  for (const item of rawOutput) {
    // ── web_search_call items ─────────────────────────────────────────────
    if (item.type === "web_search_call") {
      const action = item.action

      if (action) {
        // action.type is a string: "search" | "open_page" | "find_in_page"
        const actionType = action.type

        if (actionType === "search") {
          const a = action as RawSearchAction
          const ref = `search#${searchIndex++}`
          // queries is an array of the actual search strings issued
          const queryStr = (a.queries ?? []).join("; ")
          searchActions.push({ type: "search", query: queryStr || effectiveQuery })

          // Ingest sources from the action
          for (const s of a.sources ?? []) {
            addTraceSource(sources, s, { refs: [ref], sourceTypes: ["source"] })
          }
        } else if (actionType === "open_page") {
          const a = action as RawOpenPageAction
          const url = cleanTraceUrl(a.url ?? "")
          const ref = `open#${openIndex++}`
          if (url) searchActions.push({ type: "open_page", url })
          if (url) openedUrls.add(url)
          if (url && isLikelyPageUrl(url)) {
            addTraceSource(sources, { url, title: url }, { refs: [ref], sourceTypes: ["opened"] })
          }

          // open_page can also return sources (content chunks it read)
          for (const s of a.sources ?? []) {
            addTraceSource(sources, s, { refs: [ref], sourceTypes: ["source"] })
          }
        } else if (actionType === "find_in_page") {
          const a = action as RawFindInPageAction
          const url = cleanTraceUrl(a.url ?? "")
          const ref = `find#${findIndex++}`
          if (url || a.pattern) {
            searchActions.push({ type: "find_in_page", url, pattern: a.pattern })
          }
          if (url && isLikelyPageUrl(url)) {
            addTraceSource(sources, { url, title: url }, { refs: [ref], sourceTypes: ["find"] })
          }
        }
      } else {
        // No action field — API returned only { id, status, type }.
        // Record a generic "search" action with the original query.
        searchIndex++
        searchActions.push({ type: "search", query: effectiveQuery })
      }
    }

    // ── message items (text response + annotations/citations) ─────────────
    if (item.type === "message") {
      for (const block of item.content ?? []) {
        if (block.type === "output_text") {
          responseText += block.text ?? ""

          // Inline citations (url_citation annotations)
          for (const ann of block.annotations ?? []) {
            if (ann.type === "url_citation" && ann.url) {
              const ref = `citation#${citationIndex++}`
              addTraceSource(sources, {
                url: ann.url,
                title: ann.title ?? ann.url,
                // no snippet for inline citations — they reference a position in text
              }, { refs: [ref], sourceTypes: ["citation"] })
            }
          }
        }
      }
    }
  }

  // ── Build TraceEntry list ─────────────────────────────────────────────────
  //
  // Authoritative source: all URLs collected from action.sources + annotations.
  // We do NOT promise topics here — they'd require parsing the response text
  // per-URL, which is not reliable without structured output.
  // summaries come from action.sources[].snippet when available.

  const filteredSources = domainFilter
    ? sources.filter((source) => isUrlInDomain(source.url, domainFilter))
    : sources
  const limitedSources = filteredSources.slice(0, maxResults)
  const entries: TraceEntry[] = limitedSources.map((src, i) => ({
    rank: i + 1,
    url: src.url,
    title: src.title,
    // summary = snippet from action.sources (what the model read), not fabricated
    summary: src.snippet ?? "",
    topics: [],
    pageType: inferPageType(src.url),
    opened: openedUrls.has(src.url),
    citation: src.snippet,
    refs: src.refs,
    sourceTypes: src.sourceTypes,
  }))

  // ── Optional local AEO audit on each URL ─────────────────────────────────

  if (options.audit && entries.length > 0) {
    await enrichWithAudit(entries)
  }

  return {
    query,
    model,
    timestamp: new Date().toISOString(),
    searchActions,
    sources: filteredSources,
    results: entries,
    responseText,
    isSimulated,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildUserPrompt(query: string, maxResults: number, domainFilter?: string): string {
  const domainInstruction = domainFilter
    ? `Only search, open, cite, and summarize URLs whose hostname is ${domainFilter} or one of its subdomains. Do not use lookalike domains, alternate TLDs, or unrelated brands. If fewer than ${maxResults} matching pages exist, return fewer results.\n\n`
    : ""

  return (
    `Search for: ${query}\n\n` +
    domainInstruction +
    `Open and read the top ${maxResults} results. ` +
    `For each page you open, provide a 2-3 sentence summary of the main content. ` +
    `Cite your sources inline.`
  )
}

function buildEffectiveQuery(query: string, domain?: string): string {
  if (!domain || /\bsite:/i.test(query)) return query

  const normalizedDomain = normalizeDomain(domain)

  return normalizedDomain ? `site:${normalizedDomain} ${query}` : query
}

function extractSiteDomain(query: string): string | undefined {
  const match = query.match(/\bsite:([^\s]+)/i)
  return match ? normalizeDomain(match[1]) : undefined
}

function buildDomainFilter(domain?: string): string | undefined {
  const normalized = normalizeDomain(domain)
  return normalized || undefined
}

function normalizeDomain(domain?: string): string {
  if (!domain) return ""

  return domain
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^site:/i, "")
    .replace(/^\*\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./i, "")
    .toLowerCase()
}

function addTraceSource(sources: TraceSource[], source: RawSource, meta: TraceSourceMeta = {}): void {
  const url = cleanTraceUrl(source.url)
  if (!url) return

  const existing = sources.find((x) => cleanTraceUrl(x.url) === url)
  if (existing) {
    if ((!existing.title || existing.title === existing.url) && source.title) {
      existing.title = source.title
    }
    if (!existing.snippet && source.snippet) {
      existing.snippet = source.snippet
    }
    existing.refs = appendUnique(existing.refs, meta.refs)
    existing.sourceTypes = appendUnique(existing.sourceTypes, meta.sourceTypes)
    return
  }

  sources.push({
    url,
    title: source.title ?? url,
    snippet: source.snippet,
    refs: meta.refs ? [...meta.refs] : undefined,
    sourceTypes: meta.sourceTypes ? [...meta.sourceTypes] : undefined,
  })
}

function appendUnique(target: string[] | undefined, values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return target
  const next = target ? [...target] : []
  for (const value of values) {
    if (!next.includes(value)) next.push(value)
  }
  return next
}

function cleanTraceUrl(rawUrl: string): string {
  if (!rawUrl) return ""

  try {
    const parsed = new URL(rawUrl)
    parsed.searchParams.delete("utm_source")
    const cleaned = parsed.toString()
    return cleaned.endsWith("?") ? cleaned.slice(0, -1) : cleaned
  } catch {
    return rawUrl
  }
}

function isUrlInDomain(rawUrl: string, domain: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.replace(/\.$/, "").replace(/^www\./i, "").toLowerCase()
    return host === domain || host.endsWith(`.${domain}`)
  } catch {
    return false
  }
}

function isLikelyPageUrl(rawUrl: string): boolean {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase()
    return !/\.(avif|css|gif|ico|jpe?g|js|json|map|mp3|mp4|png|svg|webm|webp|woff2?)$/.test(pathname)
  } catch {
    return true
  }
}

function inferPageType(url: string): string {
  try {
    const lower = url.toLowerCase()
    if (lower.includes("/blog/") || lower.includes("/post/") || lower.includes("/article/"))
      return "blog_post"
    if (lower.includes("/docs/") || lower.includes("/documentation/") || lower.includes("/guide/"))
      return "documentation"
    if (lower.includes("/pricing")) return "pricing_page"
    if (lower.includes("/about")) return "about_page"
    if (lower.includes("/contact")) return "contact_page"
    const path = new URL(url.startsWith("http") ? url : `https://${url}`).pathname
    if (path === "/" || path === "") return "homepage"
    return "product_page"
  } catch {
    return "other"
  }
}

async function enrichWithAudit(entries: TraceEntry[]): Promise<void> {
  // Run audits concurrently but cap at 3 parallel to avoid hammering servers
  const CONCURRENCY = 3
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (entry) => {
        try {
          const audit = await runAudit(entry.url)
          if (!entry.title || entry.title === entry.url) {
            entry.title = audit.title || entry.title
          }
          if (!entry.summary && audit.description) {
            entry.summary = audit.description
          }
          entry.auditScore = audit.score.overall
          entry.schemaTypes = audit.schema.schemaTypes
          entry.hasFaq = audit.schema.hasFaq
          entry.auditIssues = audit.issues
            .filter((x) => x.severity === "critical" || x.severity === "high")
            .slice(0, 5)
            .map((x) => ({ severity: x.severity, title: x.title }))
        } catch {
          // Audit failed for this URL — leave fields undefined
        }
      }),
    )
  }
}

// ── Fallback simulation ────────────────────────────────────────────────────
//
// Used when the Responses API web_search_preview tool is not available
// for the selected model. Clearly labelled as a simulation in the output.

async function simulateFallback(
  client: InstanceType<Awaited<typeof import("openai")>["default"]>,
  originalQuery: string,
  effectiveQuery: string,
  maxResults: number,
  model: string,
): Promise<TraceResult> {
  const domainFilter = buildDomainFilter(extractSiteDomain(effectiveQuery))
  const systemPrompt = `You are a web search analysis agent.
Your task is to simulate what a web search engine would return for the given query.
Return ONLY valid JSON with this exact structure (no markdown wrappers):
{
  "results": [
    {
      "url": "<realistic URL>",
      "title": "<page title>",
      "summary": "<2-3 sentence summary>",
      "topics": ["<topic1>", "<topic2>"],
      "pageType": "product_page|blog_post|documentation|landing_page|about_page|homepage|other"
    }
  ]
}
Include up to ${maxResults} results. Use realistic, plausible URLs for the query domain.${
    domainFilter
      ? ` Only include URLs whose hostname is ${domainFilter} or one of its subdomains. Do not include lookalike domains, alternate TLDs, or unrelated brands.`
      : ""
  }`

  const response = await client.chat.completions.create({
    model: model.includes("gpt-4o") ? "gpt-4o-mini" : model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Search for: ${effectiveQuery}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  })

  const raw = response.choices[0]?.message?.content ?? "{}"
  let parsed: { results?: Array<Record<string, unknown>> } = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    // ignore
  }

  const entries: TraceEntry[] = (parsed.results ?? [])
    .filter((r) => !domainFilter || isUrlInDomain(String(r["url"] ?? ""), domainFilter))
    .slice(0, maxResults)
    .map((r, i) => ({
      rank: i + 1,
      url: String(r["url"] ?? ""),
      title: String(r["title"] ?? ""),
      summary: String(r["summary"] ?? ""),
      topics: Array.isArray(r["topics"]) ? (r["topics"] as unknown[]).map(String) : [],
      pageType: String(r["pageType"] ?? "other"),
      opened: false,
      refs: ["simulated"],
      sourceTypes: ["source"],
    }))

  return {
    query: originalQuery,
    model: `${model} (simulated — web_search_preview not available)`,
    timestamp: new Date().toISOString(),
    searchActions: [],
    sources: [],
    results: entries,
    responseText: raw,
    isSimulated: true,
  }
}
