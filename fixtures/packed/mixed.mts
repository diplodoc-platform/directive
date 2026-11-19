import MarkdownIt from 'markdown-it';
import MarkdownIt15 from 'markdown-it-transform15';

import {
    createBlockInlineToken,
    directiveParser,
    registerContainerDirective,
    registerInlineDirective,
    registerLeafBlockDirective,
    tokenizeBlockContent,
    tokenizeInlineContent,
} from '@diplodoc/directive';

const oldHost = new MarkdownIt().use(directiveParser());
const newHost = new MarkdownIt15().use(directiveParser());
type OldBlock = InstanceType<typeof oldHost.block.State>;
type NewBlock = InstanceType<typeof newHost.block.State>;
type OldInline = InstanceType<typeof oldHost.inline.State>;
type NewInline = InstanceType<typeof newHost.inline.State>;

registerContainerDirective(oldHost, 'old', (state: OldBlock) => state.line >= 0);
registerContainerDirective(newHost, 'new', (state: NewBlock) => state.line >= 0);
registerLeafBlockDirective(oldHost, 'old', (state: OldBlock) => state.line >= 0);
registerLeafBlockDirective(newHost, 'new', (state: NewBlock) => state.line >= 0);
registerInlineDirective(oldHost, 'old', (state: OldInline) => state.pos >= 0);
registerInlineDirective(newHost, 'new', (state: NewInline) => state.pos >= 0);

registerContainerDirective(newHost, {
    name: 'configured',
    match: (_params, state) => {
        const native: NewBlock = state;
        return native.line >= 0;
    },
    container: {tag: 'section', token: 'section'},
    contentTokenizer(state: NewBlock, content) {
        tokenizeBlockContent(state, content);
    },
});
registerLeafBlockDirective(newHost, {
    name: 'leaf',
    match: (params, state) => {
        const native: NewBlock = state;
        const token: ReturnType<typeof newHost.parse>[number] = createBlockInlineToken(
            native,
            params,
        );
        token.attrs = [['number', 1]];
        return token.content.length >= 0;
    },
    container: {tag: 'div', token: 'leaf'},
});
registerInlineDirective(newHost, 'inline', (state, params) => {
    const native: NewInline = state;
    if (params.content) tokenizeInlineContent(native, params.content);
    return native.pos >= 0;
});

// @ts-expect-error Native 13 handlers cannot process native 15 block states.
registerContainerDirective(newHost, 'wrong', (state: OldBlock) => state.line >= 0);
// @ts-expect-error Native 13 handlers cannot process native 15 leaf states.
registerLeafBlockDirective(newHost, 'wrong', (state: OldBlock) => state.line >= 0);
// @ts-expect-error Native 13 handlers cannot process native 15 inline states.
registerInlineDirective(newHost, 'wrong', (state: OldInline) => state.pos >= 0);
registerLeafBlockDirective(newHost, {
    name: 'wrong',
    // @ts-expect-error Config inference must not select another host's block state.
    match: (_params, state: OldBlock) => state.line >= 0,
    container: {tag: 'div', token: 'leaf'},
});
registerContainerDirective(newHost, {
    name: 'wrong',
    match: () => true,
    container: {tag: 'div', token: 'box'},
    // @ts-expect-error Content tokenizer must belong to the actual native host.
    contentTokenizer: (state: OldBlock) => {
        state.line++;
    },
});

// @ts-expect-error A handler cannot require fields absent from its host's native state.
registerContainerDirective(newHost, 'narrow', (state: NewBlock & {custom: true}) => state.custom);
