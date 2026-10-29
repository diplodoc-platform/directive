import {describe, expect, it} from 'vitest';
import MarkdownIt from 'markdown-it';

import {directiveParser, registerContainerDirective, registerLeafBlockDirective} from '../src';

const makeParser = () => new MarkdownIt().use(directiveParser());

describe('directive attribute safety', () => {
    it('preserves prototype-like accepted keys and repeated values without inherited properties', () => {
        const md = makeParser();
        let attrs: unknown;
        registerContainerDirective(md, 'box', (_state, params) => {
            attrs = params.attrs;
            return false;
        });
        const source =
            ':::box {constructor=a constructor=b prototype=c class=a class=b}\nbody\n:::';
        expect(() => md.render(source)).not.toThrow();
        expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
        expect(attrs).toEqual({constructor: ['a', 'b'], prototype: 'c', class: ['a', 'b']});
        expect(({} as {polluted?: string}).polluted).toBeUndefined();
    });

    it.each(['__proto__', 'toString'])(
        'keeps unsupported attribute spelling %s as ordinary text without throwing',
        (name) => {
            const md = makeParser();
            let recognized: unknown;
            registerContainerDirective(md, 'box', (_state, params) => {
                recognized = params.attrs;
                return false;
            });
            expect(() => md.render(`:::box {${name}=x}\nbody\n:::`)).not.toThrow();
            expect(recognized).toBeUndefined();
        },
    );
});

describe('container registration collision policy', () => {
    it('keeps legacy replacement by default and rejects strict name collision without changing the original', () => {
        const md = makeParser();
        const original = () => false;
        const replacement = () => true;
        registerContainerDirective(md, 'box', original);
        expect(() =>
            registerContainerDirective(md, 'box', replacement, {onConflict: 'error'}),
        ).toThrow('Block directive already registered: box');
        const source = ':::box\nbody\n:::';
        expect(md.render(source)).toContain(':::box');
        registerContainerDirective(md, 'box', replacement);
        expect(md.render(source)).not.toContain(':::box');
    });

    it('preserves a handler installed by another plugin when strict registration fails', () => {
        const md = makeParser();
        const external = () => false;
        const registry = Reflect.get(md, 'blockDirectives');
        Reflect.set(registry, 'cut', external);
        expect(() =>
            registerContainerDirective(md, 'cut', () => true, {onConflict: 'error'}),
        ).toThrow('Block directive already registered: cut');
        expect(Reflect.get(registry, 'cut')).toBe(external);
    });

    it('protects a leaf or external block handler and supports strict configuration', () => {
        const md = makeParser();
        registerLeafBlockDirective(md, 'leaf', () => false);
        expect(() =>
            registerContainerDirective(md, {
                name: 'leaf',
                onConflict: 'error',
                match: () => true,
                container: {tag: 'div', token: 'leaf'},
            }),
        ).toThrow('Block directive already registered: leaf');
        registerContainerDirective(md, {
            name: 'fresh',
            onConflict: 'error',
            match: () => true,
            container: {tag: 'div', token: 'fresh'},
        });
        expect(md.render(':::fresh\nbody\n:::')).toContain('<div>\n<p>body</p>\n</div>');
    });
});
