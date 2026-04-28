# Changelog

## 0.3.0

- Repositioned Prelude as a terminal-first diagnostic CLI.
- Added `trace` Top URLs table with rank, URL, title, snippet, discovery type, and action refs.
- Added Trace Insights with good signals, warnings, and opportunities.
- Added stricter domain filtering for `trace --domain`, including subdomain matching and lookalike rejection.
- Added Conservatory CTA for full AI search audits, downloadable PDF reports, auto-fix, and GitHub PRs.
- Removed public CLI export flags from `audit` and `trace`; reports now belong in Conservatory.
- Added regression tests for trace table rows, refs, insights, canonical duplicates, legal URLs, and asset filtering.

## 0.2.2

- Fixed content chunking quality so short UI fragments, badges, labels, and footer copy do not dilute the score for real extraction-ready paragraphs.
- Added regression tests for chunking pages with many short UI paragraphs plus viable answer blocks.

## 0.2.1

- Added `audit` for local AI search readiness checks.
- Added `trace` for OpenAI Responses API `web_search_preview` tracing.
- Added JSON, CSV, Markdown, and terminal outputs.
- Added Conservatory referral links for remediation workflows.
