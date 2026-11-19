import type {MarkdownIt, StateBlock, StateInline} from './markdown-it';
import type {DirectiveAttrs, DirectiveDests as DirectiveDestsOrig} from './upstream';
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
    contentTitle?: InlineContent;
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

export type ContainerDirectiveHandler<S = StateBlock> = (
    state: S,
    params: ContainerDirectiveParams,
) => boolean;
export type LeafBlockDirectiveHandler<S = StateBlock> = (
    state: S,
    params: LeafBlockDirectiveParams,
) => boolean;
export type InlineDirectiveHandler<S = StateInline> = (
    state: S,
    params: InlineDirectiveParams,
) => boolean;

export type TokensDesc<P> = {
    tag: string;
    token: string;
    attrs?: Record<string, string> | ((params: P, env: Env) => Record<string, string>);
    meta?: object | ((params: P, env: Env) => object);
};

export type LeafBlockDirectiveConfig<S = StateBlock> = {
    name: string;
    match: (params: LeafBlockDirectiveParams, state: S) => boolean;
    container: TokensDesc<LeafBlockDirectiveParams>;
};

export type ContainerDirectiveConfig<S = StateBlock> = {
    name: string;
    onConflict?: 'replace' | 'error';
    type?: 'container_block';
    match: (params: ContainerDirectiveParams, state: S) => boolean;
    container: TokensDesc<ContainerDirectiveParams>;
    inlineContent?: TokensDesc<ContainerDirectiveParams> & {
        /** @default true */
        required?: boolean;
    };
    content?: TokensDesc<ContainerDirectiveParams>;
    /** If not passed – default tokenizer will be used */
    contentTokenizer?: (state: S, content: BlockContent, params: ContainerDirectiveParams) => void;
};

export type CodeContainerDirectiveConfig<S = StateBlock> = {
    name: string;
    onConflict?: 'replace' | 'error';
    type: 'code_block';
    match: (params: ContainerDirectiveParams, state: S) => boolean;
    container: TokensDesc<ContainerDirectiveParams>;
};

export interface MdItWithHandlers extends MarkdownIt {
    [CONTAINER_KEY]: Record<string, ContainerDirectiveHandler>;
    [LEAF_BLOCK_KEY]: Record<string, LeafBlockDirectiveHandler>;
}
