import test from "node:test"
import assert from "node:assert/strict"
import { deriveTraceInsights, deriveTraceTopUrlRows } from "./trace-report.js"
import { formatTraceTerminal } from "./trace-terminal.js"
import type { TraceResult } from "../utils/types.js"

const fixture: TraceResult = {
  query: "seo audit",
  model: "o4-mini",
  timestamp: "2026-04-28T00:00:00.000Z",
  searchActions: [
    { type: "search", query: "site:conservatory.app seo audit" },
    { type: "open_page", url: "https://conservatory.app/" },
    { type: "open_page", url: "https://www.conservatory.app/" },
    { type: "open_page", url: "https://conservatory.app/logo.png" },
  ],
  sources: [
    {
      url: "https://conservatory.app/",
      title: "Conservatory by Symphony",
      snippet: "AI SEO and GEO audits for modern teams.",
      refs: ["search#0", "open#0", "citation#0"],
      sourceTypes: ["source", "opened", "citation"],
    },
    {
      url: "https://www.conservatory.app/",
      title: "Conservatory by Symphony",
      refs: ["open#1"],
      sourceTypes: ["opened"],
    },
    {
      url: "https://conservatory.app/terms-of-service.html",
      title: "Terms of Service",
      refs: ["citation#0"],
      sourceTypes: ["citation"],
    },
  ],
  results: [
    {
      rank: 1,
      url: "https://conservatory.app/",
      title: "Conservatory by Symphony",
      summary: "AI SEO and GEO audits for modern teams.",
      topics: [],
      pageType: "homepage",
      opened: true,
      refs: ["search#0", "open#0", "citation#0"],
      sourceTypes: ["source", "opened", "citation"],
    },
    {
      rank: 2,
      url: "https://www.conservatory.app/",
      title: "Conservatory by Symphony",
      summary: "",
      topics: [],
      pageType: "homepage",
      opened: true,
      refs: ["open#1"],
      sourceTypes: ["opened"],
    },
    {
      rank: 3,
      url: "https://conservatory.app/terms-of-service.html",
      title: "Terms of Service",
      summary: "",
      topics: [],
      pageType: "product_page",
      opened: false,
      refs: ["citation#0"],
      sourceTypes: ["citation"],
    },
  ],
  responseText: "",
  isSimulated: false,
}

test("deriveTraceTopUrlRows builds Olivier-style rows with combined refs", () => {
  const rows = deriveTraceTopUrlRows(fixture)

  assert.equal(rows[0].rank, 1)
  assert.equal(rows[0].type, "open+cited+src")
  assert.equal(rows[0].ref, "search#0, open#0 +1")
  assert.equal(rows[0].snippet, "AI SEO and GEO audits for modern teams.")
})

test("deriveTraceInsights flags duplicate canonicals, legal URLs, and asset opens", () => {
  const insights = deriveTraceInsights(fixture)

  assert.match(insights.warnings.join("\n"), /Duplicate canonical variants detected/)
  assert.match(insights.warnings.join("\n"), /Legal or policy pages appeared/)
  assert.match(insights.warnings.join("\n"), /asset URL/)
  assert.match(insights.opportunities.join("\n"), /Consolidate www\/non-www/)
})

test("formatTraceTerminal renders Top URLs, Trace Insights, and Conservatory PDF CTA", () => {
  const output = formatTraceTerminal(fixture)
  const plainOutput = output.replace(/\x1b\[[0-9;]*m/g, "")

  assert.match(plainOutput, /Top URLs/)
  assert.match(plainOutput, /Rank\s+URL\s+Title\s+Snippet\s+Type\s+Ref/)
  assert.match(plainOutput, /Trace Insights/)
  assert.match(plainOutput, /Need a full AI search audit with auto-fix, GitHub PRs, and a downloadable PDF report/)
})
