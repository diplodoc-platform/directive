/*
 * Audited JavaScript boundaries for markdown-it-directive 2.0.6 and native
 * markdown-it 12–15. Runtime-only tables are never public host requirements.
 */
export function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === 'object' && value !== null;
}

export function registry(host: object, key: PropertyKey, create = false): Record<string, unknown> {
    let value: unknown = Reflect.get(host, key);
    if (value === undefined && create) {
        value = {};
        if (!Reflect.set(host, key, value)) {
            throw new TypeError('Cannot create directive handler registry');
        }
    }
    if (!isRecord(value)) {
        throw new TypeError('Directive parser must be installed before registering directives');
    }
    return value;
}

export function lookupHandler(host: object, key: PropertyKey, name: string): unknown {
    const table: unknown = Reflect.get(host, key);
    if (table === undefined) return undefined;
    return registry(host, key)[name];
}

export function assertHostState<S>(
    state: unknown,
    Constructor: abstract new (...args: never[]) => S,
): asserts state is S {
    if (!(state instanceof Constructor)) {
        throw new TypeError('Directive handler received a state from a different host');
    }
}

export function invokeHandler(handler: unknown, state: unknown, params: unknown): boolean | void {
    if (typeof handler !== 'function') {
        throw new TypeError('Invalid directive handler');
    }
    const result: unknown = Reflect.apply(handler, undefined, [state, params]);
    if (result !== undefined && typeof result !== 'boolean') {
        throw new TypeError('Invalid directive handler result');
    }
    return result;
}

export type BoundaryState = {
    src: string;
    bMarks: number[];
    eMarks: number[];
    tShift: number[];
    sCount: number[];
    bsCount: number[];
    line: number;
    lineMax: number;
    blkIndent: number;
    listIndent: number;
    ddIndent?: number;
    parentType: string;
    level: number;
    tight: boolean;
    skipChars(pos: number, code: number): number;
    md: {options: unknown; block: {ruler: object}};
};

export type BoundaryRule<S> = (state: S, start: number, end: number, silent: boolean) => boolean;

type Rule<S> = {name: string; enabled: boolean; fn: BoundaryRule<S>};

/**
 * Access the existing runtime rule list without exposing its private shape.
 * @param ruler - Native block ruler.
 * @returns Checked rule accessors.
 */
export function runtimeRules<S>(ruler: object): Rule<S>[] {
    const rules: unknown = Reflect.get(ruler, '__rules__');
    if (!Array.isArray(rules)) {
        throw new TypeError('Missing native block rules');
    }
    return rules.map((rule: unknown) => {
        if (
            !isRecord(rule) ||
            typeof rule.name !== 'string' ||
            typeof rule.enabled !== 'boolean' ||
            typeof rule.fn !== 'function'
        ) {
            throw new TypeError('Invalid native block rule');
        }
        return {
            name: rule.name,
            enabled: rule.enabled,
            get fn(): BoundaryRule<S> {
                const fn = rule.fn;
                if (typeof fn !== 'function') throw new TypeError('Invalid native block rule');
                return (state, start, end, silent) => {
                    const result: unknown = Reflect.apply(fn, undefined, [
                        state,
                        start,
                        end,
                        silent,
                    ]);
                    if (typeof result !== 'boolean')
                        throw new TypeError('Invalid block rule result');
                    return result;
                };
            },
            set fn(fn: BoundaryRule<S>) {
                rule.fn = fn;
            },
        };
    });
}

type Scanner = {
    block: {
        State: new (...args: never[]) => unknown;
        tokenize(state: BoundaryState, start: number, end: number): void;
        ruler: {
            enableOnly(names: string[]): unknown;
            before(
                before: string,
                name: string,
                rule: BoundaryRule<BoundaryState>,
                options: {alt: string[]},
            ): void;
            push(name: string, rule: BoundaryRule<BoundaryState>): void;
        };
    };
};

/**
 * Check the finite call surface of a freshly constructed native scanner.
 * @param value - Constructed native host.
 * @returns Nothing.
 */
export function assertScanner(value: unknown): asserts value is Scanner {
    if (
        !isRecord(value) ||
        !isRecord(value.block) ||
        typeof value.block.State !== 'function' ||
        typeof value.block.tokenize !== 'function' ||
        !isRecord(value.block.ruler)
    ) {
        throw new TypeError('Invalid native block scanner');
    }
    const ruler = value.block.ruler;
    if (!['enableOnly', 'before', 'push'].every((key) => typeof ruler[key] === 'function')) {
        throw new TypeError('Invalid native block scanner ruler');
    }
}

/**
 * Check the fields consumed by the scanner, not an arbitrary caller state subtype.
 * @param value - Constructed native state.
 * @returns Nothing.
 */
export function assertBoundaryState(value: unknown): asserts value is BoundaryState {
    if (
        !isRecord(value) ||
        typeof value.src !== 'string' ||
        typeof value.parentType !== 'string' ||
        typeof value.tight !== 'boolean' ||
        typeof value.skipChars !== 'function' ||
        !isRecord(value.md) ||
        typeof value.md.constructor !== 'function' ||
        !isRecord(value.md.block) ||
        !isRecord(value.md.block.ruler)
    ) {
        throw new TypeError('Invalid native block scanner state');
    }
    for (const key of ['bMarks', 'eMarks', 'tShift', 'sCount', 'bsCount']) {
        const field = value[key];
        if (!Array.isArray(field) || !field.every((item: unknown) => typeof item === 'number')) {
            throw new TypeError(`Invalid native block scanner state: ${key}`);
        }
    }
    if (value.ddIndent !== undefined && typeof value.ddIndent !== 'number') {
        throw new TypeError('Invalid native block scanner state: ddIndent');
    }
    for (const key of ['line', 'lineMax', 'blkIndent', 'listIndent', 'level']) {
        if (typeof value[key] !== 'number')
            throw new TypeError(`Invalid native block scanner state: ${key}`);
    }
}
