**english** | [русский](https://github.com/diplodoc-platform/directive/blob/master/README.ru.md)

---

[![NPM version](https://img.shields.io/npm/v/@diplodoc/directive.svg?style=flat)](https://www.npmjs.org/package/@diplodoc/directive)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_directive&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_directive)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_directive&metric=coverage)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_directive)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_directive&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_directive)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_directive&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_directive)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_directive&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=diplodoc-platform_directive)

# Directive syntax parser

This is a pluggable parser for directive syntax for markdown markup. With it you can easily add implementation for a new block in you markdown project.

## Markdown-it compatibility

The Directive 1 prerelease on the `transform5` tag requires Markdown-it 15.0.3 or later within major 15:

```sh
npm install @diplodoc/directive@transform5 markdown-it@^15.0.3
```

TypeScript consumers use the declarations bundled with Markdown-it 15. No additional `@types/markdown-it` installation is needed. Directive 1 bundles `markdown-it-directive` with its MIT license notice.

If your application still uses Markdown-it 12–14, keep your existing Directive 0.x and Markdown-it versions until you can upgrade the host to 15. For Directive 0.4.0, see the [documentation for that release](https://github.com/diplodoc-platform/directive/tree/v0.4.0).

The explicit root API exports remain unchanged. Directive 1 removes the old dependency's incidental ambient `markdown-it` aliases, including `Directive*Handler*` and `MarkdownItWithDirectives`, and its direct handler-map typing. Consumers relying on those ambient names or direct maps must migrate to the package's explicit registration helpers and exported parameter/handler types. This is not complete source or ambient compatibility, and no global augmentation shim is installed.

The emitted declarations use type import attributes with an explicit resolution mode. Validation uses TypeScript 6.0.3 with strict NodeNext checks in ESM and CommonJS modes; no compiler minimum beyond that tested configuration is claimed.

## Packed consumer checks

Run `npm run test:packed -- 15` after a standalone `npm ci --no-workspaces`. The script builds and packs the current source, installs the tarball into an independent temporary consumer, and checks public ESM/CommonJS declarations and container behavior. It also checks the installed host, runtime exports, bundled license and declaration imports.

Use `npm run test:packed -- 15-with-types-14.2` to check coexistence with older declarations installed by another dependency. The `Packed consumers` GitHub workflow runs independent fixtures and reports compiler logs, runtime logs, and installed dependency graphs. Set `PACKED_CONSUMER_REPORT_DIR` to choose the report directory.

## Quickstart

Add new MarkdownIt-plugin or transformer extension, that plug-in a directive parser and register handler for new `block` directive:

```ts
import {
  directiveParser,
  registerContainerDirective,
  tokenizeBlockContent,
} from '@diplodoc/directive';

export function simpleBlockPlugin(): ReturnType<typeof directiveParser> {
  return (md) => {
    md.use(directiveParser());

    // register container directive using handler
    registerContainerDirective(md, 'block', (state, params) => {
      if (!params.content) return false;

      let token = state.push('simple_block_open', 'div', 1);
      token.attrSet('class', 'simple-block');

      tokenizeBlockContent(state, params.content);

      token = state.push('simple_block_close', 'div', -1);

      return true;
    });

    // or using config-object
    registerContainerDirective(md, {
      name: 'block',
      match(_params, state) {
        // here you can add something to state.env
        return true;
      },
      container: {
        tag: 'div',
        token: 'simple_block',
        attrs: {
          class: 'simple-block',
        },
      },
    });
  };
}
```

Then attach this plugin/extension to transformer or markdown-it instance:

```ts
import transform from '@diplodoc/transform';

const markup = `
::: block
### Heading 3 inside a simple block
:::
`;

const {result: {html}} = await transform(markup, plugins: [
    simpleBlockPlugin(),
]);

// or

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt().use(simpleBlockPlugin());

const html = md.render(markup);
```

`html` variable will have the value:

```html
<div class="simple-block">
  <h3>Heading 3 inside a simple block</h3>
</div>
```

## Directive syntax

Supported inline and block directive syntax. Inline directives are found in the text and start with `:`. Block directive is may be leaf block (without content, start with `::`) and container block (with content, start with `:::`).

- Inline: `:name [content] (identifier) {key=value}`
- Leaf block: `::name [inline content] (identifier) {key=value}`
- Container block:
  ```
  :::name [inline content] (identifier) {key=value}
  content
  :::
  ```

All of parameters groups – `[]`, `()`, `{}` – are optional, but their order is fixed.

- `[]` – used for something like inline-content;
- `()` – used for something like required identifier (id, url, etc.);
- `{}` – used to pass optional named arguments / attributes / `key=value` pairs. Parsed values are strings, or arrays of strings when the same key occurs more than once.

## Helpers

### Enable or disable some of directive types

- `enableInlineDirectives(md: MarkdownIt): void` – enable parsing of inline directives;

- `disableInlineDirectives(md: MarkdownIt): void` – disable parsing of inline directives;

- `enableBlockDirectives(md: MarkdownIt): void` – enable parsing of leaf and container blocks directives;

- `disableBlockDirectives(md: MarkdownIt): void` – disable parsing of leaf and container blocks directives.

### Register directive handler

- `registerInlineDirective()` – register handler for new inline directive. Name of directive used in markdown markup after `:`, for example: `:dir`.

  ```ts
  function registerInlineDirective(
    md: MarkdownIt,
    name: string,
    handler: InlineDirectiveHandler,
  ): void;
  ```

- `registerLeafBlockDirective()` – register handler for new leaf block directive.

  ```ts
  function registerLeafBlockDirective(md: MarkdownIt, config: LeafBlockDirectiveConfig): void;
  function registerLeafBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: LeafBlockDirectiveHandler,
  ): void;
  ```

- `registerContainerDirective()` – register handler for new container block or configure it using config-object.
  ```ts
  function registerContainerDirective(
    md: MarkdownIt,
    config: ContainerDirectiveConfig | CodeContainerDirectiveConfig,
  ): void;
  function registerContainerDirective(
    md: MarkdownIt,
    name: string,
    handler: ContainerDirectiveHandler,
    options?: {onConflict?: 'replace' | 'error'},
  ): void;
  ```

Container registrations replace an existing block directive with the same name by default. Pass `{onConflict: 'error'}` as the final argument, or set `onConflict: 'error'` in the configuration object, to reject a collision before changing the existing registration.

### Tokenizers

- `tokenizeInlineContent()` – can be used inside inline directive handler for parse and tokenize content of `[]`-section.

  ```ts
  function tokenizeInlineContent(
    state: MarkdownIt['inline']['State'],
    content: InlineContent,
  ): void;
  ```

- `tokenizeBlockContent()` – can be used inside block directive handler for parse and tokenize content between opening `:::name` and closing `:::` markup of container block directive.

  ```ts
  function tokenizeBlockContent(state: MarkdownIt['block']['State'], content: BlockContent): void;
  ```

- `createBlockInlineToken()` – can be used inside block directive handler for creating token with inline content of `[]`-section.

  ```ts
  function createBlockInlineToken(
    state: MarkdownIt['block']['State'],
    params: BlockDirectiveParams,
  ): MarkdownIt.Token;
  ```

### TypeScript hosts

The parser and registration helpers accept finite capabilities of the supplied MarkdownIt host.
Handler states are inferred from that host's native state constructors, including when multiple
MarkdownIt versions coexist in one installation. Explicit handler/configuration types accept a
state type parameter; their default remains the package-resolved native type for compatibility.

```ts
import MarkdownIt from 'markdown-it';
import {directiveParser, registerContainerDirective} from '@diplodoc/directive';
import type {ContainerDirectiveHandler} from '@diplodoc/directive';

const md = new MarkdownIt().use(directiveParser());
type BlockState = InstanceType<typeof md.block.State>;
const handler: ContainerDirectiveHandler<BlockState> = (state, params) => {
  state.push('example', 'div', 0).content = params.content.raw;
  return true;
};
registerContainerDirective(md, 'example', handler);
```

A handler typed for another incompatible host is rejected. Helpers preserve the caller's native
token type; directive-generated attributes are strings, while native numeric attributes remain
readable. Runtime rule tables and directive registries are internal and are not required in the
host's public declarations.

`npm run test:packed -- all` verifies installed native 12, 13, 14, and 15 hosts and a mixed root-13 /
aliased-15 installation, with strict ESM/CJS declarations and runtime regressions. Use `mixed` to
run only the coexistence fixture.

### Opaque block boundaries

A plugin that owns a block grammar can call `registerBlockBoundary(md, ruleName, rule, recognize)` to keep directive delimiters inside its blocks from closing an enclosing directive. `rule` is the exact callback installed in the host block ruler. The recognizer is ignored when that rule is disabled or replaced.

The recognizer receives a frozen source and line-position snapshot and returns the exclusive ending line, or `null` when no complete block matches. It may run during lookahead and must have no side effects. If it calls parser helpers, those helpers must also be safe for lookahead. The snapshot does not expose the mutable host parser.

Owners whose recognizers finish synchronously and do not retain their input can
explicitly opt into a scoped read-only view:

```ts
registerBlockBoundary(md, ruleName, rule, recognize, {input: 'scoped'});
```

In scoped mode, line arrays keep absolute line indexes and current list/quote
offsets. Read them only during the callback. Writes are rejected; retained array
access after the callback throws. Copy needed values during the callback if they
must outlive it. The view does not expose mutable parser state. The default
`input: 'snapshot'` mode continues to return stable frozen arrays that remain
readable after parsing, including after later parses on the same host.

Boundary discovery reuses native scanner configuration only while host options,
constructors, block-rule order/callbacks/enablement/alt chains and opaque
registrations remain unchanged. Mutable object-valued or accessor options
conservatively disable configuration reuse. Each scan has independent state,
source-index overlays, tokens and environment, including during reentrant calls.
The host has already indexed the source; scanner states initialize from an empty
source and read its existing line offsets without full-document copies.

This bounds source indexing and automatic line-array copying for native rules
and explicitly scoped recognizers. Default snapshot recognizers retain their
existing full-array copy cost for compatibility; adopting scoped input is a
separate, explicit owner decision. See [scanner performance contract](docs/scanner-performance.md).
