import type {BlockRule, MarkdownIt, PluginSimple, StateInline} from './markdown-it';

import directivePlugin from 'markdown-it-directive';

import {withBlockBoundary} from './block-boundary';

type RulerWithRules<T> = {
    __rules__: Array<{name: string; fn: T}>;
};

const BLOCK_LABELS_CONSTRAINED = Symbol('block-labels-constrained');

type PatchedMarkdownIt = MarkdownIt & {
    [BLOCK_LABELS_CONSTRAINED]?: boolean;
};

function lineEnd(src: string, start: number, fallback: number): number {
    const lf = src.indexOf('\n', start);
    const cr = src.indexOf('\r', start);
    const ends = [lf, cr].filter((position) => position >= 0);

    return ends.length ? Math.min(...ends) : fallback;
}

function constrainBlockDirectiveLabels(md: MarkdownIt): void {
    const patchedMd = md as PatchedMarkdownIt;
    if (patchedMd[BLOCK_LABELS_CONSTRAINED]) {
        return;
    }

    const ruler = md.block.ruler as unknown as RulerWithRules<BlockRule>;
    const rule = ruler.__rules__.find(({name}) => name === 'block_directive');

    if (!rule) {
        return;
    }

    const blockDirectiveRule = withBlockBoundary(rule.fn);
    patchedMd[BLOCK_LABELS_CONSTRAINED] = true;
    rule.fn = (state, startLine, endLine, silent) => {
        const parseLinkLabel = md.helpers.parseLinkLabel;

        md.helpers.parseLinkLabel = (
            inlineState: StateInline,
            start: number,
            disableNested?: boolean,
        ) => {
            if (inlineState.src.charCodeAt(start) !== 0x5b /* [ */) {
                return -1;
            }

            const posMax = inlineState.posMax;
            inlineState.posMax = Math.min(posMax, lineEnd(inlineState.src, start, posMax));

            try {
                return parseLinkLabel(inlineState, start, disableNested);
            } finally {
                inlineState.posMax = posMax;
            }
        };

        try {
            return blockDirectiveRule(state, startLine, endLine, silent);
        } finally {
            md.helpers.parseLinkLabel = parseLinkLabel;
        }
    };
}

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

export const directiveParser = (): PluginSimple => {
    return (md) => {
        directivePlugin(md);
        constrainBlockDirectiveLabels(md);
    };
};
