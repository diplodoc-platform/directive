import type {BlockBoundaryInput} from './block-recognizers';
import type {BoundaryRule, BoundaryState} from './runtime';

import {blockBoundaries} from './block-recognizers';
import {copyOnWriteLines, recognizeScoped, snapshotInput} from './block-boundary-state';
import {assertBoundaryState, assertScanner, isRecord, lookupHandler, runtimeRules} from './runtime';

type Scope = {depth: number; root: boolean; input?: BlockBoundaryInput};

type Invocation = {closingLine: number; scopes: Scope[]};
type Configuration = ReturnType<typeof configuration>;
const scanners = new WeakMap<
    object,
    {configuration: Configuration; scanner: ReturnType<typeof createScanner>}
>();

function optionValues(options: unknown): readonly (readonly [PropertyKey, unknown])[] | undefined {
    if (!isRecord(options)) return undefined;
    const values: (readonly [PropertyKey, unknown])[] = [];
    for (const key of Reflect.ownKeys(options)) {
        const descriptor = Object.getOwnPropertyDescriptor(options, key);
        // Mutable nested options and accessors cannot be safely cached by identity alone.
        if (
            !descriptor ||
            !('value' in descriptor) ||
            (typeof descriptor.value === 'object' && descriptor.value !== null)
        )
            return undefined;
        values.push([key, descriptor.value]);
    }
    return values;
}

function configuration(state: BoundaryState) {
    return {
        constructor: state.md.constructor,
        options: state.md.options,
        optionValues: optionValues(state.md.options),
        State: Reflect.get(state.md.block, 'State'),
        tokenize: Reflect.get(state.md.block, 'tokenize'),
        ruler: state.md.block.ruler,
        rules: runtimeRules<BoundaryState>(state.md.block.ruler).map((rule) => ({
            name: rule.name,
            enabled: rule.enabled,
            identity: rule.identity,
            alt: [...rule.alt],
        })),
        boundaries: [...(blockBoundaries(state.md) ?? [])].map(([name, registration]) => ({
            name,
            ...registration,
        })),
    };
}

function sameItems<T>(
    before: readonly T[],
    after: readonly T[],
    equal: (left: T, right: T) => boolean,
): boolean {
    return (
        before.length === after.length && before.every((item, index) => equal(item, after[index]))
    );
}

function sameOptions(
    before: Configuration['optionValues'],
    after: Configuration['optionValues'],
): boolean {
    if (!before || !after) return false;
    return sameItems(
        before,
        after,
        ([key, value], [nextKey, nextValue]) => key === nextKey && Object.is(value, nextValue),
    );
}

function sameConfiguration(before: Configuration, after: Configuration): boolean {
    return (
        before.constructor === after.constructor &&
        before.options === after.options &&
        before.State === after.State &&
        before.tokenize === after.tokenize &&
        before.ruler === after.ruler &&
        sameOptions(before.optionValues, after.optionValues) &&
        sameItems(
            before.rules,
            after.rules,
            (rule, next) =>
                rule.name === next.name &&
                rule.enabled === next.enabled &&
                rule.identity === next.identity &&
                sameItems(rule.alt, next.alt, (left, right) => left === right),
        ) &&
        sameItems(
            before.boundaries,
            after.boundaries,
            (registration, next) =>
                registration.name === next.name &&
                registration.rule === next.rule &&
                registration.recognize === next.recognize &&
                registration.input === next.input,
        )
    );
}

