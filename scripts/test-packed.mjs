import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRequire = createRequire(join(root, 'package.json'));
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run through npm run test:packed [-- 12|13|14|15|all].');

const hosts = [
    {id: '12', runtime: '12.3.2', types: '12.2.3', extra: {'@types/linkify-it': '3.0.5'}},
    {id: '13', runtime: '13.0.2', types: '13.0.9', extra: {}},
    {id: '14', runtime: '14.1.0', types: '14.1.0', extra: {mdurl: '2.0.0'}},
    {id: '15', runtime: '15.0.3', types: null, extra: {}},
    {
        id: 'mixed',
        runtime: '13.0.2',
        types: '13.0.9',
        extra: {'markdown-it-transform15': 'npm:markdown-it@15.0.3'},
    },
];
const selected = process.argv[2] ?? 'all';
assert(process.argv.length <= 3, 'Expected one host selector.');
const matrix = selected === 'all' ? hosts : hosts.filter(({id}) => id === selected);
assert(matrix.length > 0, `Unknown host: ${selected}`);

const work = mkdtempSync(join(tmpdir(), 'directive-packed-'));
const reports = resolve(process.env.PACKED_CONSUMER_REPORT_DIR ?? join(work, 'reports'));
mkdirSync(reports, {recursive: true});
const npm = (args, cwd, log) => {
    const result = spawnSync(process.execPath, [npmCli, ...args], {cwd, encoding: 'utf8'});
    writeFileSync(log, result.stdout + result.stderr);
    assert.equal(result.status, 0, `${args.join(' ')} failed; see ${log}`);
    return result.stdout;
};
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const manifest = (directory) =>
    readdirSync(directory, {recursive: true})
        .filter((name) => statSync(join(directory, name)).isFile())
        .sort()
        .map((filename) => ({
            filename,
            sha256: createHash('sha256')
                .update(readFileSync(join(directory, filename)))
                .digest('hex'),
        }));

process.stdout.write(`Packed consumer reports: ${reports}\n`);
npm(['run', 'build'], root, join(reports, 'build.log'));
const pack = JSON.parse(
    npm(['pack', '--json', '--pack-destination', work], root, join(reports, 'pack.log')),
)[0];
const tarball = join(work, pack.filename);
const tarSha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
json(join(reports, 'pack.json'), {...pack, tarSha256});
const extracted = join(work, 'extracted');
mkdirSync(extracted);
const extraction = spawnSync('tar', ['-xzf', tarball, '-C', extracted], {encoding: 'utf8'});
writeFileSync(join(reports, 'extract.log'), extraction.stdout + extraction.stderr);
assert.equal(extraction.status, 0, 'Tar extraction failed.');
const packedManifest = manifest(join(extracted, 'package'));
assert.equal(packedManifest.length, pack.files.length);
assert.deepEqual(
    packedManifest.map(({filename}) => filename),
    pack.files.map(({path}) => path).sort(),
);
json(join(reports, 'packed-files.json'), packedManifest);

const fixture = join(root, 'fixtures', 'packed');
const esm = readFileSync(join(fixture, 'consumer.mts'), 'utf8');
const importLine = "import MarkdownIt from 'markdown-it';";
assert(esm.includes(importLine), 'The ESM fixture must import the actual host constructor.');
assert((esm.match(/@ts-expect-error/g) ?? []).length >= 5, 'Keep the negative type assertions.');
const cjs = esm.replace(importLine, "import MarkdownIt = require('markdown-it');");
const license = readFileSync(sourceRequire.resolve('markdown-it-directive/LICENSE'), 'utf8');
const expectedExports = [
    'createBlockInlineToken',
    'directiveParser',
    'disableBlockDirectives',
    'disableInlineDirectives',
    'enableBlockDirectives',
    'enableInlineDirectives',
    'registerContainerDirective',
    'registerInlineDirective',
    'registerLeafBlockDirective',
    'tokenizeBlockContent',
    'tokenizeInlineContent',
];

