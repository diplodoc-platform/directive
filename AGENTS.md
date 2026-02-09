## Common rules and standards

This package is a submodule in the Diplodoc metapackage. When working in metapackage mode, also follow:

- `../../.agents/style-and-testing.md` — code style, import organization, testing, English-only docs/comments/commit messages
- `../../.agents/monorepo.md` — workspace vs standalone dependency management (`--no-workspaces`)
- `../../.agents/dev-infrastructure.md` — infrastructure update recipes and CI conventions

## Project description

`@diplodoc/directive` provides directive syntax parsing and helper APIs for integrating directives into MarkdownIt and Diplodoc transformer plugins.

Primary exports:

- `directiveParser()` — MarkdownIt plugin wrapper around `markdown-it-directive`
- helpers to enable/disable directive parsing
- directive registration helpers (inline / leaf block / container)
- tokenizers and utilities for parsing directive params and content

## Structure

- `src/` — sources
- `build/` — build output (generated, published)
- `esbuild/` — bundling configuration (Node target)
- `scripts/` — maintenance scripts (cross-platform)
- `tests/` — test suite
- `adr/` — architecture decision records

## Development commands

```bash
npm run typecheck
npm test
npm run lint
npm run build
```
