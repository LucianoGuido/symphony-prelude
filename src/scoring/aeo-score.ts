/**
 * Prelude — AEO Readiness Score
 *
 * Computes a composite LLM Readiness Score from individual analyzer results.
 * This is a simplified, original scoring model — NOT derived from Conservatory's
 * Unison Metrics™ proprietary scoring engine.
 */

import type { AeoScore, ChunkingReport, HeadingsReport, MetaReport, SchemaReport, SignalsReport } from "../utils/types.js"

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function computeAeoScore(params: {
  headings: HeadingsReport
  meta: MetaReport
  schema: SchemaReport
  chunking: ChunkingReport
  signals: SignalsReport
}): AeoScore {
  const { headings, meta, schema, chunking, signals } = params

  // ── Headings (20%) ──────────────────────────────
  let hdgScore = 100
  if (headings.h1Count === 0) hdgScore -= 40
  else if (headings.h1Count > 1) hdgScore -= 20
  if (!headings.hierarchyValid) hdgScore -= 20
  if (headings.totalHeadings < 3) hdgScore -= 15
  const headingsScore = clamp(hdgScore)

  // ── Meta (25%) ──────────────────────────────────
  let mScore = 100
  if (meta.titleLength === 0) mScore -= 30
  else if (meta.titleLength < 30 || meta.titleLength > 65) mScore -= 10
  if (meta.descriptionLength === 0) mScore -= 25
  else if (meta.descriptionLength < 80) mScore -= 10
  if (!meta.hasLang) mScore -= 10
  if (!meta.hasCanonical) mScore -= 5
  if (meta.openGraphCount === 0) mScore -= 10
  if (!meta.hasTwitterCard) mScore -= 5
  if (!meta.hasViewport) mScore -= 5
  const metaScore = clamp(mScore)

  // ── Schema (25%) ────────────────────────────────
  let sScore = 100
  if (schema.jsonLdCount === 0 && schema.microdataCount === 0) sScore -= 35
  if (!schema.hasOrganization) sScore -= 20
  if (!schema.hasWebSite) sScore -= 10
  if (!schema.hasBreadcrumb) sScore -= 5
  const schemaScore = clamp(sScore)

  // ── Chunking (20%) ──────────────────────────────
  let cScore = 100
  if (chunking.quality === "poor") cScore -= 40
  else if (chunking.quality === "fair") cScore -= 20
  else if (chunking.quality === "good") cScore -= 5
  if (chunking.longParagraphs >= 3) cScore -= 15
  if (chunking.totalWords < 100) cScore -= 20
  const chunkingScore = clamp(cScore)

  // ── Signals (10%) ───────────────────────────────
  let sigScore = 100
  if (!signals.hasTrustSignals && !signals.hasContactSignals) sigScore -= 25
  if (signals.genericAnchorCount >= 3) sigScore -= 15
  if (!signals.hasFaqSignals && signals.questionHeadingCount === 0) sigScore -= 10
  const signalsScore = clamp(sigScore)

  // ── Composite ───────────────────────────────────
  const overall = clamp(
    headingsScore * 0.20 +
    metaScore * 0.25 +
    schemaScore * 0.25 +
    chunkingScore * 0.20 +
    signalsScore * 0.10,
  )

  const grade = getGrade(overall)

  return { overall, grade, headings: headingsScore, meta: metaScore, schema: schemaScore, chunking: chunkingScore, signals: signalsScore }
}

function getGrade(score: number): string {
  if (score >= 90) return "A"
  if (score >= 75) return "B"
  if (score >= 60) return "C"
  if (score >= 40) return "D"
  return "F"
}
