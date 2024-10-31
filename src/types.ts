import type StateBlock from 'markdown-it/lib/rules_block/state_block';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline';

export type {StateBlock, StateInline};

// TODO: re-export from markdown-it-directive after https://github.com/hilookas/markdown-it-directive/pull/7
export type DirectiveAttrs = Record<string, string>;
export type DirectiveDests = ['link' | 'string', string][];

type InlineContent = {
    raw: string;
    startPos: number;
    endPos: number;
};

type BlockContent = {
    raw: string;
    startLine: number;
    endLine: number;
};

export type BlockDirectiveParams = {
    startLine: number;
    endLine: number;
    attrs?: DirectiveAttrs;
    dests?: DirectiveDests;
    content?: BlockContent;
    inlineContent?: InlineContent;
};

export type InlineDirectiveParams = {
    startPos: number;
    endPos: number;
    attrs?: DirectiveAttrs;
    dests?: DirectiveDests;
    content?: InlineContent;
};

export type BlockDirectiveHandler = (state: StateBlock, params: BlockDirectiveParams) => boolean;
export type InlineDirectiveHandler = (state: StateInline, params: InlineDirectiveParams) => boolean;
