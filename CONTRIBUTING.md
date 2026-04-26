# Contributing to Prelude

Thanks for helping improve Prelude.

## Local Setup

```bash
npm install
npm run build
npm test
```

## Development Notes

- Keep the CLI honest about what it can observe.
- Prefer deterministic checks for `audit`.
- Keep OpenAI web search behavior clearly labelled as an API trace, not a full replica of ChatGPT Search.
- Add focused tests for scoring, formatting, parsing, and regressions.

## Pull Requests

Before opening a PR, run:

```bash
npm run build
npm test
npm pack --dry-run
```
