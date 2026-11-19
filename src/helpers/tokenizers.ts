import type {BlockContentState, DirectiveToken, InlineContentState} from '../markdown-it';
import type {
    ContainerDirectiveParams,
    InlineDirectiveParams,
    LeafBlockDirectiveParams,
} from '../types';

export function tokenizeInlineContent<I extends InlineContentState<I>>(
    state: I,
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

export function tokenizeBlockContent<B extends BlockContentState<B>>(
    state: B,
    content: NonNullable<ContainerDirectiveParams['content']>,
    parentType?: string,
): void {
    const oldParent = state.parentType;
    const oldLineMax = state.lineMax;

    state.parentType = parentType ?? 'directive';
    state.line = content.startLine;
    state.lineMax = content.endLine;

    state.md.block.tokenize(state, content.startLine, content.endLine);

    state.lineMax = oldLineMax;
    state.parentType = oldParent;
}

export function createBlockInlineToken<T extends DirectiveToken>(
    state: {push(type: string, tag: string, nesting: -1 | 0 | 1): T},
    {inlineContent, startLine}: LeafBlockDirectiveParams,
): T {
    const token = state.push('inline', '', 0);
    token.children = [];
    token.content = inlineContent?.raw || '';
    token.map = [startLine, startLine + 1];
    return token;
}
