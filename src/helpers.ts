import type MarkdownIt from 'markdown-it';
import type {MarkdownItWithDirectives} from 'markdown-it-directive';
import type {
    BlockDirectiveHandler,
    BlockDirectiveParams,
    InlineDirectiveHandler,
    InlineDirectiveParams,
    StateBlock,
    StateInline,
} from './types';

import {RULE} from './const';

export function disableInlineDirectives(md: MarkdownIt): void {
    md.inline.ruler.disable(RULE.Inline, true);
}

export function disableBlockDirectives(md: MarkdownIt): void {
    md.block.ruler.disable(RULE.Block, true);
}

export function registerInlineDirective(
    md: MarkdownIt,
    name: string,
    handler: InlineDirectiveHandler,
): void {
    (md as MarkdownItWithDirectives).inlineDirectives[name] = (args) => {
        const params: InlineDirectiveParams = {
            startPos: args.directiveStart,
            endPos: args.directiveEnd,
        };
        if (args.attrs !== undefined) {
            params.attrs = args.attrs as unknown as InlineDirectiveParams['attrs'];
        }
        if (args.dests !== undefined) {
            params.dests = args.dests as unknown as InlineDirectiveParams['dests'];
        }
        if (args.content !== undefined) {
            params.content = {
                raw: args.content,
                startPos: args.contentStart!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                endPos: args.contentEnd!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
            };
        }
        return handler(args.state, params);
    };
}

export function registerBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: BlockDirectiveHandler,
): void {
    (md as MarkdownItWithDirectives).blockDirectives[name] = (args) => {
        const params: BlockDirectiveParams = {
            startLine: args.directiveStartLine,
            endLine: args.directiveEndLine,
        };
        if (args.attrs !== undefined) {
            params.attrs = args.attrs as unknown as BlockDirectiveParams['attrs'];
        }
        if (args.dests !== undefined) {
            params.dests = args.dests as unknown as BlockDirectiveParams['dests'];
        }
        if (args.inlineContent !== undefined) {
            params.inlineContent = {
                raw: args.inlineContent,
                startPos: args.inlineContentStart!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                endPos: args.inlineContentEnd!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
            };
        }
        if (args.content !== undefined) {
            params.content = {
                raw: args.content,
                startLine: args.contentStartLine!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
                endLine: args.contentEndLine!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
            };
        }
        return handler(args.state, params);
    };
}

export function tokenizeInlineContent(
    state: StateInline,
    content: NonNullable<InlineDirectiveParams['content']>,
): void {
    const oldPos = state.pos;
    const oldPosMax = state.posMax;

    state.pos = content.startPos;
    state.posMax = content.endPos;

    state.md.inline.tokenize(state);

    state.pos = oldPos;
    state.posMax = oldPosMax;
}

export function createBlockInlineToken(
    state: StateBlock,
    {inlineContent, startLine}: BlockDirectiveParams,
): MarkdownIt.Token {
    const token = state.push('inline', '', 0);
    token.children = [];
    token.content = inlineContent?.raw || '';
    token.map = [startLine, startLine + 1];
    return token;
}

export function tokenizeBlockContent(
    state: StateBlock,
    content: NonNullable<BlockDirectiveParams['content']>,
    parentType?: string,
): void {
    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;

    // @ts-expect-error bad types of state.parentType
    state.parentType = parentType ?? 'directive';
    state.line = content.startLine;
    state.lineMax = content.endLine;

    state.md.block.tokenize(state, content.startLine, content.endLine);

    state.lineMax = oldLineMax;
    state.parentType = oldParent;
}
