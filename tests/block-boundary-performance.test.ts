import type {BlockBoundaryInput} from '@diplodoc/directive';

import MarkdownIt from 'markdown-it';
import {describe, expect, it, vi} from 'vitest';

import {
    directiveParser,
    registerBlockBoundary,
    registerContainerDirective,
    tokenizeBlockContent,
} from '@diplodoc/directive';

function parser() {
    const md = new MarkdownIt({html: true}).use(directiveParser());
    registerContainerDirective(md, 'box', (state, params) => {
        state.push('box_open', 'section', 1);
        tokenizeBlockContent(state, params.content);
        state.push('box_close', 'section', -1);
        return true;
    });
    return md;
}

function measure(count: number, opaque: boolean) {
    const md = parser();
    if (opaque) {
        const rule = () => false;
        md.block.ruler.before('code', 'opaque', rule);
        registerBlockBoundary(
            md,
            'opaque',
            rule,
            (input, line) => {
                const value = input.src.slice(input.bMarks[line], input.eMarks[line]);
                return value === 'opaque' ? line + 1 : null;
            },
            {input: 'scoped'},
        );
    }
    const source = `:::box\n${opaque ? 'opaque' : 'Body'}\n:::\n\n`.repeat(count);
    const lineArrayLength = source.split('\n').length;
    let parsers = 0,
        indexedChars = 0,
        copiedCells = 0;
    const construct = Reflect.construct;
    const construction = vi
        .spyOn(Reflect, 'construct')
        .mockImplementation((target, args, newTarget) => {
            if (args[0] === 'commonmark') parsers++;
            else if (typeof args[0] === 'string') indexedChars += args[0].length;
            return newTarget ? construct(target, args, newTarget) : construct(target, args);
        });
    const slice = Array.prototype.slice;
    const copies = vi.spyOn(Array.prototype, 'slice').mockImplementation(function (
        this: unknown[],
        begin,
        end,
    ) {
        if (this.length === lineArrayLength && typeof this[0] === 'number')
            copiedCells += this.length;
        return slice.call(this, begin, end);
    });
    try {
        expect(md.parse(source, {}).filter((token) => token.type === 'box_open')).toHaveLength(
            count,
        );
    } finally {
        construction.mockRestore();
        copies.mockRestore();
    }
    return {parsers, indexedChars, copiedCells, sourceChars: source.length, lineArrayLength};
}

