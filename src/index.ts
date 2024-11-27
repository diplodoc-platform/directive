import type MarkdownIt from 'markdown-it';

import directivePlugin from 'markdown-it-directive';

import {disableInlineDirectives} from './helpers';

export {
    enableBlockDirectives,
    enableInlineDirectives,
    disableBlockDirectives,
    disableInlineDirectives,
} from './helpers';
export {
    registerContainerDirective,
    registerLeafBlockDirective,
    registerInlineDirective,
} from './helpers/registrars';
export {
    tokenizeBlockContent,
    tokenizeInlineContent,
    createBlockInlineToken,
} from './helpers/tokenizers';

export type {
    DirectiveAttrs,
    DirectiveDests,
    LeafBlockDirectiveParams,
    LeafBlockDirectiveHandler,
    ContainerDirectiveConfig,
    ContainerDirectiveParams,
    ContainerDirectiveHandler,
    InlineDirectiveParams,
    InlineDirectiveHandler,
} from './types';

// eslint-disable-next-line valid-jsdoc
/**
 * Inline directives are disabled by default.
 *
 * They will be enabled after this error is fixed: https://github.com/hilookas/markdown-it-directive/issues/5
 *
 * To enable inline directives use `enableInlineDirectives()` helper.
 */
export const directiveParser = (): MarkdownIt.PluginSimple => {
    return (md) => {
        directivePlugin(md);

        disableInlineDirectives(md);
    };
};
