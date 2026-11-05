import type {BlockBoundaryInput, BlockBoundaryRecognizer} from './block-recognizers';
import type {BoundaryState} from './runtime';

/**
 * Keep native line writes local without copying untouched document indexes.
 * @param source - Current host line positions; discovery does not write to them.
 * @returns Sparse numeric writes over host reads; native rules retain array lengths.
 */
export function copyOnWriteLines(source: number[]): number[] {
    const local: number[] = [];
    local.length = source.length;
    return new Proxy(local, {
        get(target, key, receiver) {
            return Object.hasOwn(target, key)
                ? Reflect.get(target, key, receiver)
                : Reflect.get(source, key, receiver);
        },
        has(target, key) {
            return Reflect.has(target, key) || Reflect.has(source, key);
        },
        set(target, key, value) {
            return Reflect.set(target, key, value);
        },
        // Materialize enumeration only when a recognizer explicitly requests it.
        ownKeys(target) {
            return [...new Set([...Reflect.ownKeys(source), ...Reflect.ownKeys(target)])];
        },
        getOwnPropertyDescriptor(target, key) {
            return (
                Reflect.getOwnPropertyDescriptor(target, key) ??
                Reflect.getOwnPropertyDescriptor(source, key)
            );
        },
    });
}

/**
 * Preserve stable frozen snapshots for existing recognizers.
 * @param state - Isolated native scanner state.
 * @returns An independently owned immutable copy of the positional input.
 */
export function snapshotInput(state: BoundaryState): BlockBoundaryInput {
    return Object.freeze({
        src: state.src,
        bMarks: Object.freeze(state.bMarks.slice()),
        eMarks: Object.freeze(state.eMarks.slice()),
        tShift: Object.freeze(state.tShift.slice()),
        lineMax: state.lineMax,
    });
}

/**
 * Invoke an explicitly scoped recognizer without exposing writable scanner arrays.
 * @param state - Isolated native scanner state.
 * @param recognize - Pure synchronous owner callback.
 * @param start - Absolute first line to recognize.
 * @param end - Exclusive absolute scope boundary.
 * @returns The owner's recognized ending line, or null.
 */
export function recognizeScoped(
    state: BoundaryState,
    recognize: BlockBoundaryRecognizer,
    start: number,
    end: number,
): number | null {
    let active = true;
    const check = () => {
        if (!active) throw new TypeError('Scoped block boundary input has expired');
    };
    const reject = () => {
        throw new TypeError('Scoped block boundary input is read-only');
    };
    const readonly = (source: number[]) =>
        new Proxy(source, {
            get(target, key, receiver) {
                check();
                return Reflect.get(target, key, receiver);
            },
            has(target, key) {
                check();
                return Reflect.has(target, key);
            },
            ownKeys(target) {
                check();
                return Reflect.ownKeys(target);
            },
            getOwnPropertyDescriptor(target, key) {
                check();
                return Reflect.getOwnPropertyDescriptor(target, key);
            },
            set: reject,
            deleteProperty: reject,
            defineProperty: reject,
            setPrototypeOf: reject,
            preventExtensions: reject,
        });
    const input = Object.freeze({
        src: state.src,
        bMarks: readonly(state.bMarks),
        eMarks: readonly(state.eMarks),
        tShift: readonly(state.tShift),
        lineMax: state.lineMax,
    });
    try {
        return recognize(input, start, end);
    } finally {
        active = false;
    }
}