function createScanner(settings: Configuration) {
    const md: unknown = Reflect.construct(settings.constructor, ['commonmark', settings.options]);
    assertScanner(md);
    const hostRules = settings.rules;
    const enabled = new Set(hostRules.filter((rule) => rule.enabled).map((rule) => rule.name));
    const nativeRules = runtimeRules<BoundaryState>(md.block.ruler);
    md.block.ruler.enableOnly(
        nativeRules.filter((rule) => enabled.has(rule.name)).map(({name}) => name),
    );
    const invocations = new WeakMap<BoundaryState, Invocation>();
    const invocation = (state: BoundaryState) => {
        const active = invocations.get(state);
        if (!active) throw new Error('Missing directive boundary invocation');
        return active;
    };
    const marker: BoundaryRule<BoundaryState> = (scanState, line, end, silent) => {
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

        const {scopes} = invocation(scanState);
        const scope = scopes[scopes.length - 1];
        if (/^[ \t]*$/.test(scanState.src.slice(after, max))) {
            if (scope.depth > 0 && --scope.depth === 0 && scope.root) {
                invocation(scanState).closingLine = line;
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
                    if (invocation(scanState).closingLine >= 0) {
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
        const {scopes} = invocation(scanState);
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
    const boundaries = new Map(
        settings.boundaries.map((registration) => [registration.name, registration]),
    );
    for (const [index, hostRule] of hostRules.entries()) {
        const registration = boundaries.get(hostRule.name);
        if (!hostRule.enabled || !registration || hostRule.identity !== registration.rule) {
            continue;
        }
        const nextNative = hostRules
            .slice(index + 1)
            .find((candidate) => nativeRules.some(({name}) => name === candidate.name));
        const before = nextNative?.name ?? 'paragraph';
        md.block.ruler.before(
            before,
            `directive_opaque_${index}`,
            (scanState, line, end, silent) => {
                const {scopes} = invocation(scanState);
                const scope = scopes[scopes.length - 1];
                const close =
                    registration.input === 'scoped'
                        ? recognizeScoped(scanState, registration.recognize, line, end)
                        : registration.recognize(
                              (scope.input ??= snapshotInput(scanState)),
                              line,
                              end,
                          );
                if (close === null) {
                    return false;
                }
                if (!Number.isInteger(close) || close <= line || close > end) {
                    throw new RangeError('Invalid opaque block boundary');
                }
                if (!silent) {
                    scanState.line = close;
                }
                return true;
            },
            {alt: hostRule.alt},
        );
    }
    // A registered container may consume its body literally even when the host
    // disables paragraph parsing or supplies its own block rules for that text.
    md.block.ruler.push('directive_boundary_fallback', (scanState, line, _end, silent) => {
        if (silent) {
            return false;
        }
        scanState.line = line + 1;
        return true;
    });

    return {md, invocations};
}

/**
 * Find delimiters using isolated native state and mutation-aware configuration.
 * @param state - Current host state, read without mutation.
 * @param startLine - Absolute container opener line.
 * @param endLine - Exclusive absolute Markdown scope boundary.
 * @returns Matching closer line, or -1 when no closer exists in this scope.
 */
function findClosingLine(state: BoundaryState, startLine: number, endLine: number): number {
    const settings = configuration(state);
    let cached = scanners.get(state.md);
    if (!cached || !sameConfiguration(cached.configuration, settings)) {
        cached = {configuration: settings, scanner: createScanner(settings)};
        scanners.set(state.md, cached);
    }
    const {md, invocations} = cached.scanner;
    // Construct only constant-size native defaults; the host has already indexed the source.
    const scanState: unknown = Reflect.construct(md.block.State, ['', md, {}, []]);
    assertBoundaryState(scanState);
    Object.assign(scanState, {
        src: state.src,
        bMarks: copyOnWriteLines(state.bMarks),
        eMarks: copyOnWriteLines(state.eMarks),
        tShift: copyOnWriteLines(state.tShift),
        sCount: copyOnWriteLines(state.sCount),
        bsCount: copyOnWriteLines(state.bsCount),
        line: startLine + 1,
        lineMax: endLine,
        blkIndent: state.blkIndent,
        listIndent: state.listIndent,
        ddIndent: state.ddIndent,
        parentType: state.parentType,
        level: state.level,
        tight: state.tight,
    });
    const active: Invocation = {closingLine: -1, scopes: []};
    invocations.set(scanState, active);
    try {
        md.block.tokenize(scanState, startLine + 1, endLine);
        return active.closingLine;
    } finally {
        invocations.delete(scanState);
    }
}

/**
 * Retain upstream parameter parsing while replacing only its raw delimiter lookup.
 * @param rule - Original upstream block directive rule.
 * @returns Rule using Markdown-aware container boundaries.
 */
export function withBlockBoundary<B extends BoundaryState>(rule: BoundaryRule<B>): BoundaryRule<B> {
    return (state, startLine, endLine, silent) => {
        const start = state.bMarks[startLine] + state.tShift[startLine];
        if (state.src.slice(start, start + 3) !== ':::') {
            return rule(state, startLine, endLine, silent);
        }
        const name = state.src
            .slice(start, state.eMarks[startLine])
            .match(/^:{3,}[ \t]*([a-z][a-z0-9_-]*)/i)?.[1];
        const normalizedName = name?.toLowerCase().replace('_', '-');
        if (!normalizedName || !lookupHandler(state.md, 'blockDirectives', normalizedName)) {
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
