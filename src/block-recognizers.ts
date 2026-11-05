/** Read-only input to a host-provided opaque block boundary recognizer. */
export interface BlockBoundaryInput {
    readonly src: string;
    readonly bMarks: readonly number[];
    readonly eMarks: readonly number[];
    readonly tShift: readonly number[];
    readonly lineMax: number;
}

/** Returns the exclusive end line of a recognized block, or null. */
export type BlockBoundaryRecognizer = (
    input: BlockBoundaryInput,
    startLine: number,
    endLine: number,
) => number | null;

export interface BlockBoundaryOptions {
    /** Stable frozen snapshot by default; scoped arrays may be read only during the callback. */
    readonly input?: 'snapshot' | 'scoped';
}

type Registration = {
    rule: object;
    recognize: BlockBoundaryRecognizer;
    input: 'snapshot' | 'scoped';
};

interface BoundaryHost {
    readonly version: 1;
    readonly registrations: Map<unknown, unknown>;
    wrappedRule: object | undefined;
}

const protocol = Symbol.for('@diplodoc/directive/boundary-host/v1');

function ownData(value: object, key: PropertyKey): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('Invalid directive boundary host protocol');
    }
    return descriptor.value as unknown;
}

function createBoundaryHost(host: object): BoundaryHost {
    if (!Object.isExtensible(host)) {
        throw new TypeError('Cannot mark directive block labels as constrained');
    }
    const state: BoundaryHost = {version: 1, registrations: new Map(), wrappedRule: undefined};
    Object.defineProperties(state, {
        version: {writable: false, configurable: false},
        registrations: {writable: false, configurable: false},
        wrappedRule: {configurable: false},
    });
    Object.preventExtensions(state);
    Object.defineProperty(host, protocol, {value: state});
    return state;
}

/**
 * Read the fixed host-owned protocol without invoking foreign accessors.
 * @param host - Exact native parser instance; inherited protocol state is ignored.
 * @param create - Allocate this host's own state when no own protocol exists.
 * @returns Shared per-host registrations and the current installed wrapper identity.
 */
export function boundaryHost(host: object, create = true): BoundaryHost | undefined {
    const descriptor = Object.getOwnPropertyDescriptor(host, protocol);
    if (!descriptor) {
        return create ? createBoundaryHost(host) : undefined;
    }
    if (
        !('value' in descriptor) ||
        descriptor.enumerable ||
        descriptor.writable ||
        descriptor.configurable
    ) {
        throw new TypeError('Invalid directive boundary host descriptor');
    }
    const state: unknown = descriptor.value;
    if (
        !state ||
        typeof state !== 'object' ||
        Object.isExtensible(state) ||
        Reflect.ownKeys(state).length !== 3
    ) {
        throw new TypeError('Invalid directive boundary host protocol');
    }
    const version = ownData(state, 'version');
    const registrations = ownData(state, 'registrations');
    const wrappedRule = ownData(state, 'wrappedRule');
    const versionDescriptor = Object.getOwnPropertyDescriptor(state, 'version');
    const registrationsDescriptor = Object.getOwnPropertyDescriptor(state, 'registrations');
    const wrappedDescriptor = Object.getOwnPropertyDescriptor(state, 'wrappedRule');
    if (
        version !== 1 ||
        versionDescriptor?.writable ||
        versionDescriptor?.configurable ||
        registrationsDescriptor?.writable ||
        registrationsDescriptor?.configurable ||
        !wrappedDescriptor?.writable ||
        wrappedDescriptor.configurable ||
        (wrappedRule !== undefined && typeof wrappedRule !== 'function')
    ) {
        throw new TypeError('Invalid directive boundary host protocol');
    }
    // Check the native Map brand without calling a foreign has/get/iterator property.
    Map.prototype.has.call(registrations, '');
    return state as BoundaryHost;
}

function registration(value: unknown): Registration {
    if (!value || typeof value !== 'object' || !Object.isFrozen(value)) {
        throw new TypeError('Invalid directive boundary registration');
    }
    const rule = ownData(value, 'rule');
    const recognize = ownData(value, 'recognize');
    const input = ownData(value, 'input');
    if (
        ((!rule || typeof rule !== 'object') && typeof rule !== 'function') ||
        typeof recognize !== 'function' ||
        (input !== 'snapshot' && input !== 'scoped')
    ) {
        throw new TypeError('Invalid directive boundary registration');
    }
    return {rule, recognize: recognize as BlockBoundaryRecognizer, input};
}

/**
 * Register a side-effect-free boundary recognizer for an exact host block rule.
 * @param host - The Markdown parser instance.
 * @param name - The host block rule name.
 * @param rule - The exact callback installed under that name.
 * @param recognize - Pure recognizer for the block's exclusive end line.
 * @param options - Explicitly opt into a synchronous scoped input instead of a stable snapshot.
 * @returns Nothing.
 */
export function registerBlockBoundary(
    host: object,
    name: string,
    rule: object,
    recognize: BlockBoundaryRecognizer,
    options: BlockBoundaryOptions = {},
): void {
    if (options.input !== undefined && options.input !== 'snapshot' && options.input !== 'scoped') {
        throw new TypeError('Invalid block boundary input mode');
    }
    const state = boundaryHost(host);
    if (!state) throw new TypeError('Missing directive boundary host protocol');
    Map.prototype.set.call(
        state.registrations,
        name,
        Object.freeze({rule, recognize, input: options.input ?? 'snapshot'}),
    );
}

export function* blockBoundaries(host: object): Iterable<readonly [string, Registration]> {
    const state = boundaryHost(host, false);
    if (!state) return;
    // Validate records during the scanner's existing configuration walk, not in a second scan.
    for (const [name, value] of Map.prototype.entries.call(state.registrations)) {
        if (typeof name !== 'string') throw new TypeError('Invalid directive boundary name');
        yield [name, registration(value)];
    }
}
