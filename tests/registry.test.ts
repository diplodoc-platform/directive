import MarkdownIt from 'markdown-it';
import {describe, expect, it} from 'vitest';

import {
    directiveParser,
    registerContainerDirective,
    registerInlineDirective,
    registerLeafBlockDirective,
} from '../src';

describe('own directive registrations', () => {
    it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
        'leaves unregistered %s text literal',
        (name) => {
            const md = new MarkdownIt().use(directiveParser());
            for (const source of [
                `Ruby uses :${name} symbol.`,
                `::${name}`,
                `:::${name}\nBody\n:::`,
            ]) {
                expect(md.render(source)).toBe(new MarkdownIt().render(source));
            }
        },
    );

    it('preserves own upstream registrations and ignores inherited handlers', () => {
        const md = new MarkdownIt().use(directiveParser());
        const inline = Reflect.get(md, 'inlineDirectives');
        const block = Reflect.get(md, 'blockDirectives');
        const unexpected = () => {
            throw new Error('Inherited handler ran');
        };
        Object.setPrototypeOf(inline, {inherited: unexpected});
        Object.setPrototypeOf(block, {inherited: unexpected});
        const own = () => false;
        inline.own = own;
        block.own = own;

        md.use(directiveParser());
        expect(Object.getPrototypeOf(Reflect.get(md, 'inlineDirectives'))).toBe(null);
        expect(Object.getPrototypeOf(Reflect.get(md, 'blockDirectives'))).toBe(null);
        expect(Reflect.get(md, 'inlineDirectives').own).toBe(own);
        expect(Reflect.get(md, 'blockDirectives').own).toBe(own);
        expect(md.render(':inherited')).toBe('<p>:inherited</p>\n');
        expect(md.render('::inherited')).toBe('<p>::inherited</p>\n');
    });

    it('runs explicitly registered constructor handlers after reinstallation', () => {
        const md = new MarkdownIt().use(directiveParser());
        let inlineCalls = 0;
        let leafCalls = 0;
        let containerCalls = 0;
        registerInlineDirective(md, 'constructor', () => {
            inlineCalls++;
            return true;
        });
        registerLeafBlockDirective(md, 'constructor', () => {
            leafCalls++;
            return true;
        });
        registerContainerDirective(md, 'constructor', () => {
            containerCalls++;
            return true;
        });
        md.use(directiveParser());

        md.render(':constructor');
        md.render('::constructor');
        md.render(':::constructor\nBody\n:::');
        expect([inlineCalls, leafCalls, containerCalls]).toEqual([1, 1, 1]);
        expect(() =>
            registerContainerDirective(md, 'constructor', () => true, {onConflict: 'error'}),
        ).toThrow('Block directive already registered: constructor');
    });
});

it('preserves non-enumerable and accessor own handlers without invoking getters on install', () => {
    const md = new MarkdownIt().use(directiveParser());
    let getterCalls = 0;
    let handlerCalls = 0;
    const handler = () => {
        handlerCalls++;
        return false;
    };
    const getter = () => {
        getterCalls++;
        return handler;
    };
    for (const key of ['inlineDirectives', 'blockDirectives']) {
        const table = Object.defineProperties(
            {},
            {
                hidden: {value: handler, enumerable: false, configurable: true},
                accessor: {
                    get: getter,
                    enumerable: false,
                    configurable: true,
                },
            },
        );
        Reflect.set(md, key, table);
        const descriptors = Object.getOwnPropertyDescriptors(table);
        md.use(directiveParser());
        expect(Object.getOwnPropertyDescriptors(Reflect.get(md, key))).toEqual(descriptors);
    }
    expect(getterCalls).toBe(0);
    md.render(':hidden :accessor');
    expect(handlerCalls).toBe(2);
    expect(getterCalls).toBeGreaterThan(0);
    md.render('::hidden');
    expect(handlerCalls).toBeGreaterThan(2);
});
