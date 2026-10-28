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

## Unreleased compatibility preparation

These installation notes describe the prerelease preparation on this branch. They do not change the published 0.4.0 package's compatibility contract.

Choose the Markdown-it runtime explicitly when installing a supplied prerelease tarball. For example:

```sh
npm install ./diplodoc-directive-prerelease.tgz markdown-it@13
npm install --save-dev @types/markdown-it@13
```

The prepared package bundles markdown-it-directive with its MIT license notice. It no longer installs that dependency's private Markdown-it 12/13 or DefinitelyTyped peers. This removes the previous automatic installation of @types/markdown-it 13: TypeScript consumers using Markdown-it 12, 13 or 14 must install matching declarations explicitly. The declaration peer is optional so native Markdown-it 15 can use its own types.

| Runtime tested     | Declarations used for validation                          |
| ------------------ | --------------------------------------------------------- |
| Markdown-it 12.3.2 | @types/markdown-it 12.2.3 and @types/linkify-it 3.0.5     |
| Markdown-it 13.0.2 | @types/markdown-it 13.0.9                                 |
| Markdown-it 14.1.0 | @types/markdown-it 14.1.0 with mdurl 2.0.0                |
| Markdown-it 15.0.3 | Built-in declarations; no @types/markdown-it installation |

The explicit LinkifyIt declaration version in the 12 fixture avoids the incompatible version selected by that old declaration package's wildcard dependency. JavaScript consumers do not need declaration packages. A broad required declaration peer cannot automatically select the type major matching each runtime, so the package leaves that choice to the consumer.

The 14 TypeScript route uses the exact tuple above. The newer @types/markdown-it 14.2.0 exposes incompatible ESM/CommonJS parser types, and the older 14 declarations also disagree across module modes when mdurl 2.1.0's own declarations are selected. These are recorded prerelease compatibility limits; neither replacing the consumer's types nor disabling library checks is necessary for the supported tuple. Runtime 14 support also covers hosts such as the embedded YFMLint SDK whose public declarations still use the 13 type family.

The explicit root API exports remain unchanged. This preparation intentionally removes the old dependency's incidental ambient `markdown-it` aliases, including `Directive*Handler*` and `MarkdownItWithDirectives`, and its direct handler-map typing. Consumers relying on those ambient names or direct maps must migrate to the package's explicit registration helpers and exported parameter/handler types. This is not complete source or ambient compatibility, and no global augmentation shim is installed.

The emitted declarations use type import attributes with an explicit resolution mode. Validation uses TypeScript 6.0.3 with strict NodeNext checks in ESM and CommonJS modes; no compiler minimum beyond that tested configuration is claimed.

## Packed consumer checks

Run `npm run test:packed -- all` after a standalone `npm ci --no-workspaces`, or select one of `12`, `13`, `14`, and `15`. The script builds and packs the current source, installs the tarball into independent temporary consumers, and runs the actual public ESM/CommonJS declaration fixtures and the container regression suite. It also checks the installed host, runtime exports, bundled license and declaration imports.

The `Packed consumers` GitHub workflow runs each exact supported tuple separately. Reports include compiler/runtime logs and installed dependency graphs. Locally, the script prints its temporary report directory; `PACKED_CONSUMER_REPORT_DIR` can select a report destination.

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
