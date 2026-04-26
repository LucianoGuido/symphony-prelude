/**
 * Prelude — Meta tag analyzer
 *
 * Validates meta tags, Open Graph, Twitter Cards, and document-level signals
 * that affect LLM discovery and citation.
 */

import type { AuditIssue, FetchedPage, MetaReport } from "../utils/types.js"

let issueCounter = 0
function nextId() {
  return `meta-${++issueCounter}`
}

export function analyzeMeta(page: FetchedPage): MetaReport {
  const issues: AuditIssue[] = []
  const { title, description, metaTags, canonical, lang, charset, viewport } = page

  const titleLength = title.length
  const descriptionLength = description?.length ?? 0

  // ── Title ───────────────────────────────────────

  if (!title) {
    issues.push({
      id: nextId(),
      severity: "critical",
      category: "meta",
      title: "Missing title tag",
      description: "No title tag found. LLMs use the title as the primary label when referencing a page.",
      suggestion: "Add a descriptive title tag between 50–60 characters.",
      fixableWith: "conservatory",
    })
  } else if (titleLength < 30) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "meta",
      title: "Title too short",
      description: `Title is ${titleLength} characters. Short titles provide insufficient context for LLM citation.`,
      suggestion: "Expand the title to 50–60 characters with a clear description of the page content.",
      fixableWith: "conservatory",
    })
  } else if (titleLength > 65) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Title may be truncated",
      description: `Title is ${titleLength} characters. It may be cut off in AI search snippets.`,
      suggestion: "Keep the title under 60 characters for consistent display across search surfaces.",
      fixableWith: "conservatory",
    })
  }

  // ── Description ─────────────────────────────────

  if (!description) {
    issues.push({
      id: nextId(),
      severity: "high",
      category: "meta",
      title: "Missing meta description",
      description: "No meta description found. LLMs use descriptions to evaluate page relevance in their internal SERP before deciding whether to open a page.",
      suggestion: "Add a factual, 150–160 character meta description summarizing the page's value.",
      fixableWith: "conservatory",
    })
  } else if (descriptionLength < 80) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "meta",
      title: "Meta description too short",
      description: `Description is ${descriptionLength} characters. Brief descriptions reduce the chance of being selected by LLM query fan-out.`,
      suggestion: "Expand to 150–160 characters with concrete, factual content.",
      fixableWith: "conservatory",
    })
  } else if (descriptionLength > 165) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Meta description may be truncated",
      description: `Description is ${descriptionLength} characters. Optimize to 150–160 for best results.`,
      suggestion: "Trim to 150–160 characters while keeping the core message.",
      fixableWith: "conservatory",
    })
  }

  // ── Language ────────────────────────────────────

  if (!lang) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "meta",
      title: "Missing lang attribute",
      description: "No lang attribute on <html>. Multilingual LLMs use this to determine content language.",
      suggestion: 'Add lang="en" (or appropriate code) to the <html> element.',
      fixableWith: "conservatory",
    })
  }

  // ── Charset ─────────────────────────────────────

  if (!charset) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Missing charset declaration",
      description: "No character encoding declaration found.",
      suggestion: 'Add <meta charset="UTF-8"> in the <head> section.',
      fixableWith: "conservatory",
    })
  }

  // ── Viewport ────────────────────────────────────

  if (!viewport) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "meta",
      title: "Missing viewport meta tag",
      description: "No viewport meta tag found. This affects mobile rendering and some LLM evaluations.",
      suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      fixableWith: "conservatory",
    })
  }

  // ── Canonical ───────────────────────────────────

  if (!canonical) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Missing canonical URL",
      description: "No canonical tag found. LLMs may see duplicate pages as lower-authority sources.",
      suggestion: "Add a <link rel=\"canonical\"> tag pointing to the preferred URL.",
      fixableWith: "conservatory",
    })
  }

  // ── Open Graph ──────────────────────────────────

  const ogKeys = Object.keys(metaTags).filter((k) => k.startsWith("og:"))
  const essentialOg = ["og:title", "og:description", "og:image", "og:url"]
  const missingOg = essentialOg.filter((k) => !metaTags[k])

  if (ogKeys.length === 0) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "meta",
      title: "Missing Open Graph tags",
      description: "No Open Graph tags found. These improve how the page is previewed when shared and referenced by AI systems.",
      suggestion: "Add og:title, og:description, og:image, and og:url meta tags.",
      fixableWith: "conservatory",
    })
  } else if (missingOg.length > 0) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Incomplete Open Graph tags",
      description: `Missing: ${missingOg.join(", ")}. Complete OG tags improve citation quality.`,
      suggestion: `Add the missing Open Graph tags: ${missingOg.join(", ")}.`,
      fixableWith: "conservatory",
    })
  }

  // ── Twitter Card ────────────────────────────────

  const hasTwitterCard = Boolean(metaTags["twitter:card"])

  if (!hasTwitterCard) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "meta",
      title: "Missing Twitter Card tags",
      description: "No Twitter Card meta tags found.",
      suggestion: 'Add <meta name="twitter:card" content="summary_large_image"> and related tags.',
      fixableWith: "conservatory",
    })
  }

  return {
    titleLength,
    descriptionLength,
    hasCanonical: Boolean(canonical),
    openGraphCount: ogKeys.length,
    hasTwitterCard,
    hasViewport: viewport,
    hasCharset: charset,
    hasLang: Boolean(lang),
    issues,
  }
}

export function resetMetaCounter() {
  issueCounter = 0
}
