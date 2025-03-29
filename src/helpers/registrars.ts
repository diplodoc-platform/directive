/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type MarkdownIt from 'markdown-it';
import type {
    DirectiveBlockHandler,
    DirectiveBlockHandlerArgs,
    DirectiveInlineHandlerArgs,
    MarkdownItWithDirectives,
} from 'markdown-it-directive';
import type {
    CodeContainerDirectiveConfig,
    ContainerDirectiveConfig,
    ContainerDirectiveHandler,
    ContainerDirectiveParams,
    DirectiveAttrs,
    DirectiveDests,
    DirectiveDestsOrig,
    InlineDirectiveHandler,
    InlineDirectiveParams,
    LeafBlockDirectiveHandler,
    LeafBlockDirectiveParams,
    MdItWithHandlers,
    TokensDesc,
} from '../types';

import {isFunction, isString} from '../utils';
import {CONTAINER_KEY, LEAF_BLOCK_KEY} from '../const';

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

export function registerLeafBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: LeafBlockDirectiveHandler,
): void {
    (md as MdItWithHandlers)[LEAF_BLOCK_KEY] ||= {};
    (md as MdItWithHandlers)[LEAF_BLOCK_KEY][name] = handler;

    (md as MarkdownItWithDirectives).blockDirectives[name] = getBlockDefaultHandler(md, name);
}

export function registerContainerDirective(
    md: MarkdownIt,
    config: ContainerDirectiveConfig | CodeContainerDirectiveConfig,
): void;
export function registerContainerDirective(
    md: MarkdownIt,
    name: string,
    handler: ContainerDirectiveHandler,
): void;
export function registerContainerDirective(
    md: MarkdownIt,
    nameOrConfig: string | ContainerDirectiveConfig | CodeContainerDirectiveConfig,
    maybeHandler?: ContainerDirectiveHandler,
): void {
    const [name, handler]: [string, ContainerDirectiveHandler] = isString(nameOrConfig)
        ? [nameOrConfig, maybeHandler!]
        : [
              nameOrConfig.name,
              nameOrConfig.type === 'code_block'
                  ? buildCodeContainerHandler(nameOrConfig)
                  : buildContainerHandler(nameOrConfig),
          ];

    (md as MdItWithHandlers)[CONTAINER_KEY] ||= {};
    (md as MdItWithHandlers)[CONTAINER_KEY][name] = handler;

    (md as MarkdownItWithDirectives).blockDirectives[name] = getBlockDefaultHandler(md, name);
}

function getBlockDefaultHandler(md: MarkdownIt, name: string): DirectiveBlockHandler {
    return (args) => {
        const containerHandler = (md as MdItWithHandlers)[CONTAINER_KEY]?.[name];
        const leafBlockHandler = (md as MdItWithHandlers)[LEAF_BLOCK_KEY]?.[name];

        if (isString(args.content)) {
            if (containerHandler) {
                return containerHandler(args.state, buildContainerParams(args));
            }
        } else if (leafBlockHandler) {
            return leafBlockHandler(args.state, buildLeafBlockParams(args));
        }

        return false;
    };
}

function buildContainerHandler(config: ContainerDirectiveConfig): ContainerDirectiveHandler {
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
        applyTokenFields(token, container, params);

        if (inlineContent) {
            token = state.push(inlineContent.token + '_open', inlineContent.tag, 1);
            applyTokenFields(token, inlineContent, params);

            token = createBlockInlineToken(state, params);

            token = state.push(inlineContent.token + '_close', inlineContent.tag, -1);
        }

        if (content) {
            token = state.push(content.token + '_open', content.tag, 1);
            token.map = [params.startLine + 1, params.endLine - 1];
            applyTokenFields(token, content, params);
        }

        if (contentTokenizer) {
            contentTokenizer(state, params.content, params);
        } else {
            tokenizeBlockContent(state, params.content, config.name + '-directive');
        }

        if (content) {
            token = state.push(content.token + '_close', content.tag, -1);
        }

        token = state.push(container.token + '_close', container.tag, -1);

        return true;
    };
}

function buildCodeContainerHandler(
    config: CodeContainerDirectiveConfig,
): ContainerDirectiveHandler {
    return (state, params) => {
        if (!params.content) {
            return false;
        }
        if (!config.match(params, state)) {
            return false;
        }

        const {name, container} = config;

        const token = state.push(container.token, container.tag, 0);
        // set fields like for fence token
        token.map = [params.startLine, params.endLine];
        token.content = params.content.raw;
        token.markup = ':::';
        token.info = name;
        applyTokenFields(token, container, params);

        return true;
    };
}

function buildInlineParams(args: DirectiveInlineHandlerArgs): InlineDirectiveParams {
    const params: InlineDirectiveParams = {
        startPos: args.directiveStart,
        endPos: args.directiveEnd,
    };
    if (args.attrs !== undefined) {
        params.attrs = args.attrs;
    }
    if (args.dests !== undefined) {
        params.dests = buildDests(args.dests);
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

function buildLeafBlockParams(args: DirectiveBlockHandlerArgs): LeafBlockDirectiveParams {
    const params: LeafBlockDirectiveParams = {
        startLine: args.directiveStartLine,
        endLine: args.directiveEndLine,
    };
    if (args.attrs !== undefined) {
        params.attrs = args.attrs;
    }
    if (args.dests !== undefined) {
        params.dests = buildDests(args.dests);
    }
    if (args.inlineContent !== undefined) {
        params.inlineContent = {
            raw: args.inlineContent,
            startPos: args.inlineContentStart!,
            endPos: args.inlineContentEnd!,
        };
    }
    return params;
}

function buildContainerParams(args: DirectiveBlockHandlerArgs): ContainerDirectiveParams {
    const params = buildLeafBlockParams(args);
    return {
        ...params,
        content: {
            raw: args.content!,
            startLine: args.contentStartLine!,
            endLine: args.contentEndLine!,
        },
    };
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

function applyTokenFields<P>(
    token: MarkdownIt.Token,
    {attrs, meta}: TokensDesc<P>,
    params: P,
): void {
    if (attrs !== undefined) {
        const value: DirectiveAttrs = isFunction(attrs) ? attrs(params) : attrs;
        token.attrs = Object.entries(value);
    }
    if (meta !== undefined) {
        const value: object = isFunction(meta) ? meta(params) : meta;
        token.meta = value;
    }
}
