/**
 * Prelude — Schema / JSON-LD analyzer
 *
 * Detects and validates structured data markup critical for LLM entity understanding.
 */

import type { AuditIssue, SchemaReport } from "../utils/types.js"

let issueCounter = 0
function nextId() {
  return `schema-${++issueCounter}`
}

export function analyzeSchema(html: string): SchemaReport {
  const issues: AuditIssue[] = []

  // ── Extract JSON-LD blocks ──────────────────────

  const jsonLdMatches =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []

  const jsonLdCount = jsonLdMatches.length
  const schemaTypes = new Set<string>()

  for (const block of jsonLdMatches) {
    const content = block
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim()

    if (!content) continue

    try {
      const parsed = JSON.parse(content)
      collectTypes(parsed, schemaTypes)
    } catch {
      issues.push({
        id: nextId(),
        severity: "medium",
        category: "schema",
        title: "Invalid JSON-LD syntax",
        description: "A JSON-LD block contains syntax errors and cannot be parsed by LLMs.",
        suggestion: "Validate and fix the JSON-LD block. Use Google's Rich Results Test or schema.org validator.",
        fixableWith: "conservatory",
      })
    }
  }

  // ── Detect microdata ────────────────────────────

  const microdataCount = countMatches(html, /itemscope|itemtype|itemprop/gi)

  // ── Detect RDFa ─────────────────────────────────

  const rdfaCount = countMatches(html, /\btypeof=|\bproperty=|\bresource=/gi)

  // ── Analyze types ───────────────────────────────

  const types = Array.from(schemaTypes).sort()

  const hasOrganization = types.some((t) =>
    ["Organization", "LocalBusiness", "Corporation"].includes(t),
  )
  const hasWebSite = types.includes("WebSite")
  const hasFaq = types.includes("FAQPage")
  const hasBreadcrumb = types.includes("BreadcrumbList")
  const hasArticle = types.some((t) => ["Article", "BlogPosting", "NewsArticle"].includes(t))
  const hasProduct = types.some((t) => ["Product", "Offer", "SoftwareApplication"].includes(t))

  const totalStructured = jsonLdCount + microdataCount + rdfaCount

  // ── Issues ──────────────────────────────────────

  if (totalStructured === 0) {
    issues.push({
      id: nextId(),
      severity: "high",
      category: "schema",
      title: "No structured data found",
      description:
        "No JSON-LD, microdata, or RDFa detected. LLMs rely on structured data to understand entities, relationships, and page purpose.",
      suggestion:
        "Add JSON-LD structured data. Start with Organization and WebSite schemas, then add page-specific types (Article, Product, FAQ, etc.).",
      fixableWith: "conservatory",
    })
  }

  if (totalStructured > 0 && !hasOrganization) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "schema",
      title: "Missing Organization schema",
      description:
        "Structured data exists but no Organization or LocalBusiness type was found. LLMs use this to identify the entity behind the content.",
      suggestion:
        "Add Organization JSON-LD with name, URL, logo, and contact details to strengthen entity recognition.",
      fixableWith: "conservatory",
    })
  }

  if (totalStructured > 0 && !hasWebSite) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "schema",
      title: "Missing WebSite schema",
      description: "No WebSite schema detected. This helps LLMs understand site-level context and search functionality.",
      suggestion: "Add WebSite JSON-LD describing the site entity, primary URL, and publisher.",
      fixableWith: "conservatory",
    })
  }

  if (jsonLdCount > 0 && !hasBreadcrumb) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "schema",
      title: "Missing BreadcrumbList schema",
      description: "No BreadcrumbList found. Breadcrumbs help LLMs understand page position in site hierarchy.",
      suggestion: "Add BreadcrumbList JSON-LD reflecting the page's position in the site structure.",
      fixableWith: "conservatory",
    })
  }

  return {
    jsonLdCount,
    microdataCount,
    rdfaCount,
    schemaTypes: types,
    hasOrganization,
    hasWebSite,
    hasFaq,
    hasBreadcrumb,
    hasArticle,
    hasProduct,
    issues,
  }
}

function collectTypes(value: unknown, collector: Set<string>) {
  if (!value) return

  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, collector)
    return
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const typeValue = record["@type"]

    if (typeof typeValue === "string") {
      collector.add(typeValue)
    } else if (Array.isArray(typeValue)) {
      for (const t of typeValue) collector.add(String(t))
    }

    for (const entry of Object.values(record)) {
      collectTypes(entry, collector)
    }
  }
}

function countMatches(html: string, regex: RegExp): number {
  const matches = html.match(regex)
  return matches ? new Set(matches).size : 0
}

export function resetSchemaCounter() {
  issueCounter = 0
}