describe('bounded boundary scanner setup', () => {
    it.each([false, true])(
        'bounds source indexing and copied cells for scoped opaque=%s',
        (opaque) => {
            for (const count of [20, 40]) {
                const work = measure(count, opaque);
                expect(work.parsers).toBeLessThanOrEqual(2);
                expect(work.indexedChars).toBeLessThanOrEqual(work.sourceChars * 2);
                expect(work.copiedCells).toBeLessThanOrEqual(work.lineArrayLength * 10);
            }
        },
    );
    it('preserves default snapshots after parsing and later host parses', () => {
        const md = parser();
        const saved: {input: BlockBoundaryInput; positions: number[]}[] = [];
        const rule = () => false;
        md.block.ruler.before('code', 'opaque', rule);
        registerBlockBoundary(md, 'opaque', rule, (input) => {
            saved.push({input, positions: [...input.bMarks]});
            return null;
        });
        md.parse('> :::box\n> Body\n> :::\n\n:::box\nOther\n:::\n', {});
        md.parse(':::box\nNew\n:::', {});
        expect(saved.length).toBeGreaterThan(0);
        for (const {input, positions} of saved) {
            expect(Object.isFrozen(input)).toBe(true);
            expect(Object.isFrozen(input.bMarks)).toBe(true);
            expect([...input.bMarks]).toEqual(positions);
        }
    });
    it('rejects scoped writes and retained array access without touching host state', () => {
        const md = parser();
        const retained: BlockBoundaryInput[] = [];
        const rule = () => false;
        md.block.ruler.before('code', 'opaque', rule);
        registerBlockBoundary(
            md,
            'opaque',
            rule,
            (input) => {
                retained.push(input);
                expect(() => Reflect.set(input.bMarks, '0', 999)).toThrow('read-only');
                expect(() => Reflect.deleteProperty(input.tShift, '0')).toThrow('read-only');
                expect(() => Object.freeze(input.eMarks)).toThrow('read-only');
                expect([...input.bMarks]).toEqual(input.bMarks.slice());
                const copied = input.bMarks.slice();
                expect(Object.keys(input.bMarks)).toEqual(Object.keys(copied));
                expect(Object.entries(input.bMarks)).toEqual(Object.entries(copied));
                expect(Object.getOwnPropertyDescriptor(input.bMarks, '0')?.value).toBe(copied[0]);
                expect(Object.getOwnPropertyDescriptor(input.bMarks, 'length')?.value).toBe(
                    copied.length,
                );
                return null;
            },
            {input: 'scoped'},
        );
        let original: number[][] | undefined;
        md.block.ruler.before('block_directive', 'observe', (state) => {
            original = [state.bMarks, state.eMarks, state.tShift, state.sCount, state.bsCount].map(
                (array) => array.slice(),
            );
            return false;
        });
        registerContainerDirective(md, 'inspect', (state) => {
            expect([state.bMarks, state.eMarks, state.tShift, state.sCount, state.bsCount]).toEqual(
                original,
            );
            return true;
        });
        md.parse(':::inspect\n> - item\n>   ```\n>   :::\n>   ```\n:::\n', {});
        expect(retained.length).toBeGreaterThan(0);
        expect(() => retained[0].bMarks[0]).toThrow('expired');
        expect(() => Object.getOwnPropertyDescriptor(retained[0].eMarks, '0')).toThrow('expired');
    });

    it('isolates reentrant scoped discovery and cleans up after exceptions', () => {
        const md = parser();
        const rule = () => false;
        let nested = false,
            fail = false;
        let retained: BlockBoundaryInput | undefined;
        md.block.ruler.before('code', 'opaque', rule);
        registerBlockBoundary(
            md,
            'opaque',
            rule,
            (input, line) => {
                retained = input;
                const begin = input.bMarks[line];
                if (fail) throw new Error('recognizer failure');
                if (!nested) {
                    nested = true;
                    expect(md.render(':::box\nNested\n:::')).toContain('Nested');
                    expect(input.bMarks[line]).toBe(begin);
                }
                return null;
            },
            {input: 'scoped'},
        );
        expect(md.render(':::box\nBody\n:::')).toContain('Body');
        expect(() => retained?.bMarks[0]).toThrow('expired');
        fail = true;
        expect(() => md.render(':::box\nBody\n:::')).toThrow('recognizer failure');
        expect(() => retained?.bMarks[0]).toThrow('expired');
        fail = false;
        expect(md.render(':::box\nRecovered\n:::')).toContain('Recovered');
    });

    it('invalidates cached setup for every observable host configuration mutation', () => {
        const md = parser();
        const source = ':::box\nBody\n:::';
        let constructions = 0;
        const original = Reflect.construct;
        const spy = vi.spyOn(Reflect, 'construct').mockImplementation((target, args, newTarget) => {
            if (args[0] === 'commonmark') constructions++;
            return newTarget ? original(target, args, newTarget) : original(target, args);
        });
        const render = () => expect(md.render(source)).toContain('Body');
        const changed = (mutate: () => void) => {
            const before = constructions;
            mutate();
            render();
            expect(constructions).toBe(before + 1);
            render();
            expect(constructions).toBe(before + 1);
        };
        try {
            render();
            render();
            expect(constructions).toBe(1);
            changed(() => {
                md.options.html = false;
            });
            changed(() => {
                md.disable('fence');
            });
            changed(() => {
                md.enable('fence');
            });
            changed(() => {
                md.block.ruler.before('code', 'custom', () => false);
            });
            changed(() => {
                md.block.ruler.at('custom', () => false);
            });
            const rules: unknown = Reflect.get(md.block.ruler, '__rules__');
            if (!Array.isArray(rules)) throw new Error('Missing native rule list');
            changed(() => {
                const rule = rules.find((item) => item.name === 'custom');
                rule.alt.push('paragraph');
            });
            changed(() => {
                const index = rules.findIndex((item) => item.name === 'custom');
                const [rule] = rules.splice(index, 1);
                rules.splice(index + 1, 0, rule);
            });
            changed(() => {
                const Constructor = new Proxy(md.constructor, {
                    construct(target, args, newTarget) {
                        return original(target, args, newTarget);
                    },
                });
                Object.defineProperty(md, 'constructor', {value: Constructor, configurable: true});
            });
            changed(() => {
                const State = md.block.State;
                md.block.State = new Proxy(State, {
                    construct(target, args, newTarget) {
                        return original(target, args, newTarget);
                    },
                });
            });
            changed(() => {
                const tokenize = md.block.tokenize;
                md.block.tokenize = function (state, begin, end) {
                    tokenize.call(this, state, begin, end);
                };
            });
            const opaque = () => false;
            changed(() => {
                md.block.ruler.before('code', 'opaque', opaque);
            });
            const recognize = () => null;
            changed(() => {
                registerBlockBoundary(md, 'opaque', opaque, recognize);
            });
            changed(() => {
                registerBlockBoundary(md, 'opaque', opaque, () => null);
            });
            changed(() => {
                registerBlockBoundary(md, 'opaque', opaque, recognize, {input: 'scoped'});
            });
        } finally {
            spy.mockRestore();
        }
    });

    it('does not reuse parser setup for mutable object or accessor options', () => {
        const md = parser();
        let html = true,
            constructions = 0;
        const original = Reflect.construct;
        const spy = vi.spyOn(Reflect, 'construct').mockImplementation((target, args, newTarget) => {
            if (args[0] === 'commonmark') constructions++;
            return newTarget ? original(target, args, newTarget) : original(target, args);
        });
        try {
            Object.defineProperty(md.options, 'html', {get: () => html, configurable: true});
            md.render(':::box\nBody\n:::');
            html = false;
            md.render(':::box\nBody\n:::');
            expect(constructions).toBe(2);
            Object.defineProperty(md.options, 'html', {value: true, configurable: true});
            const extensionOptions = {enabled: true};
            Object.defineProperty(md.options, 'extension', {value: extensionOptions});
            md.render(':::box\nBody\n:::');
            extensionOptions.enabled = false;
            md.render(':::box\nBody\n:::');
            expect(constructions).toBe(4);
        } finally {
            spy.mockRestore();
        }
    });
    it('updates actual HTML boundary semantics after changing host options', () => {
        const md = parser();
        const bodies: string[] = [];
        registerContainerDirective(md, 'box', (_state, params) => {
            bodies.push(params.content.raw);
            return true;
        });
        const source = ':::box\n<div>\n:::\n</div>\n\n:::\n';
        md.render(source);
        expect(bodies[0]).toBe('<div>\n:::\n</div>\n\n');
        md.options.html = false;
        bodies.length = 0;
        md.render(source);
        expect(bodies[0]).toBe('<div>\n');
    });
});
