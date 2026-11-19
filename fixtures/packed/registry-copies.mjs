import assert from 'node:assert/strict';
import {cpSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('@diplodoc/directive/package.json'));
const copiedRoot = join(process.cwd(), 'second-directive-copy');
cpSync(packageRoot, copiedRoot, {recursive: true});
const first = require('@diplodoc/directive');
const second = require(copiedRoot);
assert.notEqual(first.directiveParser, second.directiveParser);

const hosts = ['markdown-it'];
try {
    require.resolve('markdown-it-transform15');
    hosts.push('markdown-it-transform15');
} catch {
    // The alias is present only in the mixed-host fixture.
}
for (const name of hosts) {
    const md = new (require(name))().use(first.directiveParser());
    const calls = [];
    first.registerInlineDirective(md, 'constructor', () => {
        calls.push('inline');
        return true;
    });
    first.registerLeafBlockDirective(md, 'constructor', () => {
        calls.push('leaf');
        return true;
    });
    first.registerContainerDirective(md, 'constructor', () => {
        calls.push('container');
        return true;
    });
    const inline = md.inlineDirectives;
    const block = md.blockDirectives;
    md.use(second.directiveParser());
    md.use(first.directiveParser());
    assert.equal(md.inlineDirectives, inline);
    assert.equal(md.blockDirectives, block);
    md.render(':constructor');
    md.render('::constructor');
    md.render(':::constructor\nBody\n:::');
    assert.deepEqual(calls, ['inline', 'leaf', 'container']);
    assert.throws(
        () =>
            second.registerContainerDirective(md, 'constructor', () => true, {onConflict: 'error'}),
        /already registered/,
    );
    assert.equal(
        md.render('Text :toString :hasOwnProperty :__proto__'),
        new (require(name))().render('Text :toString :hasOwnProperty :__proto__'),
    );
}
