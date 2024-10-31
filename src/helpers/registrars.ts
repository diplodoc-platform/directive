/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type MarkdownIt from 'markdown-it';
import type {MarkdownItWithDirectives} from 'markdown-it-directive';
import type {
    BlockDirectiveHandler,
    BlockDirectiveParams,
    DirectiveDests,
    DirectiveDestsOrig,
    InlineDirectiveHandler,
    InlineDirectiveParams,
} from '../types';

export function registerInlineDirective(
    md: MarkdownIt,
    name: string,
    handler: InlineDirectiveHandler,
): void {
    (md as MarkdownItWithDirectives).inlineDirectives[name] = (args) => {
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
        return handler(args.state, params);
    };
}

export function registerBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: BlockDirectiveHandler,
): void {
    (md as MarkdownItWithDirectives).blockDirectives[name] = (args) => {
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
        return handler(args.state, params);
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
