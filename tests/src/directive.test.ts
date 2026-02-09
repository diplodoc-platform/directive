/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type MarkdownIt from 'markdown-it';
import type {ContainerDirectiveParams, InlineDirectiveParams, LeafBlockDirectiveParams} from '@diplodoc/directive';

import MarkdownItImpl from 'markdown-it';
import transform from '@diplodoc/transform';
import {describe, expect, it, vi} from 'vitest';
import dd from 'ts-dedent';

import {
    createBlockInlineToken,
    directiveParser,
    disableBlockDirectives,
    disableInlineDirectives,
    registerContainerDirective,
    registerInlineDirective,
    registerLeafBlockDirective,
    tokenizeBlockContent,
    tokenizeInlineContent,
} from '@diplodoc/directive';

const html = (text: string, {plugins}: {plugins?: MarkdownIt.PluginSimple[]} = {}) => {
    const {result} = transform(text, {
        plugins: [directiveParser(), ...(plugins || [])],
    });

    return result.html;
};

describe('Directive', () => {
    it.skip('should not parse inline directive by default', () => {
        const md = new MarkdownItImpl().use(directiveParser());
        const inlineHandler = vi.fn(() => false);
        const leafHandler = vi.fn(() => false);
        const blockHandler = vi.fn(() => false);
        registerInlineDirective(md, 'inl', inlineHandler);
        registerLeafBlockDirective(md, 'leaf', leafHandler);
        registerContainerDirective(md, 'blck', blockHandler);
        md.parse(
            dd`
            :inl[]

            ::leaf()

            :::blck{}
            
            :::
        `,
            {},
        );
        expect(inlineHandler).not.toHaveBeenCalled();
        expect(leafHandler).toHaveBeenCalledTimes(1);
        expect(blockHandler).toHaveBeenCalledTimes(1);
    });

    describe('inline', () => {
        it('should call handler when parse inline directive', () => {
            const handler = vi.fn(() => false);
            html('text before :abcdef[](){} text after', {
                plugins: [(md) => registerInlineDirective(md, 'abcdef', handler)],
            });
            expect(handler).toHaveBeenCalled();
        });

        it('should call inline handler and pass two arguments', () => {
            const handler = vi.fn(() => false);
            html('text before :abcdef[](){} text after', {
                plugins: [(md) => registerInlineDirective(md, 'abcdef', handler)],
            });
            expect(handler.mock.calls[0].length).toBe(2);
        });

        it('should call inline handler and pass right directive params', () => {
            const handler = vi.fn(() => false);
            html('text before :abcdef[](){} text after', {
                plugins: [(md) => registerInlineDirective(md, 'abcdef', handler)],
            });
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual<InlineDirectiveParams>({
                attrs: {},
                content: {
                    endPos: 20,
                    raw: '',
                    startPos: 20,
                },
                dests: {_original_dests: []},
                endPos: 25,
                startPos: 12,
            });
        });

        it('should parse inline content, dests and attrs in inline directive', () => {
            const handler = vi.fn(() => false);
            html(
                'text before :dir["inline _content_"](path/to/smth "text" "test2" id-of-smth){abc=def flag=true attr="value"} text after',
                {plugins: [(md) => registerInlineDirective(md, 'dir', handler)]},
            );
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toMatchSnapshot();
        });

        it('should not parse attrs in inline directive', () => {
            const handler = vi.fn(() => false);
            html('text before :dir[](){attr} text after', {
                plugins: [(md) => registerInlineDirective(md, 'dir', handler)],
            });
            // info: parses attrs as undefined
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual<InlineDirectiveParams>({
                content: {
                    endPos: 17,
                    raw: '',
                    startPos: 17,
                },
                dests: {_original_dests: []},
                endPos: 20,
                startPos: 12,
            });
        });

        it('should parse inline directive without parameters', () => {
            const handler = vi.fn(() => false);
            html('text before :dir text after', {
                plugins: [(md) => registerInlineDirective(md, 'dir', handler)],
            });
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual({
                endPos: 16,
                startPos: 12,
            });
        });

        it('should parse inline directive in text without separators', () => {
            const handler = vi.fn(() => false);
            html('before:dir', {plugins: [(md) => registerInlineDirective(md, 'dir', handler)]});
            expect(handler).toHaveBeenCalled();
        });

        it('should not throw error when parsing something like inline directive and reference link', () => {
            /*
                Caught a bug that if there is something similar to an inline directive and a reference link,
                it will be considered an inline directive and will fail during parsing
                https://github.com/hilookas/markdown-it-directive/blob/master/index.js#L224

                example to reproduce this bug:
            */
            const markup = dd`
                [aa:aa](aa.com)

                [xx]: bb.com
            `;
            const fn = vi.fn(() => {
                html(markup);
            });
            try {
                fn();
            } catch {
                // ignore
            }
            expect(fn).not.toThrow();
        });

        it('should not throw error with disabled parsing of inline directives', () => {
            const markup = dd`
                [aa:aa](aa.com)

                [xx]: bb.com
            `;
            const fn = vi.fn(() => {
                html(markup, {plugins: [(md) => disableInlineDirectives(md)]});
            });
            try {
                fn();
            } catch {
                // ignore
            }
            expect(fn).not.toThrow();
        });

        it('markdown-it-attrs should add attributes to em content inside content of inline directive', () => {
            const res = html('para :inl[aa _bb_{.dd} cc] after', {
                plugins: [
                    (md) => {
                        registerInlineDirective(md, 'inl', (state, params) => {
                            if (!params.content) {
                                return false;
                            }

                            state.push('inl_open', 'span', 1);
                            tokenizeInlineContent(state, params.content);
                            state.push('inl_close', 'span', -1);

                            return true;
                        });
                    },
                ],
            });
            expect(res).toStrictEqual(
                '<p>para <span>aa <em class="dd">bb</em> cc</span> after</p>\n',
            );
        });

        it('markdown-it-attrs should add attributes to inline directive', () => {
            const res = html('para :inl[]{label=first}{#second} after', {
                plugins: [
                    (md) => {
                        registerInlineDirective(md, 'inl', (state, params) => {
                            if (params.content === undefined) {
                                return false;
                            }

                            const token = state.push('inl_open', 'span', 1);
                            if (params.attrs) {
                                token.attrs = Object.entries(params.attrs);
                            }
                            tokenizeInlineContent(state, params.content);
                            state.push('inl_close', 'span', -1);

                            return true;
                        });
                    },
                ],
            });
            expect(res).toStrictEqual(
                '<p>para <span label="first" id="second"></span> after</p>\n',
            );
        });
    });

    describe('leaf block', () => {
        it('should parse directive without parameters', () => {
            const handler = vi.fn(() => false);
            html('::leaf', {plugins: [(md) => registerLeafBlockDirective(md, 'leaf', handler)]});
            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual<LeafBlockDirectiveParams>({
                endLine: 1,
                startLine: 0,
            });
        });

        it('should parse directive with empty parameters', () => {
            const handler = vi.fn(() => false);
            html('::leaf[](){}', {
                plugins: [(md) => registerLeafBlockDirective(md, 'leaf', handler)],
            });
            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual<LeafBlockDirectiveParams>({
                attrs: {},
                dests: {_original_dests: []},
                endLine: 1,
                inlineContent: {
                    endPos: 7,
                    raw: '',
                    startPos: 7,
                },
                startLine: 0,
            });
        });

        it('should add handler via config', () => {
            const md = new MarkdownItImpl().use(directiveParser());
            registerLeafBlockDirective(md, {
                name: 'blck',
                match: ({attrs}, state) => {
                    state.env.blck_env = 'this is blck leaf directive';
                    return Boolean(attrs?.['data-block']);
                },
                container: {
                    token: 'leaf-block',
                    tag: 'div',
                    attrs: ({attrs}, env) => ({
                        'data-block': attrs!['data-block'],
                        'data-env': env.blck_env,
                    }),
                    meta: ({attrs}, env) => ({
                        leaf: true,
                        data: attrs!['data-block'],
                        env: env.blck_env,
                    }),
                },
            });
            const tokens = md.parse(
                dd`


                :: blck {data-block=2}
                `,
                {},
            );
            expect(tokens).toMatchSnapshot();
        });
    });

    describe('block with content', () => {
        it('should parse directive without parameters', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::block
                
                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'block', handler)]},
            );
            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual({
                content: {
                    endLine: 2,
                    raw: '\n',
                    startLine: 1,
                },
                endLine: 3,
                startLine: 0,
            });
        });

        it('should parse directive with empty parameters', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::block[](){}
                content
                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'block', handler)]},
            );
            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual<ContainerDirectiveParams>({
                attrs: {},
                content: {
                    endLine: 2,
                    raw: 'content\n',
                    startLine: 1,
                },
                dests: {_original_dests: []},
                endLine: 3,
                inlineContent: {
                    endPos: 9,
                    raw: '',
                    startPos: 9,
                },
                startLine: 0,
            });
        });

        it('should pass raw content', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::dir
                
                > - list in qoute

                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'dir', handler)]},
            );
            // @ts-expect-error
            const params: ContainerDirectiveParams = handler.mock.calls[0][1];
            expect(params.content.raw).toStrictEqual(dd`

                > - list in qoute


            `);
        });

        it('should not not handle inner directive', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::dir
                before

                :::another
                inner
                :::

                after
                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'dir', handler)]},
            );
            // @ts-expect-error
            const params: ContainerDirectiveParams = handler.mock.calls[0][1];
            expect(params.content.raw).toStrictEqual(dd`
                before

                :::another
                inner
                :::

                after

            `);
        });

        it('should ignore second closing markup', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::test
                test content
                :::

                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'test', handler)]},
            );
            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            const params: ContainerDirectiveParams = handler.mock.calls[0][1];
            expect(params).toStrictEqual({
                content: {
                    endLine: 2,
                    raw: 'test content\n',
                    startLine: 1,
                },
                endLine: 3,
                startLine: 0,
            });
        });

        it('should add code container handler via config', () => {
            const md = new MarkdownItImpl().use(directiveParser());
            registerContainerDirective(md, {
                name: 'js',
                type: 'code_block',
                match: () => true,
                container: {
                    token: 'code_js',
                    tag: 'code',
                    attrs: {class: 'code-js'},
                    meta: {code: true, lang: 'js'},
                },
            });
            const tokens = md.parse(
                dd`


                :::js
                (function(window) {
                window.alert('Hello world!');
                })(window);
                :::
                `,
                {},
            );
            expect(tokens).toMatchSnapshot();
        });

        it('should parse directive with "-" at first content line', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::block
                -
                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'block', handler)]},
            );

            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual({
                content: {
                    endLine: 2,
                    raw: '-\n',
                    startLine: 1,
                },
                endLine: 3,
                startLine: 0,
            });
        });

        it('should parse directive with "=" at first content line', () => {
            const handler = vi.fn(() => false);
            html(
                dd`
                :::block
                =
                :::
                `,
                {plugins: [(md) => registerContainerDirective(md, 'block', handler)]},
            );

            expect(handler).toHaveBeenCalledTimes(1);
            // @ts-expect-error
            expect(handler.mock.calls[0][1]).toStrictEqual({
                content: {
                    endLine: 2,
                    raw: '=\n',
                    startLine: 1,
                },
                endLine: 3,
                startLine: 0,
            });
        });
    });

    describe('helpers', () => {
        describe('disableBlockDirectives and disableBlockDirectives', () => {
            it('should ignore inline directives', () => {
                const inlineHandler = vi.fn(() => false);
                const leafHandler = vi.fn(() => false);
                const blockHandler = vi.fn(() => false);
                html(
                    dd`
                    :inline

                    ::leaf

                    :::block

                    :::
                    `,
                    {
                        plugins: [
                            (md) => {
                                registerInlineDirective(md, 'inline', inlineHandler);
                                registerLeafBlockDirective(md, 'leaf', leafHandler);
                                registerContainerDirective(md, 'block', blockHandler);
                                disableInlineDirectives(md);
                            },
                        ],
                    },
                );
                expect(inlineHandler).not.toHaveBeenCalled();
                expect(leafHandler).toHaveBeenCalledTimes(1);
                expect(blockHandler).toHaveBeenCalledTimes(1);
            });

            it('should ignore block directives', () => {
                const inlineHandler = vi.fn(() => false);
                const leafHandler = vi.fn(() => false);
                const blockHandler = vi.fn(() => false);
                html(
                    dd`
                    :inline

                    ::leaf

                    :::block

                    :::
                    `,
                    {
                        plugins: [
                            (md) => {
                                registerInlineDirective(md, 'inline', inlineHandler);
                                registerLeafBlockDirective(md, 'leaf', leafHandler);
                                registerContainerDirective(md, 'block', blockHandler);
                                disableBlockDirectives(md);
                            },
                        ],
                    },
                );
                expect(inlineHandler).toHaveBeenCalledTimes(1);
                expect(leafHandler).not.toHaveBeenCalled();
                expect(blockHandler).not.toHaveBeenCalled();
            });
        });

        describe('tokenizeBlockContent', () => {
            it('should parse nested directive', () => {
                const md = new MarkdownItImpl().use(directiveParser());
                registerContainerDirective(md, 'test', (state, {content}) => {
                    if (content) {
                        tokenizeBlockContent(state, content);
                        return true;
                    }
                    return false;
                });
                const tokens = md.parse(
                    dd`
                    before test

                    :::test

                    before inner test

                    :::test

                    > _inner inner content_

                    :::

                    after inner test

                    :::

                    after test
                `,
                    {},
                );
                expect(tokens).toMatchSnapshot();
            });
        });

        describe('tokenizeInlineContent', () => {
            it('should parse content in inline directive', () => {
                const md = new MarkdownItImpl().use(directiveParser());
                registerInlineDirective(md, 'inl', (state, params) => {
                    if (!params.content) {
                        return false;
                    }

                    state.push('inl_open', 'span', 1);
                    tokenizeInlineContent(state, params.content);
                    state.push('inl_close', 'span', -1);

                    return true;
                });
                const tokens = md.parse(
                    dd`
                    text :inl[*aa* __bb__ ~~cc~~] text2
                `,
                    {},
                );
                expect(tokens).toMatchSnapshot();
            });
        });

        describe('createBlockInlineToken', () => {
            it('should parse inline content in block diagram', () => {
                const md = new MarkdownItImpl().use(directiveParser());
                registerLeafBlockDirective(md, 'blck', (state, params) => {
                    if (!params.inlineContent) {
                        return false;
                    }

                    state.push('blck_open', 'div', 1);
                    createBlockInlineToken(state, params);
                    state.push('blck_close', 'div', -1);

                    return true;
                });
                const tokens = md.parse(
                    dd`
                    ::blck[*aa* __bb__ ~~cc~~]
                `,
                    {},
                );
                expect(tokens).toMatchSnapshot();
            });
        });
    });
});
