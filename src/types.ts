import type StateBlock from 'markdown-it/lib/rules_block/state_block';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline';

export type {StateBlock, StateInline};

// TODO: re-export this types from markdown-it-directive after update to 2.0.3
export type DirectiveAttrs = Record<string, string>;
export type DirectiveDestsOrig = ['link' | 'string', string][];

export type DirectiveDests = {
    link?: string;
    string?: string;
    _original_dests: DirectiveDestsOrig;
};

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

type TokensDesc = {
    tag: string;
    token: string;
    attrs?: DirectiveAttrs | ((params: BlockDirectiveParams) => DirectiveAttrs);
};

export type BlockDirectiveConfig = {
    name: string;
    type: 'container';
    match: (params: BlockDirectiveParams, state: StateBlock) => boolean;
    container: TokensDesc;
    inlineContent?: TokensDesc & {
        /** @default true */
        required?: boolean;
    };
    content?: TokensDesc;
    /** If not passed – default tokenizer will be used */
    contentTokenizer?: (
        state: StateBlock,
        content: BlockContent,
        params: BlockDirectiveParams,
    ) => void;
};
