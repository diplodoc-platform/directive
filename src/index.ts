import type {DirectiveHost} from './markdown-it';
import type {BoundaryState} from './runtime';

import directivePlugin from 'markdown-it-directive';

import {withBlockBoundary} from './block-boundary';
import {runtimeRules} from './runtime';

const BLOCK_LABELS_CONSTRAINED = Symbol('block-labels-constrained');

export type DirectiveInlineState = {src: string; pos: number; posMax: number; env: unknown};
export type DirectiveBlockState = BoundaryState & {
    env: unknown;
    skipCharsBack(pos: number, code: number, min: number): number;
    getLines(begin: number, end: number, indent: number, keepLastLF: boolean): string;
};
type LinkResult = {ok: boolean; pos: number; str: string};
export type DirectiveParserHost<B, I> = DirectiveHost<B, I> & {
    helpers: {
        parseLinkLabel(state: I, start: number, disableNested?: boolean): number;
        parseLinkTitle(src: string, pos: number, max: number): LinkResult;
        parseLinkDestination(src: string, pos: number, max: number): LinkResult;
    };
    utils: {normalizeReference(value: string): string};
};

function lineEnd(src: string, start: number, fallback: number): number {
    const lf = src.indexOf('\n', start);
    const cr = src.indexOf('\r', start);
    const ends = [lf, cr].filter((position) => position >= 0);

    return ends.length ? Math.min(...ends) : fallback;
}

function constrainBlockDirectiveLabels<
    B extends DirectiveBlockState,
    I extends DirectiveInlineState,
>(md: DirectiveParserHost<B, I>): void {
    if (Reflect.get(md, BLOCK_LABELS_CONSTRAINED)) {
        return;
    }

    const rule = runtimeRules<B>(md.block.ruler).find(({name}) => name === 'block_directive');

    if (!rule) {
        return;
    }

    const blockDirectiveRule = withBlockBoundary(rule.fn);
    if (!Reflect.set(md, BLOCK_LABELS_CONSTRAINED, true)) {
        throw new TypeError('Cannot mark directive block labels as constrained');
    }
    rule.fn = (state, startLine, endLine, silent) => {
        const parseLinkLabel = md.helpers.parseLinkLabel;

        md.helpers.parseLinkLabel = (inlineState: I, start: number, disableNested?: boolean) => {
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
    BlockContentState,
    InlineContentState,
    DirectiveToken,
    BlockHost,
    InlineHost,
} from './markdown-it';

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

export const directiveParser = () => {
    return <B extends DirectiveBlockState, I extends DirectiveInlineState>(
        md: DirectiveParserHost<B, I>,
    ) => {
        // The pinned upstream JS installer only installs its two rules and tables.
        // Keep its full native dev declaration out of our public host contract.
        Reflect.apply(directivePlugin, undefined, [md]);
        constrainBlockDirectiveLabels(md);
    };
};
