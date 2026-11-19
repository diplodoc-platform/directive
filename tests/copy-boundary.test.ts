import type * as DirectiveModule from '@diplodoc/directive';

import MarkdownIt from 'markdown-it';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import {runtimeRules} from '../src/runtime';

type Directive = typeof DirectiveModule;
const protocol = Symbol.for('@diplodoc/directive/boundary-host/v1');
let first: Directive;
let second: Directive;

beforeAll(async () => {
    first = await import('../src');
    vi.resetModules();
    second = await import('../src');
    expect(second.directiveParser).not.toBe(first.directiveParser);
});

function opaque(input: DirectiveModule.BlockBoundaryInput, start: number, end: number) {
    return input.src.slice(input.bMarks[start] + input.tShift[start], input.eMarks[start]) ===
        'opaque'
        ? Math.min(start + 3, end)
        : null;
}

function ownProtocol(value: {version: unknown; registrations: unknown; wrappedRule: unknown}) {
    Object.defineProperties(value, {
        version: {writable: false, configurable: false},
        registrations: {writable: false, configurable: false},
        wrappedRule: {configurable: false},
    });
    return Object.preventExtensions(value);
}

describe('host-owned boundary protocol across independently loaded copies', () => {
    it.each(['snapshot', 'scoped'] as const)('shares %s registrations in both orders', (input) => {
        for (const [installer, registrar] of [
            [first, second],
            [second, first],
        ]) {
            const md = new MarkdownIt().use(installer.directiveParser());
            const raw: string[] = [];
            installer.registerContainerDirective(md, 'box', (state, params) => {
                raw.push(params.content.raw);
                installer.tokenizeBlockContent(state, params.content);
                return true;
            });
            const rule = () => false;
            md.block.ruler.before('code', 'opaque', rule);
            const retained: DirectiveModule.BlockBoundaryInput[] = [];
            registrar.registerBlockBoundary(
                md,
                'opaque',
                rule,
                (value, start, end) => {
                    retained.push(value);
                    if (input === 'snapshot') expect(Object.isFrozen(value.bMarks)).toBe(true);
                    else expect(() => Reflect.set(value.bMarks, '0', 999)).toThrow('read-only');
                    return opaque(value, start, end);
                },
                {input},
            );
            md.use(registrar.directiveParser()).use(installer.directiveParser());
            md.parse(':::box\nopaque\n:::\nend\nreal body\n:::\nAFTER', {});
            expect(raw).toEqual(['opaque\n:::\nend\nreal body\n']);
            expect(retained.length).toBeGreaterThan(0);
            if (input === 'snapshot') expect(retained[0].bMarks[0]).toBe(0);
            else expect(() => retained[0].bMarks[0]).toThrow('expired');
        }
    });

    it('keeps A-B-A installation idempotent and rewraps an actually replaced rule', () => {
        const md = new MarkdownIt().use(first.directiveParser());
        const rule = () =>
            runtimeRules(md.block.ruler).find(({name}) => name === 'block_directive');
        const original = rule()?.identity;
        md.use(second.directiveParser()).use(first.directiveParser());
        expect(rule()?.identity).toBe(original);
        const replacement = vi.fn(() => false);
        md.block.ruler.at('block_directive', replacement);
        md.use(second.directiveParser());
        const wrapped = rule()?.identity;
        expect(wrapped).not.toBe(replacement);
        md.use(first.directiveParser());
        expect(rule()?.identity).toBe(wrapped);
    });

    it('invalidates rule enable/disable, replacement and cross-copy re-registration', () => {
        const md = new MarkdownIt().use(first.directiveParser());
        const raw: string[] = [];
        first.registerContainerDirective(md, 'box', (_state, params) => {
            raw.push(params.content.raw);
            return true;
        });
        const rule = () => false;
        md.block.ruler.before('code', 'opaque', rule);
        second.registerBlockBoundary(md, 'opaque', rule, opaque);
        const source = ':::box\nopaque\n:::\nend\nbody\n:::';
        md.render(source);
        expect(raw.pop()).toContain('body');
        second.registerBlockBoundary(md, 'opaque', rule, () => null);
        md.render(source);
        expect(raw.pop()).toBe('opaque\n');
        first.registerBlockBoundary(md, 'opaque', rule, opaque);
        md.render(source);
        expect(raw.pop()).toContain('body');
        md.disable('opaque');
        md.render(source);
        expect(raw.pop()).toBe('opaque\n');
        md.enable('opaque');
        const replacement = () => false;
        md.block.ruler.at('opaque', replacement);
        md.render(source);
        expect(raw.pop()).toBe('opaque\n');
        first.registerBlockBoundary(md, 'opaque', replacement, opaque, {input: 'scoped'});
        md.render(source);
        expect(raw.pop()).toContain('body');
    });

    it('creates a non-enumerable own immutable protocol shape and isolates inherited state', () => {
        const parent = new MarkdownIt().use(first.directiveParser());
        const descriptor = Object.getOwnPropertyDescriptor(parent, protocol);
        expect(descriptor).toMatchObject({enumerable: false, writable: false, configurable: false});
        expect(Object.isExtensible(descriptor?.value)).toBe(false);
        const md = new MarkdownIt();
        const prototype = Object.create(Object.getPrototypeOf(md));
        const getter = vi.fn(() => descriptor?.value);
        Object.defineProperty(prototype, protocol, {get: getter});
        Object.setPrototypeOf(md, prototype);
        md.use(second.directiveParser());
        expect(getter).not.toHaveBeenCalled();
        expect(Object.getOwnPropertyDescriptor(md, protocol)?.value).not.toBe(descriptor?.value);
    });

    it.each([
        {version: 2, registrations: new Map(), wrappedRule: undefined},
        {version: 1, registrations: {}, wrappedRule: undefined},
        {version: 1, registrations: new Map(), wrappedRule: true},
    ])('rejects malformed own protocol before upstream mutation: %j', (value) => {
        const md = new MarkdownIt();
        const rules = runtimeRules(md.block.ruler).map(({identity}) => identity);
        Object.defineProperty(md, protocol, {value: ownProtocol(value)});
        expect(() => md.use(first.directiveParser())).toThrow(TypeError);
        expect(runtimeRules(md.block.ruler).map(({identity}) => identity)).toEqual(rules);
    });

    it('rejects own accessors without invoking them and cannot mutate a frozen host', () => {
        const md = new MarkdownIt();
        const getter = vi.fn(() => ({version: 1, registrations: new Map()}));
        Object.defineProperty(md, protocol, {get: getter});
        expect(() => md.use(first.directiveParser())).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
        expect(() => second.registerBlockBoundary(Object.freeze({}), 'opaque', {}, opaque)).toThrow(
            TypeError,
        );
    });

    it('rejects malformed registration accessors without calling foreign getters', () => {
        const md = new MarkdownIt().use(first.directiveParser());
        first.registerContainerDirective(md, 'box', () => true);
        const state = Object.getOwnPropertyDescriptor(md, protocol)?.value as
            | {registrations: Map<string, unknown>}
            | undefined;
        const getter = vi.fn(() => opaque);
        const malformed = {rule: () => false, input: 'snapshot'};
        Object.defineProperty(malformed, 'recognize', {get: getter});
        state?.registrations.set('opaque', Object.freeze(malformed));
        expect(() => md.render(':::box\nbody\n:::')).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });

    it('does not call accessors inside a foreign own protocol record', () => {
        const md = new MarkdownIt();
        const getter = vi.fn(() => undefined);
        const value = {version: 1, registrations: new Map()};
        Object.defineProperty(value, 'wrappedRule', {get: getter});
        Object.defineProperties(value, {
            version: {writable: false, configurable: false},
            registrations: {writable: false, configurable: false},
        });
        Object.preventExtensions(value);
        Object.defineProperty(md, protocol, {value});
        expect(() => md.use(second.directiveParser())).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });
});
