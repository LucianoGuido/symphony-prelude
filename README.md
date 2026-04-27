<div align="center">

# Prelude

**Most websites don't exist for AI.**

This CLI shows you if yours does -
and what AI search actually sees.

[Quick Start](#quick-start) · [Fix with Conservatory](#fix-with-conservatory) · [How It Works](#how-it-works) · [Commands](#commands)

</div>

---

## The problem

Search is changing.

* LLM traffic is growing fast
* AI answers are replacing clicks
* Most websites are invisible to AI

Not because of content.
Because of **structure** — and because you can't see what AI sees.

> If your site is not machine-readable, it does not exist.

---

## What Prelude does

Prelude gives you two views into AI search:

**`symphony-prelude audit`** — Why your page fails.

**`symphony-prelude trace`** — What AI actually sees.

Prelude tells you what the model did.

Conservatory tells you what to fix — and fixes it for you.

## Run the CLI, then fix with Conservatory

```bash
npx symphony-prelude audit https://conservatory.app
```

Prelude gives you a local AI-readiness report.

If the report finds missing schema, weak headings, unclear metadata, thin trust signals, or AI crawler issues, bring the findings into **[Conservatory](https://conservatory.app)** to generate reviewable GitHub PRs with the exact code changes.

## A new category

Prelude introduces a new category:

**LLM Readiness**

Not SEO.
Not analytics.

**Visibility for AI systems.**

---

## Why this matters

Google ranks pages.

LLMs select sources.

If your structure fails, you are not ranked lower -
you are **not selected at all**.

If you're not selected, you're invisible.

---

## Quick Start

```bash
# Audit any URL — free, no API key
npx symphony-prelude audit https://your-site.com

# Trace what OpenAI web search sees for a query
export OPENAI_API_KEY=sk-...
npx symphony-prelude trace "best CRM for startups"

# Trace focused on your domain
npx symphony-prelude trace "product overview" --domain your-site.com

# Trace + run local AEO audit on every discovered URL
npx symphony-prelude trace "best CRM for startups" --audit --format markdown
```

## Fix with Conservatory

Prelude is the free diagnostic layer:

```bash
npx symphony-prelude audit https://your-site.com --format markdown --output prelude-report.md
```

Conservatory is the remediation layer:

1. Run the audit.
2. Review the findings.
3. Use **[Conservatory](https://conservatory.app)** to turn fixable issues into GitHub PRs.

That loop is the point:

```
visible problem -> npx symphony-prelude audit -> Conservatory fixes it
```

---

## One question

Run this:

```bash
npx symphony-prelude audit your-site.com
```

Then ask:

Would an LLM cite this page?

If not - that's your problem.

---

## Commands

### `symphony-prelude audit <url>`

Local heuristic analysis — **no API key required, 100% free.**

Checks: headings hierarchy · meta tags · schema.org · content chunking · trust signals · robots.txt (GPTBot, ClaudeBot, Perplexity…)

```bash
# Terminal output (default)
symphony-prelude audit https://example.com

# JSON output for pipelines / Conservatory import
symphony-prelude audit https://example.com --format json

# CSV for spreadsheets
symphony-prelude audit https://example.com --format csv

# Markdown report
symphony-prelude audit https://example.com --format markdown --output report.md
```

---

### `symphony-prelude trace <query>`

Observes OpenAI's `web_search_preview` tool in action — **requires `OPENAI_API_KEY`**.

Uses the **Responses API** with `tools: [{ type: "web_search_preview" }]`. Captures:
- Search queries issued by the model (`search` action)
- URLs opened (`open_page` actions) → marked `opened: true` in output
- Sources per action via `include: ["web_search_call.action.sources"]`
- Inline citations from message `url_citation` annotations
- Full structured JSON / CSV / Markdown output

> **Honesty note:** This traces OpenAI's `web_search_preview` API tool — which approximates but does **not** replicate ChatGPT Search exactly. The ChatGPT product may use personalisation, session context, and additional ranking signals not available via the API. `topics` are not automatically populated (the API does not return them structured); `summary` comes from `action.sources[].snippet` when available. Results are observable and reproducible, but may differ from a logged-in ChatGPT session.

### Pro Tip: No OpenAI Key? No Problem.

The trace command requires an OpenAI API key to simulate real-time LLM behavior. If you don’t have a key or want to see the results without any setup, you can run a free trace directly on Conservatory.app.

Get the same deep insights into what ChatGPT sees, plus immediate access to our remediation workflow and the April 28 Founders Cohort.

```bash
export OPENAI_API_KEY=sk-...

# Basic trace
symphony-prelude trace "best CRM for startups"

# Restrict to your domain (adds site: prefix)
symphony-prelude trace "product overview" --domain acme.com

# Get more results
symphony-prelude trace "SEO tools" --max-results 10

# Also run local AEO audit on each discovered URL
symphony-prelude trace "SEO tools" --audit

# JSON output (machine-readable, crossable with Conservatory exports)
symphony-prelude trace "SEO tools" --format json --output trace.json

# CSV output (crossable with Google Search Console / Ahrefs)
symphony-prelude trace "SEO tools" --format csv --output trace.csv

# Markdown report (shareable, commit to repo)
symphony-prelude trace "SEO tools" --format markdown --output trace.md

# Batch mode: one query per line
symphony-prelude trace --query-file queries.txt --domain acme.com --format csv --output batch.csv

# Use a specific model
symphony-prelude trace "SEO tools" --model gpt-4o
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--max-results <n>` | `5` | Max URLs to capture per query |
| `--domain <domain>` | — | Restrict to domain (adds `site:` prefix) |
| `--audit` | false | Run local AEO audit on each discovered URL |
| `--model <model>` | `o4-mini` | OpenAI model. Use `o4-mini` for full tracing, `gpt-4o` for broad source discovery |
| `--query-file <file>` | — | Batch mode: one query per line |
| `--format <fmt>` | `terminal` | `terminal` · `json` · `csv` · `markdown` |
| `--output <file>` | — | Write to file instead of stdout |

**Recommended models for real `web_search_preview`:**
- `o4-mini` *(recommended for full tracing: search, open_page, find_in_page)*
- `gpt-4o` *(useful for broad source discovery; may only expose search + sources)*
- `gpt-4o-mini` *(compatible, but usually less useful for deep tracing)*

**Note on `topics` and `summaries`:** The API does not return structured per-URL topics. `topics` will always be `[]` in the real trace output. `summary` comes from `action.sources[].snippet` when available; with `--audit`, Prelude can fall back to the page's local meta description.

---

## How It Works

```
symphony-prelude audit
  Fetch HTML → Strip JS → Analyze structure
  → Headings · Meta · Schema · Chunking · Signals · Robots
  → AEO Score (0–100)
```

```
symphony-prelude trace
  OpenAI Responses API + web_search_preview tool
  + include: ["web_search_call.action.sources"]
  → Search actions: search / open_page / find_in_page
  → action.sources  → URLs the model actually read
  → url_citation annotations → inline citations
  → [optional --audit] Local AEO audit on each URL
  → Export: JSON / CSV / Markdown
```

The two commands are designed to work together:

1. **`trace`** reveals which URLs OpenAI's search opens for your target queries
2. **`audit`** (or `trace --audit`) shows why those URLs succeed or fail at being cited

---

## Output: `trace --audit`

```
  ♪ Prelude — ChatGPT Search Trace
  Query    : "best CRM for startups"
  Model    : o4-mini

  Search Actions
  ────────────────────────────────────────────────
  🔍 search       best CRM for startups
  📄 open_page    https://example.com/crm-guide
  🔎 find_in_page  https://example.com/crm-guide (find: pricing)
  📄 open_page    https://blog.acme.com/crm-2025

  Sources Consulted (6)
  1. https://example.com/crm-guide
     "The top CRM tools for early-stage startups…"

  Top Results (5)
#1 [OPENED] https://example.com/crm-guide
   The Best CRMs for Startups in 2025
   Type: blog_post
   AEO Score: 72/100 | Schema: Article, FAQPage | FAQ ✓
   [HIGH] Missing Organization schema
```

---

## Integration with Conservatory

Prelude diagnoses. **[Conservatory](https://conservatory.app) fixes.**

```
symphony-prelude trace --domain your-site.com --format json --output trace.json
# → Cross with Conservatory issue exports
# → See which URLs OpenAI web search opens and whether they have fixable issues
# → Conservatory generates GitHub PRs for every finding
```

Future integration (when Conservatory API ships):
- Automatic analysis of every URL trace finds
- "ChatGPT Search View" in the Conservatory dashboard
- CI mode: track whether ChatGPT's behavior changes per release

---

## Programmatic Usage

```typescript
import { runAudit } from "symphony-prelude"
import { runTrace } from "symphony-prelude"

// Audit a URL
const audit = await runAudit("https://example.com")
console.log(audit.score.overall)

// Trace a query
const trace = await runTrace("best CRM for startups", {
  domain: "example.com",
  maxResults: 5,
  audit: true,           // run local AEO audit on each URL
  model: "o4-mini",
})

for (const result of trace.results) {
  console.log(result.url, result.opened, result.auditScore)
}
```

---

## Contributing

```bash
git clone https://github.com/LucianoGuido/symphony-prelude.git
cd prelude
npm install
npm run dev    # TypeScript watch mode
npm run build  # compile
```

---

## License

MIT — Built by [Symphony](https://symphonyui.com)
