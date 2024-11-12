/* eslint-disable valid-jsdoc */
import type MarkdownIt from 'markdown-it';

import {RULE} from '../const';

/** Enable parsing of inline directives */
export function enableInlineDirectives(md: MarkdownIt): void {
    md.inline.ruler.enable(RULE.Inline, true);
}

/** Disable parsing of inline directives */
export function disableInlineDirectives(md: MarkdownIt): void {
    md.inline.ruler.disable(RULE.Inline, true);
}

/** Enable parsing of leaf block and container directives */
export function enableBlockDirectives(md: MarkdownIt): void {
    md.block.ruler.enable(RULE.Block, true);
}

/** Disable parsing of leaf block and container directives */
export function disableBlockDirectives(md: MarkdownIt): void {
    md.block.ruler.disable(RULE.Block, true);
}
