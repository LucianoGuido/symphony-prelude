/**
 * Prelude — Shared type definitions
 *
 * All types are original to Prelude. No types are imported from or
 * derived from the Conservatory private codebase.
 */

// ── Fetcher ─────────────────────────────────────────

export interface FetchedPage {
  url: string
  statusCode: number
  html: string
  title: string
  description: string | null
  lang: string | null
  charset: boolean
  viewport: boolean
  canonical: string | null
  headings: HeadingNode[]
  images: ImageNode[]
  links: LinkNode[]
  metaTags: Record<string, string>
  fetchedAt: string
}

export interface HeadingNode {
  level: number
  text: string
  id: string | null
}

export interface ImageNode {
  src: string
  alt: string | null
  hasAlt: boolean
  width: string | null
  height: string | null
}

export interface LinkNode {
  href: string
  text: string
  isExternal: boolean
  rel: string | null
}

// ── Analyzers ───────────────────────────────────────

export interface AuditIssue {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  category: "headings" | "meta" | "schema" | "chunking" | "signals" | "robots" | "structure"
  title: string
  description: string
  suggestion: string
  fixableWith: "conservatory" | "manual"
}

export interface HeadingsReport {
  h1Count: number
  totalHeadings: number
  hierarchyValid: boolean
  skippedLevels: number[]
  issues: AuditIssue[]
}

export interface MetaReport {
  titleLength: number
  descriptionLength: number
  hasCanonical: boolean
  openGraphCount: number
  hasTwitterCard: boolean
  hasViewport: boolean
  hasCharset: boolean
  hasLang: boolean
  issues: AuditIssue[]
}

export interface SchemaReport {
  jsonLdCount: number
  microdataCount: number
  rdfaCount: number
  schemaTypes: string[]
  hasOrganization: boolean
  hasWebSite: boolean
  hasFaq: boolean
  hasBreadcrumb: boolean
  hasArticle: boolean
  hasProduct: boolean
  issues: AuditIssue[]
}

export interface ChunkingReport {
  totalParagraphs: number
  totalWords: number
  viableChunks: number
  avgChunkTokens: number
  longParagraphs: number
  quality: "excellent" | "good" | "fair" | "poor"
  issues: AuditIssue[]
}

export interface SignalsReport {
  hasContactSignals: boolean
  hasPricingSignals: boolean
  hasTrustSignals: boolean
  hasFaqSignals: boolean
  hasEmailSignal: boolean
  hasPhoneSignal: boolean
  genericAnchorCount: number
  questionHeadingCount: number
  issues: AuditIssue[]
}

export interface RobotsReport {
  robotsTxtFound: boolean
  gptBotAllowed: boolean | null
  claudeBotAllowed: boolean | null
  googleBotAllowed: boolean | null
  bingBotAllowed: boolean | null
  perplexityBotAllowed: boolean | null
  issues: AuditIssue[]
}

// ── Scoring ─────────────────────────────────────────

export interface AeoScore {
  overall: number
  grade: string
  headings: number
  meta: number
  schema: number
  chunking: number
  signals: number
}

// ── Full Audit ──────────────────────────────────────

export interface AuditResult {
  url: string
  title: string
  description: string | null
  fetchedAt: string
  score: AeoScore
  headings: HeadingsReport
  meta: MetaReport
  schema: SchemaReport
  chunking: ChunkingReport
  signals: SignalsReport
  robots: RobotsReport
  issues: AuditIssue[]
  cta: string
}

// ── Trace ───────────────────────────────────────────

/**
 * A single URL/source consulted by the Responses API web_search_preview tool.
 * Comes from web_search_call.action.sources or url_citation annotations.
 */
export interface TraceSource {
  url: string
  title: string
  /** The text snippet cited inline, if available */
  snippet?: string
}

/**
 * A web_search_call action captured from Responses API output.
 * type: "search" | "open_page" | "find_in_page"
 */
export interface TraceSearchAction {
  type: string
  query?: string
  url?: string
  pattern?: string
}

export interface TraceResult {
  query: string
  /** Model used for this trace */
  model: string
  timestamp: string
  /** Raw search actions performed by the model (search, open_page, find_in_page) */
  searchActions: TraceSearchAction[]
  /** All URLs the model consulted (from annotations + sources) */
  sources: TraceSource[]
  /** Per-result enriched entries (sources + optional local audit) */
  results: TraceEntry[]
  /** The full text response from the model */
  responseText: string
  /** Whether this was a real Responses API trace or a fallback simulation */
  isSimulated: boolean
}

export interface TraceEntry {
  rank: number
  url: string
  title: string
  /** Snippet from action.sources when available; simulated traces may include model summaries */
  summary: string
  topics: string[]
  pageType: string
  /** True if the model explicitly opened this URL (open_page action) */
  opened: boolean
  /** Inline citation text from model annotations, if present */
  citation?: string
  /** Local AEO audit score (0-100), populated when --audit flag used */
  auditScore?: number
  /** Reserved for future local audit H1 text extraction; currently not populated */
  h1?: string
  /** Schema types detected by local audit */
  schemaTypes?: string[]
  /** Whether FAQ schema was detected */
  hasFaq?: boolean
  /** Issues found by local audit */
  auditIssues?: Array<{ severity: string; title: string }>
}

// ── Formatters ──────────────────────────────────────

export type OutputFormat = "terminal" | "json" | "csv" | "markdown"
