export function isFunction(arg: unknown): arg is Function {
    return typeof arg === 'function';
}

export function isString(arg: unknown): arg is string {
    return typeof arg === 'string';
}
