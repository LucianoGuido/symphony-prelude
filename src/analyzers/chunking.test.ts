import test from "node:test"
import assert from "node:assert/strict"
import { analyzeChunking, resetChunkingCounter } from "./chunking.js"

function paragraph(words: number): string {
  return `<p>${Array.from({ length: words }, (_, index) => `word${index}`).join(" ")}</p>`
}

test("analyzeChunking does not let short UI fragments dominate quality", () => {
  resetChunkingCounter()

  const shortFragments = Array.from({ length: 40 }, () => paragraph(20)).join("")
  const viableContent = Array.from({ length: 8 }, () => paragraph(65)).join("")
  const html = `<main>${shortFragments}${viableContent}</main>`

  const report = analyzeChunking(html)

  assert.equal(report.totalParagraphs, 48)
  assert.equal(report.viableChunks, 8)
  assert.equal(report.quality, "excellent")
})

test("analyzeChunking still reports poor quality when no viable chunks exist", () => {
  resetChunkingCounter()

  const html = `<main>${Array.from({ length: 10 }, () => paragraph(20)).join("")}</main>`
  const report = analyzeChunking(html)

  assert.equal(report.viableChunks, 0)
  assert.equal(report.quality, "poor")
})
