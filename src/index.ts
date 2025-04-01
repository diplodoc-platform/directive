import type MarkdownIt from 'markdown-it';

import directivePlugin from 'markdown-it-directive';

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
    LeafBlockDirectiveConfig,
    LeafBlockDirectiveParams,
    LeafBlockDirectiveHandler,
    CodeContainerDirectiveConfig,
    ContainerDirectiveConfig,
    ContainerDirectiveParams,
    ContainerDirectiveHandler,
    InlineDirectiveParams,
    InlineDirectiveHandler,
} from './types';

export const directiveParser = (): MarkdownIt.PluginSimple => {
    return (md) => {
        directivePlugin(md);
    };
};
