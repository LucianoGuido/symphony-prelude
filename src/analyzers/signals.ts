/**
 * Prelude — Trust, FAQ, and entity signal analyzer
 */

import type { AuditIssue, FetchedPage, SignalsReport } from "../utils/types.js"

let issueCounter = 0
function nextId() { return `sig-${++issueCounter}` }

const GENERIC_ANCHORS = new Set(["click here", "learn more", "read more", "more", "here", "view more"])

export function analyzeSignals(page: FetchedPage): SignalsReport {
  const issues: AuditIssue[] = []
  const { links, headings, html } = page

  const linkTexts = links.map((l) => `${l.text} ${l.href}`.toLowerCase())

  const hasContact = linkTexts.some((t) => /contact|book|demo|call|email/.test(t))
  const hasPricing = linkTexts.some((t) => /pricing|plans|cost|quote/.test(t))
  const hasTrust = linkTexts.some((t) => /about|team|testimonial|review|case.study|customer/.test(t))
  const hasFaq = linkTexts.some((t) => /faq|help|support|guide|docs/.test(t))
  const hasEmail = /mailto:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(html)
  const hasPhone = /tel:|\+\d[\d\s().-]{6,}|\(\d{2,4}\)\s*\d+/i.test(html)

  const genericCount = links.filter((l) => GENERIC_ANCHORS.has(l.text.trim().toLowerCase())).length
  const questionCount = headings.filter((h) => h.text.includes("?")).length
  const headingTexts = headings.map((h) => h.text.toLowerCase())
  const hasFaqHeading = headingTexts.some((t) => t.includes("faq") || t.includes("question"))
  const hasTrustHeading = headingTexts.some((t) =>
    ["about", "team", "contact", "pricing", "review", "testimonial", "customer"].some((term) => t.includes(term)),
  )

  if (genericCount >= 2) {
    issues.push({
      id: nextId(), severity: "medium", category: "signals",
      title: "Generic anchor text detected",
      description: `${genericCount} links use text like "learn more" or "click here". LLMs use anchor text to understand page relationships.`,
      suggestion: "Replace with descriptive text that names the destination topic.",
      fixableWith: "conservatory",
    })
  }

  if (!hasContact && !hasTrust && !hasFaq) {
    issues.push({
      id: nextId(), severity: "medium", category: "signals",
      title: "Limited trust and proof signals",
      description: "No visible about, contact, FAQ, or trust links detected. These signals help LLMs assess entity credibility.",
      suggestion: "Add visible trust pathways (About, Contact, Reviews, FAQ) in the page navigation.",
      fixableWith: "manual",
    })
  }

  if (!hasFaqHeading && questionCount === 0 && headings.length >= 3) {
    issues.push({
      id: nextId(), severity: "low", category: "signals",
      title: "No FAQ or question-style headings",
      description: "No question-format headings detected. Pages with direct-answer sections are more likely to be cited by LLMs.",
      suggestion: "Add a FAQ section or use question-format headings (e.g. 'How does X work?').",
      fixableWith: "manual",
    })
  }

  return {
    hasContactSignals: hasContact,
    hasPricingSignals: hasPricing,
    hasTrustSignals: hasTrust,
    hasFaqSignals: hasFaq,
    hasEmailSignal: hasEmail,
    hasPhoneSignal: hasPhone,
    genericAnchorCount: genericCount,
    questionHeadingCount: questionCount,
    issues,
  }
}

export function resetSignalsCounter() { issueCounter = 0 }
