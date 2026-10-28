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
