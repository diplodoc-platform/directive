import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, join, relative} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const patchedHash = '71aa399a9846c7d98031437a76e80e89bcaf34c08abead27a1a0e4b3224c6638';
const sourceHash = (path) =>
    createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

// Use the actual installed upstream and patch-package; only their filesystem layout is isolated.
test('patch helper resolves a hoisted upstream and rejects changed versions or sources', () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'directive-hoisted-patch-')));
    const project = join(root, 'packages/directive');
    const modules = join(root, 'node_modules');
    const upstream = join(modules, 'markdown-it-directive');
    try {
        mkdirSync(join(project, 'scripts'), {recursive: true});
        mkdirSync(join(project, 'patches'));
        mkdirSync(modules);
        writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({
                name: 'directive-patch-workspace',
                private: true,
                workspaces: ['packages/*'],
            }),
        );
        copyFileSync(join(projectRoot, 'package.json'), join(project, 'package.json'));
        copyFileSync(
            join(projectRoot, 'scripts/patch-upstream.mjs'),
            join(project, 'scripts/patch-upstream.mjs'),
        );
        copyFileSync(
            join(projectRoot, 'patches/markdown-it-directive+2.0.6.patch'),
            join(project, 'patches/markdown-it-directive+2.0.6.patch'),
        );
        cpSync(dirname(require.resolve('markdown-it-directive')), upstream, {recursive: true});
        symlinkSync(
            dirname(require.resolve('patch-package/package.json')),
            join(modules, 'patch-package'),
            'junction',
        );
        assert.equal(existsSync(join(project, 'node_modules')), false);
        const fixtureRequire = createRequire(join(project, 'package.json'));
        const entry = fixtureRequire.resolve('markdown-it-directive');
        assert.equal(entry, join(upstream, 'index.js'));
        const cli = require.resolve('patch-package');
        const run = (script, args = [], cwd = project) =>
            spawnSync(process.execPath, [script, ...args], {cwd, encoding: 'utf8'});
        const success = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
        const helper = join(project, 'scripts/patch-upstream.mjs');

        // Both fresh and already-patched inputs must work, regardless of the install hook state.
        success(run(helper));
        assert.equal(sourceHash(entry), patchedHash);
        success(
            run(
                cli,
                [
                    '--reverse',
                    '--error-on-fail',
                    '--patch-dir',
                    relative(root, join(project, 'patches')),
                ],
                root,
            ),
        );
        assert.notEqual(sourceHash(entry), patchedHash);
        success(run(helper));
        assert.equal(sourceHash(entry), patchedHash);
        success(run(helper));
        assert.equal(sourceHash(entry), patchedHash);

        const manifestPath = join(upstream, 'package.json');
        const manifest = readFileSync(manifestPath, 'utf8');
        writeFileSync(manifestPath, JSON.stringify({...JSON.parse(manifest), version: '2.0.7'}));
        const versionFailure = run(helper);
        assert.notEqual(versionFailure.status, 0);
        assert.match(versionFailure.stderr, /requires markdown-it-directive@2\.0\.6/);
        writeFileSync(manifestPath, manifest);

        writeFileSync(entry, readFileSync(entry, 'utf8') + '\n// unexpected source change\n');
        const sourceFailure = run(helper);
        assert.notEqual(sourceFailure.status, 0);
        assert.match(
            sourceFailure.stderr,
            /Unexpected markdown-it-directive source after patching/,
        );
        assert.deepEqual(
            readdirSync(modules).filter((name) => name.startsWith('.diplodoc-directive-patches-')),
            [],
        );
        assert.equal(existsSync(join(project, 'node_modules')), false);
    } finally {
        rmSync(root, {recursive: true, force: true});
    }
});
