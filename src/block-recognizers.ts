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
const registrations = new WeakMap<object, Map<string, Registration>>();

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
    let rules = registrations.get(host);
    if (!rules) {
        rules = new Map();
        registrations.set(host, rules);
    }
    rules.set(name, {rule, recognize, input: options.input ?? 'snapshot'});
}

export function blockBoundaries(host: object): ReadonlyMap<string, Registration> | undefined {
    return registrations.get(host);
}
