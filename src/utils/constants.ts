/**
 * Prelude — Brand constants and configuration
 */

export const PRELUDE_VERSION = "0.2.2"
export const PRELUDE_NAME = "Prelude"
export const PRELUDE_FULL_NAME = "Prelude by Symphony"
export const PRELUDE_REPO_URL = "https://github.com/LucianoGuido/symphony-prelude"
export const PRELUDE_USER_AGENT = `Prelude/${PRELUDE_VERSION} (+${PRELUDE_REPO_URL})`

export const SYMPHONY_URL = "https://symphonyui.com"
export const CONSERVATORY_URL = "https://conservatory.app"
export const CONSERVATORY_FIX_URL = `${CONSERVATORY_URL}/fix`

export const CTA_MESSAGE = `\n🔧 Fix these issues automatically with Conservatory → ${CONSERVATORY_URL}\n   Review-First Auto-Fix™ generates GitHub PRs for every finding.\n`

export const CTA_URL_TEMPLATE = (url: string) =>
  `${CONSERVATORY_FIX_URL}?url=${encodeURIComponent(url)}&utm_source=prelude&utm_medium=cli&utm_campaign=audit`

/** Approximate tokens per word (conservative estimate for English) */
export const TOKENS_PER_WORD = 1.3

/** Ideal chunk size range for LLM extraction (in tokens) */
export const CHUNK_MIN_TOKENS = 80
export const CHUNK_MAX_TOKENS = 200

/** Request timeout for HTML fetch (ms) */
export const FETCH_TIMEOUT_MS = 15_000

/** Maximum redirects to follow */
export const MAX_REDIRECTS = 5

/** Known AI search bot user-agent identifiers */
export const AI_BOT_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "PerplexityBot",
] as const