for (const host of matrix) {
    const dir = join(work, `native${host.id}`);
    const report = join(reports, `native${host.id}`);
    mkdirSync(dir);
    mkdirSync(report, {recursive: true});
    const dependencies = {
        '@diplodoc/directive': `file:${tarball}`,
        'markdown-it': host.runtime,
        typescript: sourceRequire('typescript/package.json').version,
        vitest: sourceRequire('vitest/package.json').version,
        ...host.extra,
    };
    if (host.types) {
        dependencies['@types/markdown-it'] = host.types;
    }
    json(join(dir, 'package.json'), {
        name: `directive-packed-native${host.id}`,
        private: true,
        type: 'module',
        scripts: {typecheck: 'tsc --noEmit', test: 'vitest run'},
        dependencies,
    });
    writeFileSync(join(dir, 'consumer.mts'), esm);
    writeFileSync(join(dir, 'consumer.cts'), cjs);
    const tsconfig = JSON.parse(readFileSync(join(fixture, 'tsconfig.json'), 'utf8'));
    tsconfig.include.push('node_modules/@diplodoc/directive/build/**/*.d.ts');
    if (host.id === 'mixed') {
        const mixed = readFileSync(join(fixture, 'mixed.mts'), 'utf8');
        writeFileSync(join(dir, 'mixed.mts'), mixed);
        writeFileSync(
            join(dir, 'mixed.cts'),
            mixed
                .replace(importLine, "import MarkdownIt = require('markdown-it');")
                .replace(
                    "import MarkdownIt15 from 'markdown-it-transform15';",
                    "import MarkdownIt15 = require('markdown-it-transform15');",
                ),
        );
        tsconfig.include.push('mixed.mts', 'mixed.cts');
    }
    json(join(dir, 'tsconfig.json'), tsconfig);
    copyFileSync(join(root, 'tests', 'block-boundary.test.ts'), join(dir, 'boundary.test.ts'));
    const validation = readFileSync(join(root, 'tests', 'attribute-validation.test.ts'), 'utf8');
    writeFileSync(
        join(dir, 'attribute-validation.test.ts'),
        validation.replace("from '../src'", "from '@diplodoc/directive'"),
    );

    npm(
        ['install', '--no-workspaces', '--no-audit', '--no-fund'],
        dir,
        join(report, 'install.log'),
    );
    const consumerRequire = createRequire(join(dir, 'package.json'));
    const entry = consumerRequire.resolve('@diplodoc/directive');
    const installedManifest = manifest(
        dirname(consumerRequire.resolve('@diplodoc/directive/package.json')),
    );
    assert.equal(installedManifest.length, pack.files.length);
    assert.deepEqual(installedManifest, packedManifest);
    json(join(report, 'installed-files.json'), installedManifest);
    const libraryRequire = createRequire(entry);
    const hostPath = consumerRequire.resolve('markdown-it/package.json');
    assert.equal(libraryRequire.resolve('markdown-it/package.json'), hostPath);
    assert.equal(consumerRequire('markdown-it/package.json').version, host.runtime);
    assert.throws(() => libraryRequire.resolve('markdown-it-directive'), {
        code: 'MODULE_NOT_FOUND',
    });
    if (host.types) {
        assert.equal(consumerRequire('@types/markdown-it/package.json').version, host.types);
    } else {
        assert.throws(() => libraryRequire.resolve('@types/markdown-it/package.json'), {
            code: 'MODULE_NOT_FOUND',
        });
    }
    assert.deepEqual(Object.keys(consumerRequire('@diplodoc/directive')).sort(), expectedExports);
    writeFileSync(
        join(dir, 'exports.mjs'),
        `import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const esm = await import('@diplodoc/directive');
const cjs = require('@diplodoc/directive');
const named = Object.keys(esm).filter((name) => !['default', 'module.exports'].includes(name)).sort();
assert.deepEqual(named, ${JSON.stringify(expectedExports)});
assert.deepEqual(Object.keys(cjs).sort(), named);
assert.deepEqual(Object.keys(esm.default).sort(), named);
for (const name of named) assert.equal(esm[name], cjs[name]);
process.stdout.write(JSON.stringify({esm: named, cjs: Object.keys(cjs).sort()}) + '\\n');
`,
    );
    const exportProbe = spawnSync(process.execPath, ['exports.mjs'], {cwd: dir, encoding: 'utf8'});
    writeFileSync(join(report, 'exports.json'), exportProbe.stdout + exportProbe.stderr);
    assert.equal(exportProbe.status, 0, 'Installed package ESM/CJS exports differ.');
    const builtJs = readFileSync(entry, 'utf8');
    assert(builtJs.includes(license), 'The packed runtime must retain the full upstream license.');
    assert(!/require\(['"]markdown-it-directive['"]\)/.test(builtJs));
    for (const name of readdirSync(dirname(entry), {recursive: true})) {
        if (name.endsWith('.d.ts')) {
            assert(
                !/markdown-it-directive|markdown-it\/lib\//.test(
                    readFileSync(join(dirname(entry), name), 'utf8'),
                ),
            );
        }
    }

    npm(['run', 'typecheck'], dir, join(report, 'types.log'));
    npm(['test'], dir, join(report, 'runtime.log'));
    if (host.id === 'mixed') {
        assert.equal(consumerRequire('markdown-it-transform15/package.json').version, '15.0.3');
        const boundary = readFileSync(join(root, 'tests', 'block-boundary.test.ts'), 'utf8');
        writeFileSync(
            join(dir, 'boundary-alias.test.ts'),
            boundary.replace("from 'markdown-it'", "from 'markdown-it-transform15'"),
        );
        writeFileSync(
            join(dir, 'attribute-validation-alias.test.ts'),
            validation
                .replace("from '../src'", "from '@diplodoc/directive'")
                .replace("from 'markdown-it'", "from 'markdown-it-transform15'"),
        );
        npm(['test'], dir, join(report, 'runtime-mixed.log'));
    }
    const tree = npm(['ls', '--all', '--json'], dir, join(report, 'installed-tree.json'));
    json(join(report, 'proof.json'), {host, hostPath, entry, tarSha256, tree: JSON.parse(tree)});
    copyFileSync(join(dir, 'package.json'), join(report, 'package.json'));
    copyFileSync(join(dir, 'package-lock.json'), join(report, 'package-lock.json'));
    process.stdout.write(
        `Native ${host.runtime}: public ESM/CJS types and runtime regressions passed.\n`,
    );
}
