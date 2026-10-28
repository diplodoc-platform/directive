import type {BlockRule, MarkdownItConstructor, StateBlock} from './markdown-it';
import type {MarkdownItWithDirectives} from './upstream';

type Rule = {name: string; enabled: boolean; fn: BlockRule};
type Scope = {depth: number; root: boolean};

/**
 * Find container delimiters with the host parser's native Markdown block rules.
 * @param state - Current parser state.
 * @param startLine - Container opener line.
 * @param endLine - Exclusive end of the current Markdown scope.
 * @returns Matching closer line, or -1 if the current scope has no closer.
 */
function findClosingLine(state: StateBlock, startLine: number, endLine: number): number {
    const Constructor = state.md.constructor as MarkdownItConstructor;
    const md = new Constructor('commonmark', state.md.options);
    const hostRules = (state.md.block.ruler as unknown as {__rules__: Rule[]}).__rules__;
    const enabled = new Set(hostRules.filter((rule) => rule.enabled).map((rule) => rule.name));
    const nativeRules = (md.block.ruler as unknown as {__rules__: Rule[]}).__rules__;
    md.block.ruler.enableOnly(
        nativeRules.filter((rule) => enabled.has(rule.name)).map(({name}) => name),
    );

    let closingLine = -1;
    const scopes: Scope[] = [];
    const marker: BlockRule = (scanState, line, end, silent) => {
        const pos = scanState.bMarks[line] + scanState.tShift[line];
        const max = scanState.eMarks[line];
        const after = scanState.skipChars(pos, 0x3a);
        if (after - pos < 3) {
            return false;
        }
        if (silent) {
            // Let an outdented delimiter terminate a lazy list/quote paragraph;
            // its enclosing scope must process that delimiter after unwinding.
            return true;
        }
        if (scanState.sCount[line] < scanState.blkIndent) {
            return false;
        }

        const scope = scopes[scopes.length - 1];
        if (/^[ \t]*$/.test(scanState.src.slice(after, max))) {
            if (scope.depth > 0 && --scope.depth === 0 && scope.root) {
                closingLine = line;
                scanState.line = end;
                return true;
            }
        } else {
            scope.depth++;
        }
        scanState.line = line + 1;
        return true;
    };

    const paragraph = nativeRules.find(({name}) => name === 'paragraph');
    if (paragraph) {
        const paragraphRule = paragraph.fn;
        paragraph.fn = (scanState, begin, end, silent) => {
            const matched = paragraphRule(scanState, begin, end, silent);
            if (matched && !silent) {
                const next = scanState.line;
                // Indented paragraph continuations are not indented code. The
                // native paragraph rule skips terminators on those lines.
                for (let line = begin + 1; line < next; line++) {
                    marker(scanState, line, end, false);
                    if (closingLine >= 0) {
                        return matched;
                    }
                }
                scanState.line = next;
            }
            return matched;
        };
    }
    const tokenize = md.block.tokenize;
    md.block.tokenize = (scanState, begin, end) => {
        scopes.push({depth: scopes.length ? 0 : 1, root: scopes.length === 0});
        try {
            tokenize.call(md.block, scanState, begin, end);
        } finally {
            scopes.pop();
        }
    };
    md.block.ruler.before('heading', 'directive_boundary', marker, {
        alt: ['paragraph', 'reference', 'blockquote', 'list'],
    });
    // A registered container may consume its body literally even when the host
    // disables paragraph parsing or supplies its own block rules for that text.
    md.block.ruler.push('directive_boundary_fallback', (scanState, line, _end, silent) => {
        if (silent) {
            return false;
        }
        scanState.line = line + 1;
        return true;
    });

    // Preserve the current list/quote offsets, but isolate every mutable parser field.
    const scanState = Object.assign(new md.block.State(state.src, md, {}, []), {
        bMarks: state.bMarks.slice(),
        eMarks: state.eMarks.slice(),
        tShift: state.tShift.slice(),
        sCount: state.sCount.slice(),
        bsCount: state.bsCount.slice(),
        line: startLine + 1,
        lineMax: endLine,
        blkIndent: state.blkIndent,
        listIndent: state.listIndent,
        ddIndent: state.ddIndent,
        parentType: state.parentType,
        level: state.level,
        tight: state.tight,
    }) as StateBlock;
    md.block.tokenize(scanState, startLine + 1, endLine);
    return closingLine;
}

/**
 * Retain upstream parameter parsing while replacing only its raw delimiter lookup.
 * @param rule - Original upstream block directive rule.
 * @returns Rule using Markdown-aware container boundaries.
 */
export function withBlockBoundary(rule: BlockRule): BlockRule {
    return (state, startLine, endLine, silent) => {
        const start = state.bMarks[startLine] + state.tShift[startLine];
        if (state.src.slice(start, start + 3) !== ':::') {
            return rule(state, startLine, endLine, silent);
        }
        const name = state.src
            .slice(start, state.eMarks[startLine])
            .match(/^:{3,}[ \t]*([a-z][a-z0-9_-]*)/i)?.[1];
        const normalizedName = name?.toLowerCase().replace('_', '-');
        if (
            !normalizedName ||
            !(state.md as MarkdownItWithDirectives).blockDirectives[normalizedName]
        ) {
            return rule(state, startLine, endLine, silent);
        }

        const close = findClosingLine(state, startLine, endLine);
        if (close < 0) {
            return false;
        }

        const skipChars = state.skipChars;
        const descriptor = Object.getOwnPropertyDescriptor(state, 'skipChars');
        const restore = () => {
            if (descriptor) {
                Object.defineProperty(state, 'skipChars', descriptor);
            } else {
                Reflect.deleteProperty(state, 'skipChars');
            }
        };
        const hidden = new Set<number>();
        for (let line = startLine + 1; line < close; line++) {
            hidden.add(state.bMarks[line] + state.tShift[line]);
        }
        const closingPos = state.bMarks[close] + state.tShift[close];
        state.skipChars = (pos, code) => {
            if (code === 0x3a) {
                if (pos === closingPos) {
                    // Restore before upstream gets content or calls a real handler.
                    restore();
                } else if (hidden.has(pos)) {
                    return pos;
                }
            }
            return skipChars.call(state, pos, code);
        };
        try {
            return rule(state, startLine, endLine, silent);
        } finally {
            restore();
        }
    };
}
