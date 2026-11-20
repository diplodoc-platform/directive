/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {BlockContentState, BlockHost, DirectiveToken, InlineHost} from '../markdown-it';
import type {DirectiveBlockHandlerArgs, DirectiveInlineHandlerArgs} from '../upstream';
import type {
    CodeContainerDirectiveConfig,
    ContainerDirectiveConfig,
    ContainerDirectiveHandler,
    ContainerDirectiveParams,
    DirectiveDests,
    DirectiveDestsOrig,
    Env,
    InlineDirectiveHandler,
    InlineDirectiveParams,
    LeafBlockDirectiveConfig,
    LeafBlockDirectiveHandler,
    LeafBlockDirectiveParams,
    TokensDesc,
} from '../types';

import {isFunction, isString} from '../utils';
import {CONTAINER_KEY, LEAF_BLOCK_KEY} from '../const';
import {assertHostState, invokeHandler, lookupHandler, registry} from '../runtime';

import {createBlockInlineToken, tokenizeBlockContent} from './tokenizers';

export function registerInlineDirective<I>(
    md: InlineHost<I>,
    name: string,
    handler: InlineDirectiveHandler<NoInfer<I>>,
): void {
    registry(md, 'inlineDirectives')[name] = (args: DirectiveInlineHandlerArgs<unknown>) => {
        assertHostState(args.state, md.inline.State);
        const params: InlineDirectiveParams = buildInlineParams(args);
        return handler(args.state, params);
    };
}

export function registerLeafBlockDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    config: LeafBlockDirectiveConfig<NoInfer<B>>,
): void;
export function registerLeafBlockDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    name: string,
    handler: LeafBlockDirectiveHandler<NoInfer<B>>,
): void;
export function registerLeafBlockDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    nameOrConfig: string | LeafBlockDirectiveConfig<B>,
    maybeHandler?: LeafBlockDirectiveHandler<B>,
): void {
    const [name, handler]: [string, LeafBlockDirectiveHandler<B>] = isString(nameOrConfig)
        ? [nameOrConfig, maybeHandler!]
        : [nameOrConfig.name, buildLeafBlockHandler(nameOrConfig)];

    registry(md, LEAF_BLOCK_KEY, true);
    registry(md, LEAF_BLOCK_KEY)[name] = handler;

    registry(md, 'blockDirectives')[name] = getBlockDefaultHandler(md, name);
}

export function registerContainerDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    config: ContainerDirectiveConfig<NoInfer<B>> | CodeContainerDirectiveConfig<NoInfer<B>>,
): void;
export function registerContainerDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    name: string,
    handler: ContainerDirectiveHandler<NoInfer<B>>,
    options?: {onConflict?: 'replace' | 'error'},
): void;
export function registerContainerDirective<B extends BlockContentState<B>>(
    md: BlockHost<B>,
    nameOrConfig: string | ContainerDirectiveConfig<B> | CodeContainerDirectiveConfig<B>,
    maybeHandler?: ContainerDirectiveHandler<B>,
    options?: {onConflict?: 'replace' | 'error'},
): void {
    const [name, handler]: [string, ContainerDirectiveHandler<B>] = isString(nameOrConfig)
        ? [nameOrConfig, maybeHandler!]
        : [
              nameOrConfig.name,
              nameOrConfig.type === 'code_block'
                  ? buildCodeContainerHandler(nameOrConfig)
                  : buildContainerHandler(nameOrConfig),
          ];

    const onConflict = isString(nameOrConfig) ? options?.onConflict : nameOrConfig.onConflict;
    const directives = registry(md, 'blockDirectives');
    if (onConflict === 'error' && Object.prototype.hasOwnProperty.call(directives, name)) {
        throw new Error(`Block directive already registered: ${name}`);
    }

    registry(md, CONTAINER_KEY, true);
    registry(md, CONTAINER_KEY)[name] = handler;

    registry(md, 'blockDirectives')[name] = getBlockDefaultHandler(md, name);
}

function getBlockDefaultHandler<B>(md: BlockHost<B>, name: string) {
    return (args: DirectiveBlockHandlerArgs<unknown>) => {
        assertHostState(args.state, md.block.State);
        const containerHandler = lookupHandler(md, CONTAINER_KEY, name);
        const leafBlockHandler = lookupHandler(md, LEAF_BLOCK_KEY, name);

        if (isString(args.content)) {
            if (containerHandler) {
                return invokeHandler(containerHandler, args.state, buildContainerParams(args));
            }
        } else if (leafBlockHandler) {
            return invokeHandler(leafBlockHandler, args.state, buildLeafBlockParams(args));
        }

        return false;
    };
}

function buildLeafBlockHandler<B extends BlockContentState<B>>(
    config: LeafBlockDirectiveConfig<B>,
): LeafBlockDirectiveHandler<B> {
    return (state, params) => {
        if (!config.match(params, state)) {
            return false;
        }

        const {container} = config;

        const token = state.push(container.token, container.tag, 0);
        token.map = [params.startLine, params.endLine];
        token.markup = '::' + config.name;
        applyTokenFields(token, container, params, state.env);

        return true;
    };
}

function buildContainerHandler<B extends BlockContentState<B>>(
    config: ContainerDirectiveConfig<B>,
): ContainerDirectiveHandler<B> {
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
        applyTokenFields(token, container, params, state.env);

        if (inlineContent) {
            token = state.push(inlineContent.token + '_open', inlineContent.tag, 1);
            applyTokenFields(token, inlineContent, params, state.env);

            token = createBlockInlineToken(state, params);

            token = state.push(inlineContent.token + '_close', inlineContent.tag, -1);
        }

        if (content) {
            token = state.push(content.token + '_open', content.tag, 1);
            token.map = [params.startLine + 1, params.endLine - 1];
            applyTokenFields(token, content, params, state.env);
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

function buildCodeContainerHandler<B extends BlockContentState<B>>(
    config: CodeContainerDirectiveConfig<B>,
): ContainerDirectiveHandler<B> {
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
        applyTokenFields(token, container, params, state.env);

        return true;
    };
}

function buildInlineParams(args: DirectiveInlineHandlerArgs<unknown>): InlineDirectiveParams {
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

function buildLeafBlockParams(args: DirectiveBlockHandlerArgs<unknown>): LeafBlockDirectiveParams {
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
    if (args.contentTitle) {
        params.contentTitle = {
            raw: args.contentTitle,
            startPos: args.contentTitleStart!,
            endPos: args.contentTitleEnd!,
        };
    }
    return params;
}

function buildContainerParams(args: DirectiveBlockHandlerArgs<unknown>): ContainerDirectiveParams {
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
    token: DirectiveToken,
    {attrs, meta}: TokensDesc<P>,
    params: P,
    env: Env,
): void {
    if (attrs !== undefined) {
        const value: Record<string, string> = isFunction(attrs) ? attrs(params, env) : attrs;
        token.attrs = Object.entries(value);
    }
    if (meta !== undefined) {
        const value: object = isFunction(meta) ? meta(params, env) : meta;
        token.meta = value;
    }
}
