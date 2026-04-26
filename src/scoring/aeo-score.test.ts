import test from "node:test"
import assert from "node:assert/strict"
import { computeAeoScore } from "./aeo-score.js"
import type {
  ChunkingReport,
  HeadingsReport,
  MetaReport,
  SchemaReport,
  SignalsReport,
} from "../utils/types.js"

const perfectHeadings: HeadingsReport = {
  h1Count: 1,
  totalHeadings: 5,
  hierarchyValid: true,
  skippedLevels: [],
  issues: [],
}

const perfectMeta: MetaReport = {
  titleLength: 48,
  descriptionLength: 140,
  hasCanonical: true,
  openGraphCount: 4,
  hasTwitterCard: true,
  hasViewport: true,
  hasCharset: true,
  hasLang: true,
  issues: [],
}

const perfectSchema: SchemaReport = {
  jsonLdCount: 2,
  microdataCount: 0,
  rdfaCount: 0,
  schemaTypes: ["Organization", "WebSite", "BreadcrumbList"],
  hasOrganization: true,
  hasWebSite: true,
  hasFaq: false,
  hasBreadcrumb: true,
  hasArticle: false,
  hasProduct: false,
  issues: [],
}

const perfectChunking: ChunkingReport = {
  totalParagraphs: 8,
  totalWords: 900,
  viableChunks: 5,
  avgChunkTokens: 120,
  longParagraphs: 0,
  quality: "excellent",
  issues: [],
}

const perfectSignals: SignalsReport = {
  hasContactSignals: true,
  hasPricingSignals: true,
  hasTrustSignals: true,
  hasFaqSignals: true,
  hasEmailSignal: true,
  hasPhoneSignal: false,
  genericAnchorCount: 0,
  questionHeadingCount: 2,
  issues: [],
}

test("computeAeoScore returns a perfect score for complete reports", () => {
  const score = computeAeoScore({
    headings: perfectHeadings,
    meta: perfectMeta,
    schema: perfectSchema,
    chunking: perfectChunking,
    signals: perfectSignals,
  })

  assert.equal(score.overall, 100)
  assert.equal(score.grade, "A")
})

test("computeAeoScore penalizes missing structural signals", () => {
  const score = computeAeoScore({
    headings: { ...perfectHeadings, h1Count: 0, totalHeadings: 1 },
    meta: { ...perfectMeta, titleLength: 0, descriptionLength: 0, hasLang: false },
    schema: {
      ...perfectSchema,
      jsonLdCount: 0,
      schemaTypes: [],
      hasOrganization: false,
      hasWebSite: false,
      hasBreadcrumb: false,
    },
    chunking: { ...perfectChunking, totalWords: 50, quality: "poor" },
    signals: {
      ...perfectSignals,
      hasContactSignals: false,
      hasTrustSignals: false,
      hasFaqSignals: false,
      questionHeadingCount: 0,
      genericAnchorCount: 4,
    },
  })

  assert.equal(score.overall, 38)
  assert.equal(score.grade, "F")
})
