/**
 * Prelude — robots.txt AI bot analyzer
 */

import { AI_BOT_AGENTS } from "../utils/constants.js"
import type { AuditIssue, RobotsReport } from "../utils/types.js"

let issueCounter = 0
function nextId() { return `robots-${++issueCounter}` }

export async function analyzeRobots(url: string): Promise<RobotsReport> {
  const issues: AuditIssue[] = []
  let robotsTxtFound = false
  let robotsContent = ""

  try {
    const robotsUrl = new URL("/robots.txt", url).toString()
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      robotsTxtFound = true
      robotsContent = await res.text()
    }
  } catch { /* robots.txt not available */ }

  const checkBot = (agent: string): boolean | null => {
    if (!robotsTxtFound) return null
    return !isBotDisallowed(robotsContent, agent)
  }

  const gptBotAllowed = checkBot("GPTBot")
  const claudeBotAllowed = checkBot("ClaudeBot")
  const googleBotAllowed = checkBot("Googlebot")
  const bingBotAllowed = checkBot("Bingbot")
  const perplexityBotAllowed = checkBot("PerplexityBot")

  if (!robotsTxtFound) {
    issues.push({
      id: nextId(), severity: "low", category: "robots",
      title: "No robots.txt found",
      description: "No robots.txt file detected. While not required, it helps control AI bot access.",
      suggestion: "Add a robots.txt that explicitly allows GPTBot, ClaudeBot, and other AI crawlers.",
      fixableWith: "manual",
    })
  }

  const blockedBots: string[] = []
  if (gptBotAllowed === false) blockedBots.push("GPTBot")
  if (claudeBotAllowed === false) blockedBots.push("ClaudeBot")
  if (perplexityBotAllowed === false) blockedBots.push("PerplexityBot")

  if (blockedBots.length > 0) {
    issues.push({
      id: nextId(), severity: "critical", category: "robots",
      title: "AI search bots are blocked",
      description: `robots.txt blocks: ${blockedBots.join(", ")}. These bots cannot crawl your content for AI search results.`,
      suggestion: `Remove Disallow rules for ${blockedBots.join(", ")} unless you intentionally want to be invisible to AI search.`,
      fixableWith: "manual",
    })
  }

  return { robotsTxtFound, gptBotAllowed, claudeBotAllowed, googleBotAllowed, bingBotAllowed, perplexityBotAllowed, issues }
}

function isBotDisallowed(content: string, agent: string): boolean {
  const lines = content.split("\n").map((l) => l.trim())
  let inAgentBlock = false
  let inWildcardBlock = false
  let agentDisallowedAll = false
  let wildcardDisallowedAll = false

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.startsWith("user-agent:")) {
      const ua = line.slice("user-agent:".length).trim()
      inAgentBlock = ua.toLowerCase() === agent.toLowerCase()
      inWildcardBlock = ua === "*"
    } else if (lower.startsWith("disallow:")) {
      const path = line.slice("disallow:".length).trim()
      if (path === "/") {
        if (inAgentBlock) agentDisallowedAll = true
        if (inWildcardBlock) wildcardDisallowedAll = true
      }
    }
  }

  return agentDisallowedAll || (!inAgentBlock && wildcardDisallowedAll)
}

export function resetRobotsCounter() { issueCounter = 0 }
