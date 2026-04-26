/**
 * Prelude — Heading hierarchy analyzer
 *
 * Validates heading structure for LLM readability.
 */

import type { AuditIssue, HeadingNode, HeadingsReport } from "../utils/types.js"

let issueCounter = 0
function nextId() {
  return `hdg-${++issueCounter}`
}

export function analyzeHeadings(headings: HeadingNode[]): HeadingsReport {
  const issues: AuditIssue[] = []
  const h1Count = headings.filter((h) => h.level === 1).length
  const skippedLevels: number[] = []
  let hierarchyValid = true

  // ── H1 checks ───────────────────────────────────

  if (h1Count === 0) {
    issues.push({
      id: nextId(),
      severity: "critical",
      category: "headings",
      title: "Missing H1 heading",
      description: "No H1 heading found. LLMs use H1 as the primary topic signal for the page.",
      suggestion: "Add exactly one H1 heading that clearly describes the page's main topic.",
      fixableWith: "conservatory",
    })
    hierarchyValid = false
  } else if (h1Count > 1) {
    issues.push({
      id: nextId(),
      severity: "high",
      category: "headings",
      title: "Multiple H1 headings",
      description: `Found ${h1Count} H1 headings. LLMs expect a single H1 to identify the page topic.`,
      suggestion: "Keep one H1 and demote the rest to H2 or appropriate sub-heading levels.",
      fixableWith: "conservatory",
    })
    hierarchyValid = false
  }

  // ── Hierarchy check ─────────────────────────────

  let prevLevel = 0

  for (const heading of headings) {
    if (heading.level > prevLevel + 1 && prevLevel > 0) {
      hierarchyValid = false
      if (!skippedLevels.includes(heading.level)) {
        skippedLevels.push(heading.level)
      }
    }
    prevLevel = heading.level
  }

  if (skippedLevels.length > 0) {
    issues.push({
      id: nextId(),
      severity: "medium",
      category: "headings",
      title: "Heading levels are skipped",
      description: `The heading hierarchy jumps levels (skipped: ${skippedLevels.join(", ")}). LLMs use heading nesting to understand content structure.`,
      suggestion: "Maintain a sequential heading hierarchy (H1 → H2 → H3) without skipping levels.",
      fixableWith: "conservatory",
    })
  }

  // ── Minimum heading depth ───────────────────────

  if (headings.length > 0 && headings.length < 3) {
    issues.push({
      id: nextId(),
      severity: "low",
      category: "headings",
      title: "Shallow heading structure",
      description: `Only ${headings.length} heading(s) found. Pages with richer heading structures are easier for LLMs to chunk and cite.`,
      suggestion: "Break content into more sections with descriptive H2/H3 headings for each topic.",
      fixableWith: "manual",
    })
  }

  return {
    h1Count,
    totalHeadings: headings.length,
    hierarchyValid,
    skippedLevels,
    issues,
  }
}

export function resetHeadingCounter() {
  issueCounter = 0
}
