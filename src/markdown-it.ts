import type * as MarkdownItPackage from 'markdown-it' with {'resolution-mode': 'import'};

type Package = typeof MarkdownItPackage;

export type MarkdownItConstructor = Package extends {default: infer Default} ? Default : Package;
export type MarkdownIt = MarkdownItConstructor extends abstract new (
    ...args: infer Args
) => infer Instance
    ? Args extends unknown[]
        ? Instance
        : never
    : never;

export type Token = ReturnType<MarkdownIt['parse']>[number];
export type BlockRule = Parameters<MarkdownIt['block']['ruler']['push']>[1];
export type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1];
export type StateBlock = Parameters<BlockRule>[0];
export type StateInline = Parameters<InlineRule>[0];
export type PluginSimple = (md: MarkdownIt) => void;

/** Fields written by the directive helpers; attribute writes remain strings on every host. */
export interface DirectiveToken {
    get attrs(): readonly (readonly [string, string | number])[] | null;
    set attrs(value: [string, string][] | null);
    map: [number, number] | null;
    markup: string;
    content: string;
    info: string;
    get children(): readonly unknown[] | null;
    set children(value: [] | null);
    meta: unknown;
}

export type BlockContentState<B> = {
    env: unknown;
    parentType: string;
    line: number;
    lineMax: number;
    push(type: string, tag: string, nesting: -1 | 0 | 1): DirectiveToken;
    md: {block: {tokenize(state: B, start: number, end: number): void}};
};

export type InlineContentState<I> = {
    src: string;
    pos: number;
    posMax: number;
    md: {inline: {tokenize(state: I): void}};
};

/** Public parser installation operations, tied to the actual host's state constructors. */
export type DirectiveHost<B, I> = {
    block: {
        State: abstract new (...args: never[]) => B;
        ruler: {
            before(
                name: string,
                ruleName: string,
                rule: (state: B, start: number, end: number, silent: boolean) => boolean,
            ): void;
        };
    };
    inline: {
        State: abstract new (...args: never[]) => I;
        ruler: {push(name: string, rule: (state: I, silent: boolean) => boolean): void};
    };
};

export type BlockHost<B> = {block: {State: abstract new (...args: never[]) => B}};
export type InlineHost<I> = {inline: {State: abstract new (...args: never[]) => I}};
