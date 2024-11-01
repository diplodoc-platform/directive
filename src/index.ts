import type MarkdownIt from 'markdown-it';

import direcitivePlugin from 'markdown-it-directive';

import {disableInlineDirectives} from './helpers';

export {
    registerBlockDirective,
    registerInlineDirective,
    disableBlockDirectives,
    disableInlineDirectives,
    tokenizeBlockContent,
    tokenizeInlineContent,
    createBlockInlineToken,
} from './helpers';

export type {
    DirectiveAttrs,
    DirectiveDests,
    BlockDirectiveParams,
    BlockDirectiveHandler,
    InlineDirectiveParams,
    InlineDirectiveHandler,
} from './types';

export type DirectiveParams = {
    inlineDirectives?: boolean;
};

// eslint-disable-next-line valid-jsdoc
/**
 * Inline directives are disabled by default.
 *
 * They will be enabled after this error is fixed: https://github.com/hilookas/markdown-it-directive/issues/5
 *
 * To enable inline directives, pass `inlineDirectives: true`
 */
export const directive = (params?: DirectiveParams): MarkdownIt.PluginSimple => {
    return (md) => {
        direcitivePlugin(
            // @ts-expect-error – bad types in markdown-it-directive
            md,
        );

        if (params?.inlineDirectives !== true) {
            disableInlineDirectives(md);
        }
    };
};
