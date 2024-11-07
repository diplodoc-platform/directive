/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type MarkdownIt from 'markdown-it';
import type {
    DirectiveBlockHandlerArgs,
    DirectiveInlineHandlerArgs,
    MarkdownItWithDirectives,
} from 'markdown-it-directive';
import type {
    BlockDirectiveConfig,
    BlockDirectiveHandler,
    BlockDirectiveParams,
    DirectiveAttrs,
    DirectiveDests,
    DirectiveDestsOrig,
    InlineDirectiveHandler,
    InlineDirectiveParams,
} from '../types';

import {isFunction, isString} from '../utils';

import {createBlockInlineToken, tokenizeBlockContent} from './tokenizers';

export function registerInlineDirective(
    md: MarkdownIt,
    name: string,
    handler: InlineDirectiveHandler,
): void {
    (md as MarkdownItWithDirectives).inlineDirectives[name] = (args) => {
        const params: InlineDirectiveParams = buildInlineParams(args);
        return handler(args.state, params);
    };
}

export function registerBlockDirective(md: MarkdownIt, config: BlockDirectiveConfig): void;
export function registerBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: BlockDirectiveHandler,
): void;
export function registerBlockDirective(
    md: MarkdownIt,
    nameOrConfig: string | BlockDirectiveConfig,
    maybeHandler?: BlockDirectiveHandler,
): void {
    const [name, handler]: [string, BlockDirectiveHandler] = isString(nameOrConfig)
        ? [nameOrConfig, maybeHandler!]
        : [nameOrConfig.name, buildContainerHandler(nameOrConfig)];

    (md as MarkdownItWithDirectives).blockDirectives[name] = (args) => {
        const params: BlockDirectiveParams = buildBlockParams(args);
        return handler(args.state, params);
    };
}

function buildContainerHandler(config: BlockDirectiveConfig): BlockDirectiveHandler {
    if (config.type !== 'container') {
        throw new Error(`Unknown type in ${config.name} directive config: ${config.type}`);
    }

    return (state, params) => {
        if (!params.content) {
            return false;
        }
        if (
            config.inlineContent &&
            !params.inlineContent &&
            config.inlineContent.required !== false
        ) {
            return false;
        }
        if (!config.match(params, state)) {
            return false;
        }

        const {container, inlineContent, content, contentTokenizer} = config;

        let token = state.push(container.token + '_open', container.tag, 1);
        token.map = [params.startLine, params.endLine];
        token.markup = ':::' + config.name;
        token.block = true;
        if (container.attrs) {
            const attrs: DirectiveAttrs = isFunction(container.attrs)
                ? container.attrs(params)
                : container.attrs;
            token.attrs = Object.entries(attrs);
        }

        if (inlineContent) {
            token = state.push(inlineContent.token + '_open', inlineContent.tag, 1);
            token.block = true;
            if (inlineContent.attrs) {
                const attrs: DirectiveAttrs = isFunction(inlineContent.attrs)
                    ? inlineContent.attrs(params)
                    : inlineContent.attrs;
                token.attrs = Object.entries(attrs);
            }

            token = createBlockInlineToken(state, params);

            token = state.push(inlineContent.token + '_close', inlineContent.tag, -1);
            token.block = true;
        }

        if (content) {
            token = state.push(content.token + '_open', content.tag, 1);
            token.map = [params.startLine + 1, params.endLine - 1];
            token.block = true;
            if (content.attrs) {
                const attrs: DirectiveAttrs = isFunction(content.attrs)
                    ? content.attrs(params)
                    : content.attrs;
                token.attrs = Object.entries(attrs);
            }
        }

        if (contentTokenizer) {
            contentTokenizer(state, params.content, params);
        } else {
            tokenizeBlockContent(state, params.content, config.name + '-directive');
        }

        if (content) {
            token = state.push(content.token + '_close', content.tag, -1);
            token.block = true;
        }

        token = state.push(container.token + '_close', container.tag, -1);
        token.block = true;

        return true;
    };
}

function buildInlineParams(args: DirectiveInlineHandlerArgs): InlineDirectiveParams {
    const params: InlineDirectiveParams = {
        startPos: args.directiveStart,
        endPos: args.directiveEnd,
    };
    if (args.attrs !== undefined) {
        // @ts-expect-error types fixed in markdown-it-directive@2.0.3
        params.attrs = args.attrs;
    }
    if (args.dests !== undefined) {
        params.dests = buildDests(
            // @ts-expect-error types fixed in markdown-it-directive@2.0.3
            args.dests,
        );
    }
    if (args.content !== undefined) {
        params.content = {
            raw: args.content,
            startPos: args.contentStart!,
            endPos: args.contentEnd!,
        };
    }
    return params;
}

function buildBlockParams(args: DirectiveBlockHandlerArgs): BlockDirectiveParams {
    const params: BlockDirectiveParams = {
        startLine: args.directiveStartLine,
        endLine: args.directiveEndLine,
    };
    if (args.attrs !== undefined) {
        // @ts-expect-error types fixed in markdown-it-directive@2.0.3
        params.attrs = args.attrs;
    }
    if (args.dests !== undefined) {
        params.dests = buildDests(
            // @ts-expect-error fix in https://github.com/hilookas/markdown-it-directive/pull/8
            args.dests,
        );
    }
    if (args.inlineContent !== undefined) {
        params.inlineContent = {
            raw: args.inlineContent,
            startPos: args.inlineContentStart!,
            endPos: args.inlineContentEnd!,
        };
    }
    if (args.content !== undefined) {
        params.content = {
            raw: args.content,
            startLine: args.contentStartLine!,
            endLine: args.contentEndLine!,
        };
    }
    return params;
}

function buildDests(orig: DirectiveDestsOrig): DirectiveDests {
    const dests: DirectiveDests = {_original_dests: orig};

    const link = orig.find((item) => item[0] === 'link')?.[1];
    const string = orig.find((item) => item[0] === 'string')?.[1];

    if (link !== undefined) {
        dests.link = link;
    }
    if (string !== undefined) {
        dests.string = string;
    }

    return dests;
}
