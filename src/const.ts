export const RULE = {
    Inline: 'inline_directive',
    Block: 'block_directive',
} as const;

export const CONTAINER_KEY = Symbol();
export const LEAF_BLOCK_KEY = Symbol();
