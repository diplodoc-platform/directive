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
    for (const input of ['snapshot', 'scoped']) {
        for (const [installer, registrar] of [
            [first, second],
            [second, first],
        ]) {
            const host = new (require(name))().use(installer.directiveParser());
            const raw = [];
            installer.registerContainerDirective(host, 'box', (state, params) => {
                raw.push(params.content.raw);
                installer.tokenizeBlockContent(state, params.content);
                return true;
            });
            const rule = () => false;
            host.block.ruler.before('code', 'opaque', rule);
            registrar.registerBlockBoundary(
                host,
                'opaque',
                rule,
                (value, start, end) =>
                    value.src.slice(
                        value.bMarks[start] + value.tShift[start],
                        value.eMarks[start],
                    ) === 'opaque'
                        ? Math.min(start + 3, end)
                        : null,
                {input},
            );
            const current = () =>
                host.block.ruler.__rules__.find((rule) => rule.name === 'block_directive').fn;
            const wrapped = current();
            host.use(registrar.directiveParser()).use(installer.directiveParser());
            assert.equal(current(), wrapped);
            host.render(':::box\nopaque\n:::\nend\nreal body\n:::\nAFTER');
            assert.deepEqual(raw, ['opaque\n:::\nend\nreal body\n']);
            const replacement = () => false;
            host.block.ruler.at('block_directive', replacement);
            host.use(registrar.directiveParser());
            assert.notEqual(current(), replacement);
            const replaced = current();
            host.use(installer.directiveParser());
            assert.equal(current(), replaced);
        }
    }
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
