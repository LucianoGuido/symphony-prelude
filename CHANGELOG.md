# Changelog

## 0.2.2

- Fixed content chunking quality so short UI fragments, badges, labels, and footer copy do not dilute the score for real extraction-ready paragraphs.
- Added regression tests for chunking pages with many short UI paragraphs plus viable answer blocks.

## 0.2.1

- Added `audit` for local AI search readiness checks.
- Added `trace` for OpenAI Responses API `web_search_preview` tracing.
- Added JSON, CSV, Markdown, and terminal outputs.
- Added Conservatory referral links for remediation workflows.
