import type {MarkdownIt, StateBlock, StateInline} from './markdown-it';

export type DirectiveAttrs = Record<string, string | string[]>;
export type DirectiveDests = ['link' | 'string', string][];

export type DirectiveInlineHandlerArgs = {
    state: StateInline;
    content: string | undefined;
    dests: DirectiveDests | undefined;
    attrs: DirectiveAttrs | undefined;
    contentStart: number | undefined;
    contentEnd: number | undefined;
    directiveStart: number;
    directiveEnd: number;
};

export type DirectiveBlockHandlerArgs = {
    state: StateBlock;
    content?: string;
    contentTitle: string;
    inlineContent: string | undefined;
    dests: DirectiveDests | undefined;
    attrs: DirectiveAttrs | undefined;
    contentStartLine?: number;
    contentEndLine?: number;
    contentTitleStart: number;
    contentTitleEnd: number;
    inlineContentStart: number | undefined;
    inlineContentEnd: number | undefined;
    directiveStartLine: number;
    directiveEndLine: number;
};

export type DirectiveBlockHandler = (args: DirectiveBlockHandlerArgs) => boolean | void;

export type MarkdownItWithDirectives = MarkdownIt & {
    inlineDirectives: Record<string, (args: DirectiveInlineHandlerArgs) => boolean | void>;
    blockDirectives: Record<string, DirectiveBlockHandler>;
};
