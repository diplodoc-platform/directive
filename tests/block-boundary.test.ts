import type {ContainerDirectiveParams, StateBlock} from '../src/types';

import MarkdownIt from 'markdown-it';
import {describe, expect, it, vi} from 'vitest';

import {
    directiveParser,
    registerContainerDirective,
    registerInlineDirective,
    registerLeafBlockDirective,
    tokenizeBlockContent,
    tokenizeInlineContent,
} from '../src';

function parser(options: MarkdownIt.Options = {}) {
    const md = new MarkdownIt(options).use(directiveParser());
    const calls: ContainerDirectiveParams[] = [];
    for (const name of ['box', 'inner', 'no-translate', 'visibility']) {
        registerContainerDirective(md, name, (state, params) => {
            calls.push(params);
            const token = state.push(name + '_open', 'section', 1);
            token.map = [params.startLine, params.endLine];
            tokenizeBlockContent(state, params.content);
            state.push(name + '_close', 'section', -1);
            return true;
        });
    }
    return {md, calls};
}

describe('container block boundaries', () => {
    it.each([
        ['bare code closer', '```text\n:::\n```'],
        ['named code opener', '```text\n:::example\n```'],
        ['long backtick fence', '````text\n```\n:::\n:::example\n````'],
        ['long tilde fence', '~~~~text\n~~~\n:::\n:::example\n~~~~~'],
        ['indented code', '    :::\n    :::example'],
        ['tab indented code', '\t:::\n\t:::example'],
        ['HTML comment', '<!--\n:::\n:::example\n-->'],
        ['HTML block', '<div>\n:::\n:::example\n</div>\n'],
        ['HTML script', '<script>\n:::\n:::example\n</script>'],
        ['list code', '- sample\n\n  ```\n  :::\n  :::example\n  ```'],
        ['nested list code', '- sample\n  - nested\n\n    ~~~~\n    :::\n    :::example\n    ~~~~'],
        ['quote code', '> ```\n> :::\n> :::example\n> ```'],
        ['quote HTML', '> <!--\n> :::\n> :::example\n> -->'],
    ])('preserves %s within the enclosing directive', (_name, body) => {
        const {md, calls} = parser({html: true});
        const source = `:::box\n${body}\n\nbody\n:::\nAFTER`;
        const tokens = md.parse(source, {});
        expect(calls).toHaveLength(1);
        expect(calls[0].content.raw).toBe(`${body}\n\nbody\n`);
        expect(calls[0].endLine).toBe(source.split('\n').length - 1);
        expect(tokens.at(-2)?.content).toBe('AFTER');
    });

    it.each([
        ['list', '- :::box\n  ```\n  :::\n  :::example\n  ```\n  :::\n\nAFTER'],
        ['quote', '> :::box\n> ```\n> :::\n> :::example\n> ```\n> :::\n\nAFTER'],
        [
            'list in quote',
            '> - :::box\n>   ~~~\n>   :::\n>   :::example\n>   ~~~\n>   :::\n\nAFTER',
        ],
    ])('finds a directive inside a %s', (_name, source) => {
        const {md, calls} = parser();
        const tokens = md.parse(source, {});
        expect(calls).toHaveLength(1);
        expect(calls[0].startLine).toBe(0);
        expect(calls[0].endLine).toBe(6);
        expect(tokens.find((token) => token.type === 'fence')?.content).toBe(':::\n:::example\n');
        expect(tokens.at(-2)?.content).toBe('AFTER');
    });

    it('keeps mixed lengths and balanced unknown and known nesting', () => {
        const {md, calls} = parser();
        md.parse(':::::box\n:::unknown\nbody\n::::\n::::inner\ninside\n:::\n::::::\nAFTER', {});
        // Unknown directives remain a paragraph; the existing renderer does not
        // interrupt that paragraph for a later known directive without a blank line.
        expect(calls.map(({startLine, endLine}) => [startLine, endLine])).toEqual([[0, 8]]);
        calls.length = 0;
        md.parse('::::box\n:::inner\nbody\n:::::\n:::\n', {});
        expect(calls.map(({startLine, endLine}) => [startLine, endLine])).toEqual([
            [0, 5],
            [1, 4],
        ]);
    });

    it('retains raw non-name opener balancing and malformed fallback', () => {
        const {md, calls} = parser();
        md.parse(':::box\n:::!example\nbody\n:::\n:::\nAFTER', {});
        expect(calls[0].endLine).toBe(5);
        calls.length = 0;
        md.parse(':::box\n:::\u00a0\nbody\n:::\n:::\nAFTER', {});
        expect(calls[0].endLine).toBe(5);
        calls.length = 0;
        expect(md.render(':::box\n:::unknown\nbody\n:::')).toContain(':::box');
        expect(calls).toEqual([]);
    });

    it('does not match an enclosing list directive to a closer outside its item', () => {
        const {md, calls} = parser();
        md.parse('- :::box\n  body\n\n:::\nAFTER', {});
        expect(calls).toEqual([]);
    });

    it.each([1, 200])(
        'finds outer closers after lazy list paragraphs in %s containers',
        (count) => {
            const {md, calls} = parser();
            const source = ':::box\nBody 0\n\n- item\n\n  code\n:::\n\n';
            const tokens = md.parse(source.repeat(count), {});
            expect(calls).toHaveLength(count);
            expect(calls[0].content.raw).toBe('Body 0\n\n- item\n\n  code\n');
            expect(calls.at(-1)?.endLine).toBe(count * 8 - 1);
            expect(tokens.filter(({type}) => type === 'box_open')).toHaveLength(count);
        },
    );

    it.each(['> quote', '- item\n\n  > quote', '- item\n  - nested\n\n    text'])(
        'finds an outer closer after lazy nested content: %s',
        (body) => {
            const {md, calls} = parser();
            md.parse(`:::box\n${body}\n:::\n`, {});
            expect(calls).toHaveLength(1);
            expect(calls[0].content.raw).toBe(body + '\n');
        },
    );

    it('keeps UTF-16 title offsets and normalized CRLF line positions', () => {
        const {md, calls} = parser();
        md.parse(':::box [Тест 😀] (url "title") {key=value} tail\r\nbody\r\n:::\r\n', {});
        expect(calls[0]).toEqual({
            startLine: 0,
            endLine: 3,
            inlineContent: {raw: 'Тест 😀', startPos: 8, endPos: 15},
            contentTitle: {raw: 'tail', startPos: 43, endPos: 47},
            attrs: {key: 'value'},
            dests: {
                link: 'url',
                string: 'title',
                _original_dests: [
                    ['link', 'url'],
                    ['string', 'title'],
                ],
            },
            content: {raw: 'body\n', startLine: 1, endLine: 2},
        });
    });

    it.each([true, false])('keeps native table enablement at %s', (enabled) => {
        const {md, calls} = parser();
        if (!enabled) {
            md.disable('table');
        }
        const tokens = md.parse(':::box\n| header |\n| --- |\n| :::example |\n\n:::\nAFTER', {});
        expect(calls).toHaveLength(1);
        expect(calls[0].endLine).toBe(6);
        expect(tokens.some(({type}) => type === 'table_open')).toBe(enabled);
    });

    it('preserves indented marker matching when the host disables indented code', () => {
        const {md, calls} = parser();
        md.disable('code');
        md.parse('    :::box\n    body\n    :::\nAFTER', {});
        expect(calls).toHaveLength(1);
        expect(calls[0].content.raw).toBe('body\n');
    });

    it.each([
        {disabled: ['paragraph']},
        {
            disabled: [
                'table',
                'code',
                'fence',
                'blockquote',
                'hr',
                'list',
                'reference',
                'html_block',
                'heading',
                'lheading',
                'paragraph',
            ],
        },
    ])(
        'allows a handler to consume literal content with native rules disabled: %j',
        ({disabled}) => {
            const md = new MarkdownIt().disable(disabled).use(directiveParser());
            let raw: string | undefined;
            registerContainerDirective(md, 'box', (_state, params) => {
                raw = params.content.raw;
                return true;
            });
            expect(() => md.parse(':::box\nplain text\n:::\n', {})).not.toThrow();
            expect(raw).toBe('plain text\n');
        },
    );

    it('keeps inline, leaf, no-translate and visibility handlers active', () => {
        const {md, calls} = parser();
        const inline = vi.fn((state, params) => {
            tokenizeInlineContent(state, params.content);
            return true;
        });
        const leaf = vi.fn(() => true);
        registerInlineDirective(md, 'no-translate', inline);
        registerLeafBlockDirective(md, 'visibility', leaf);
        md.parse(
            ':::no-translate\n:::visibility\n:no-translate[text]\n\n::visibility\n:::\n:::\n',
            {},
        );
        expect(calls).toHaveLength(2);
        expect(inline).toHaveBeenCalledTimes(1);
        expect(leaf).toHaveBeenCalledTimes(1);
    });

    it('runs no installed custom rule or callback during discovery', () => {
        const {md, calls} = parser();
        const env = {counter: 0};
        let visits = 0;
        md.block.ruler.before('code', 'sentinel', (state) => {
            expect(state.env).toBe(env);
            visits++;
            return false;
        });
        const handler = vi.fn((state: StateBlock, params: ContainerDirectiveParams) => {
            expect(state.env).toBe(env);
            expect(Object.hasOwn(state, 'skipChars')).toBe(false);
            env.counter++;
            tokenizeBlockContent(state, params.content);
            return true;
        });
        registerContainerDirective(md, 'count', handler);
        md.parse(':::count\n- item\n\n  > ```\n  > :::example\n  > ```\n:::', env);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(env.counter).toBe(1);
        expect(visits).toBeGreaterThan(0);
        expect(calls).toHaveLength(0);
    });

    it('restores method ownership before a throwing or reentrant handler', () => {
        const {md} = parser();
        let captured: StateBlock | undefined;
        registerContainerDirective(md, 'throw', (state) => {
            captured = state;
            expect(Object.hasOwn(state, 'skipChars')).toBe(false);
            md.parse(':::box\n```\n:::\n```\n:::', {});
            throw new Error('handler error');
        });
        expect(() => md.parse(':::throw\nbody\n:::', {})).toThrow('handler error');
        expect(Object.getOwnPropertyDescriptor(captured, 'skipChars')).toBeUndefined();
    });

    it('restores an existing own method descriptor if header parsing throws', () => {
        const {md} = parser();
        let captured: StateBlock | undefined;
        let descriptor: PropertyDescriptor | undefined;
        md.block.ruler.before('block_directive', 'own_method', (state) => {
            captured = state;
            const original = state.skipChars;
            Object.defineProperty(state, 'skipChars', {
                value: function (this: StateBlock, pos: number, code: number) {
                    expect(this).toBe(state);
                    return original.call(this, pos, code);
                },
                writable: true,
                configurable: true,
            });
            descriptor = Object.getOwnPropertyDescriptor(state, 'skipChars');
            return false;
        });
        md.helpers.parseLinkLabel = () => {
            throw new Error('header error');
        };
        expect(() => md.parse(':::box [title]\nbody\n:::', {})).toThrow('header error');
        expect(Object.getOwnPropertyDescriptor(captured, 'skipChars')).toEqual(descriptor);
    });
});
