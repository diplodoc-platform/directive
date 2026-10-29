/* eslint-disable valid-jsdoc */

import {RULE} from '../const';

/** Enable parsing of inline directives */
export function enableInlineDirectives(md: {
    inline: {
        ruler: {
            enable(name: string, ignoreInvalid: boolean): unknown;
            disable(name: string, ignoreInvalid: boolean): unknown;
        };
    };
}): void {
    md.inline.ruler.enable(RULE.Inline, true);
}

/** Disable parsing of inline directives */
export function disableInlineDirectives(md: {
    inline: {
        ruler: {
            enable(name: string, ignoreInvalid: boolean): unknown;
            disable(name: string, ignoreInvalid: boolean): unknown;
        };
    };
}): void {
    md.inline.ruler.disable(RULE.Inline, true);
}

/** Enable parsing of leaf block and container directives */
export function enableBlockDirectives(md: {
    block: {
        ruler: {
            enable(name: string, ignoreInvalid: boolean): unknown;
            disable(name: string, ignoreInvalid: boolean): unknown;
        };
    };
}): void {
    md.block.ruler.enable(RULE.Block, true);
}

/** Disable parsing of leaf block and container directives */
export function disableBlockDirectives(md: {
    block: {
        ruler: {
            enable(name: string, ignoreInvalid: boolean): unknown;
            disable(name: string, ignoreInvalid: boolean): unknown;
        };
    };
}): void {
    md.block.ruler.disable(RULE.Block, true);
}
