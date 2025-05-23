import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline';
import type {DirectiveAttrs, DirectiveDests as DirectiveDestsOrig} from 'markdown-it-directive';
import type {CONTAINER_KEY, LEAF_BLOCK_KEY} from './const';

export type {StateBlock, StateInline};
export type {DirectiveAttrs, DirectiveDestsOrig};

export type Env = any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

export type LeafBlockDirectiveParams = {
    startLine: number;
    endLine: number;
    attrs?: DirectiveAttrs;
    dests?: DirectiveDests;
    inlineContent?: InlineContent;
};

export type ContainerDirectiveParams = LeafBlockDirectiveParams & {
    content: BlockContent;
};

export type InlineDirectiveParams = {
    startPos: number;
    endPos: number;
    attrs?: DirectiveAttrs;
    dests?: DirectiveDests;
    content?: InlineContent;
};

export type ContainerDirectiveHandler = (
    state: StateBlock,
    params: ContainerDirectiveParams,
) => boolean;
export type LeafBlockDirectiveHandler = (
    state: StateBlock,
    params: LeafBlockDirectiveParams,
) => boolean;
export type InlineDirectiveHandler = (state: StateInline, params: InlineDirectiveParams) => boolean;

export type TokensDesc<P> = {
    tag: string;
    token: string;
    attrs?: DirectiveAttrs | ((params: P, env: Env) => DirectiveAttrs);
    meta?: object | ((params: P, env: Env) => object);
};

export type LeafBlockDirectiveConfig = {
    name: string;
    match: (params: LeafBlockDirectiveParams, state: StateBlock) => boolean;
    container: TokensDesc<LeafBlockDirectiveParams>;
};

export type ContainerDirectiveConfig = {
    name: string;
    type?: 'container_block';
    match: (params: ContainerDirectiveParams, state: StateBlock) => boolean;
    container: TokensDesc<ContainerDirectiveParams>;
    inlineContent?: TokensDesc<ContainerDirectiveParams> & {
        /** @default true */
        required?: boolean;
    };
    content?: TokensDesc<ContainerDirectiveParams>;
    /** If not passed – default tokenizer will be used */
    contentTokenizer?: (
        state: StateBlock,
        content: BlockContent,
        params: ContainerDirectiveParams,
    ) => void;
};

export type CodeContainerDirectiveConfig = {
    name: string;
    type: 'code_block';
    match: (params: ContainerDirectiveParams, state: StateBlock) => boolean;
    container: TokensDesc<ContainerDirectiveParams>;
};

export interface MdItWithHandlers extends MarkdownIt {
    [CONTAINER_KEY]: Record<string, ContainerDirectiveHandler>;
    [LEAF_BLOCK_KEY]: Record<string, LeafBlockDirectiveHandler>;
}
