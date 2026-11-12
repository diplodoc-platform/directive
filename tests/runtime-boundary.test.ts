import MarkdownIt from 'markdown-it';
import directivePlugin from 'markdown-it-directive';
import {describe, expect, it} from 'vitest';

import {directiveParser, registerContainerDirective} from '../src';

describe('runtime write boundaries', () => {
    it('rejects a host that cannot receive its handler registry', () => {
        const md = new MarkdownIt().use(directiveParser());
        Object.preventExtensions(md);

        expect(() => registerContainerDirective(md, 'example', () => true)).toThrow(
            'Cannot create directive handler registry',
        );
    });

    it('rejects a host that cannot receive the constrained-label marker', () => {
        const md = new MarkdownIt().use(directivePlugin);
        Object.preventExtensions(md);

        expect(() => md.use(directiveParser())).toThrow(
            'Cannot mark directive block labels as constrained',
        );
    });
});
