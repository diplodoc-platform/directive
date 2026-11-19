/** Immutable input to a host-provided opaque block boundary recognizer. */
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

type Registration = {rule: object; recognize: BlockBoundaryRecognizer};
const registrations = new WeakMap<object, Map<string, Registration>>();

/**
 * Register a side-effect-free boundary recognizer for an exact host block rule.
 * @param host - The Markdown parser instance.
 * @param name - The host block rule name.
 * @param rule - The exact callback installed under that name.
 * @param recognize - Pure recognizer for the block's exclusive end line.
 * @returns Nothing.
 */
export function registerBlockBoundary(
    host: object,
    name: string,
    rule: object,
    recognize: BlockBoundaryRecognizer,
): void {
    let rules = registrations.get(host);
    if (!rules) {
        rules = new Map();
        registrations.set(host, rules);
    }
    rules.set(name, {rule, recognize});
}

export function blockBoundaries(host: object): ReadonlyMap<string, Registration> | undefined {
    return registrations.get(host);
}
