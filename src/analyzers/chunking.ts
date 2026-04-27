/**
 * Prelude — Content chunking analyzer
 *
 * Evaluates how well page content can be broken into
 * semantic chunks suitable for LLM extraction and citation.
 */

import { CHUNK_MAX_TOKENS, CHUNK_MIN_TOKENS, TOKENS_PER_WORD } from "../utils/constants.js"
import type { AuditIssue, ChunkingReport } from "../utils/types.js"

let issueCounter = 0
function nextId() { return `chunk-${++issueCounter}` }

export function analyzeChunking(html: string): ChunkingReport {
  const issues: AuditIssue[] = []
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const totalWords = plainText.split(/\s+/).filter(Boolean).length
  const paragraphMatches = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) ?? []
  const totalParagraphs = paragraphMatches.length

  let viableChunks = 0
  let totalChunkTokens = 0
  let longParagraphs = 0
  let candidateParagraphs = 0
  const minCandidateTokens = Math.round(CHUNK_MIN_TOKENS * 0.5)

  for (const p of paragraphMatches) {
    const text = p.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const words = text.split(/\s+/).filter(Boolean).length
    const tokens = Math.round(words * TOKENS_PER_WORD)
    if (tokens >= minCandidateTokens) candidateParagraphs++
    if (tokens >= CHUNK_MIN_TOKENS && tokens <= CHUNK_MAX_TOKENS) { viableChunks++; totalChunkTokens += tokens }
    if (tokens > CHUNK_MAX_TOKENS * 1.5) longParagraphs++
  }

  const avgChunkTokens = viableChunks > 0 ? Math.round(totalChunkTokens / viableChunks) : 0
  let quality: ChunkingReport["quality"]
  if (totalParagraphs === 0 || totalWords < 50) quality = "poor"
  else {
    // Short UI blurbs, badges, footer copy, and card labels are often valid
    // page text, but they are not meaningful LLM extraction candidates.
    const r = viableChunks / Math.max(1, candidateParagraphs)
    quality = r >= 0.5 ? "excellent" : r >= 0.3 ? "good" : r >= 0.15 ? "fair" : "poor"
  }

  if (totalWords < 100) issues.push({ id: nextId(), severity: "high", category: "chunking", title: "Insufficient content depth", description: `Only ~${totalWords} words. LLMs need 300+ words for meaningful citations.`, suggestion: "Add factual, topic-focused content with clear section answers.", fixableWith: "manual" })
  if (longParagraphs >= 2) issues.push({ id: nextId(), severity: "medium", category: "chunking", title: "Content blocks too large", description: `${longParagraphs} paragraphs exceed the ideal LLM extraction window (~80-200 tokens).`, suggestion: "Break long paragraphs into 2-3 sentence blocks with sub-headings.", fixableWith: "manual" })
  if (totalParagraphs >= 5 && viableChunks === 0) issues.push({ id: nextId(), severity: "high", category: "chunking", title: "No viable extraction chunks", description: "Content exists but no paragraphs fall within the ideal token range for LLM extraction.", suggestion: "Restructure to 2-3 focused sentences per paragraph (~80-200 tokens).", fixableWith: "manual" })
  if (totalParagraphs === 0 && totalWords > 100) issues.push({ id: nextId(), severity: "medium", category: "chunking", title: "No paragraph elements detected", description: "Content not in <p> tags. LLMs rely on paragraph markup for chunking.", suggestion: "Wrap text in proper <p> elements.", fixableWith: "conservatory" })

  return { totalParagraphs, totalWords, viableChunks, avgChunkTokens, longParagraphs, quality, issues }
}

export function resetChunkingCounter() { issueCounter = 0 }
