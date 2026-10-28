import MarkdownIt from 'markdown-it';

import {
    createBlockInlineToken,
    directiveParser,
    disableBlockDirectives,
    disableInlineDirectives,
    enableBlockDirectives,
    enableInlineDirectives,
    registerContainerDirective,
    registerInlineDirective,
    registerLeafBlockDirective,
    tokenizeBlockContent,
    tokenizeInlineContent,
} from '@diplodoc/directive';

const md = new MarkdownIt({html: true}).use(directiveParser());
md.use(directiveParser());
disableBlockDirectives(md);
enableBlockDirectives(md);
disableInlineDirectives(md);
enableInlineDirectives(md);

registerContainerDirective(
    md,
    'box',
    (state, params) => {
        const parsedValue: string | string[] | undefined = params.attrs?.example;
        // @ts-expect-error Repeated parsed values must be narrowed before use as a scalar.
        const scalarValue: string = params.attrs?.example;
        const nativeState: Parameters<Parameters<typeof md.block.ruler.push>[1]>[0] = state;
        const nativeTokenize = () =>
            state.md.block.tokenize(state, params.content.startLine, params.content.endLine);
        const line: number = state.line;
        const source: string = state.src;
        // @ts-expect-error Block state positions retain native numeric types.
        const invalidLine: string = state.line;
        // @ts-expect-error Parameter positions retain numeric types.
        const invalidStart: string = params.startLine;
        const token = state.push('box_open', 'section', 1);
        token.map = [params.startLine, params.endLine];
        const nativeToken: ReturnType<typeof md.parse>[number] = token;
        // @ts-expect-error Native token content remains a string.
        const invalidContent: number = token.content;
        tokenizeBlockContent(state, params.content);
        state.push('box_close', 'section', -1);
        return Array.isArray([
            parsedValue,
            scalarValue,
            line,
            source,
            invalidLine,
            invalidStart,
            nativeToken,
            invalidContent,
            nativeState,
            nativeTokenize,
        ]);
    },
    {onConflict: 'error'},
);

registerContainerDirective(md, {
    name: 'configured',
    match(params, state) {
        return params.startLine >= 0 && state.line >= 0;
    },
    container: {tag: 'section', token: 'configured'},
    inlineContent: {tag: 'header', token: 'configured_title', required: false},
    content: {tag: 'div', token: 'configured_content'},
    contentTokenizer(state, content, params) {
        const line: number = state.line;
        const title: string | undefined = params.inlineContent?.raw;
        tokenizeBlockContent(state, content, title ?? String(line));
    },
});

registerContainerDirective(md, {
    name: 'literal',
    type: 'code_block',
    match: (params, state) => params.content.endLine >= state.line,
    container: {tag: 'code', token: 'literal'},
});

registerLeafBlockDirective(md, 'leaf', (state, params) => {
    const token: ReturnType<typeof md.parse>[number] = createBlockInlineToken(state, params);
    const content: string = token.content;
    return content.length >= 0;
});
registerLeafBlockDirective(md, {
    name: 'configured-leaf',
    match: (params, state) => params.endLine > state.line,
    container: {tag: 'div', token: 'configured_leaf', attrs: {class: 'fixture'}},
});

registerInlineDirective(md, 'inline', (state, params) => {
    const nativeState: Parameters<Parameters<typeof md.inline.ruler.push>[1]>[0] = state;
    const nativeTokenize = () => state.md.inline.tokenize(state);
    const position: number = state.pos;
    const source: string = state.src;
    // @ts-expect-error Inline state retains native numeric position types.
    const invalidPosition: string = state.pos;
    // @ts-expect-error Inline parameter offsets retain numeric types.
    const invalidOffset: string = params.endPos;
    if (params.content) {
        tokenizeInlineContent(state, params.content);
    }
    return Array.isArray([
        position,
        source,
        invalidPosition,
        invalidOffset,
        nativeState,
        nativeTokenize,
    ]);
});

md.parse(':::box\ntext :inline[content]\n:::\n', {});
md.render('::leaf [title]\n');
