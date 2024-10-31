import type MarkdownIt from 'markdown-it';

import {RULE} from '../const';

export function enableInlineDirectives(md: MarkdownIt): void {
    md.inline.ruler.enable(RULE.Inline, true);
}

export function disableInlineDirectives(md: MarkdownIt): void {
    md.inline.ruler.disable(RULE.Inline, true);
}

export function enableBlockDirectives(md: MarkdownIt): void {
    md.block.ruler.enable(RULE.Block, true);
}

export function disableBlockDirectives(md: MarkdownIt): void {
    md.block.ruler.disable(RULE.Block, true);
}
