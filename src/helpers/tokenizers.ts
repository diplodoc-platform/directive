import type MarkdownIt from 'markdown-it';
import type {
    ContainerDirectiveParams,
    InlineDirectiveParams,
    LeafBlockDirectiveParams,
    StateBlock,
    StateInline,
} from '../types';

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

export function tokenizeBlockContent(
    state: StateBlock,
    content: NonNullable<ContainerDirectiveParams['content']>,
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

export function createBlockInlineToken(
    state: StateBlock,
    {inlineContent, startLine}: LeafBlockDirectiveParams,
): MarkdownIt.Token {
    const token = state.push('inline', '', 0);
    token.children = [];
    token.content = inlineContent?.raw || '';
    token.map = [startLine, startLine + 1];
    return token;
}
