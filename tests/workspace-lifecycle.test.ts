// @vitest-environment node
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const root = resolve(import.meta.dirname, '..');
const expectedHash = '71aa399a9846c7d98031437a76e80e89bcaf34c08abead27a1a0e4b3224c6638';
const npmCli = process.env.npm_execpath;

function invoke(command: string, args: string[], cwd: string) {
    return spawnSync(command, args, {cwd, encoding: 'utf8', timeout: 90000});
}

function fixture(workspace: boolean) {
    const dir = mkdtempSync(join(tmpdir(), 'directive-lifecycle-'));
    const initialized = invoke('git', ['init', '--quiet'], dir);
    if (initialized.status !== 0) throw new Error(initialized.stderr);
    const project = workspace ? join(dir, 'packages/directive') : dir;
    mkdirSync(join(project, 'scripts'), {recursive: true});
    if (workspace) {
        const submoduleGit = invoke('git', ['init', '--quiet'], project);
        if (submoduleGit.status !== 0) throw new Error(submoduleGit.stderr);
    }
    mkdirSync(join(project, 'patches'), {recursive: true});
    copyFileSync(
        join(root, 'scripts/apply-upstream-patch.mjs'),
        join(project, 'scripts/apply-upstream-patch.mjs'),
    );
    copyFileSync(
        join(root, 'patches/markdown-it-directive+2.0.6.patch'),
        join(project, 'patches/markdown-it-directive+2.0.6.patch'),
    );
    const original = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const manifest = {
        name: '@diplodoc/directive',
        version: original.version,
        private: true,
        scripts: {prepare: original.scripts.prepare},
        devDependencies: {
            'markdown-it-directive': '2.0.6',
            'patch-package': '8.0.1',
            husky: '9.1.7',
        },
    };
    writeFileSync(join(project, 'package.json'), JSON.stringify(manifest));
    if (workspace)
        writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({
                name: 'lifecycle-host',
                private: true,
                workspaces: ['packages/directive'],
            }),
        );
    return {dir, project};
}

describe('upstream patch lifecycle', () => {
    it.each([false, true])(
        'installs and checks a %s workspace',
        (workspace) => {
            expect(npmCli).toBeTruthy();
            if (!npmCli) throw new Error('npm test must provide npm_execpath');
            const {dir, project} = fixture(workspace);
            try {
                for (const command of ['install', 'ci']) {
                    const result = invoke(
                        process.execPath,
                        [npmCli, command, '--prefer-offline'],
                        dir,
                    );
                    expect(result.status, result.stdout + result.stderr).toBe(0);
                }
                const packed = invoke(
                    process.execPath,
                    [npmCli, 'pack', '--json', '--pack-destination', dir],
                    project,
                );
                expect(packed.status, packed.stdout + packed.stderr).toBe(0);
                expect(JSON.parse(packed.stdout)).toHaveLength(1);
                const owner = workspace ? dir : project;
                const source = join(owner, 'node_modules/markdown-it-directive/index.js');
                expect(existsSync(source)).toBe(true);
                if (workspace) {
                    expect(existsSync(join(project, 'node_modules/markdown-it-directive'))).toBe(
                        false,
                    );
                }
                const manifest = join(owner, 'node_modules/markdown-it-directive/package.json');
                const hash = () =>
                    createHash('sha256')
                        .update(readFileSync(source, 'utf8').replace(/\r\n/g, '\n'))
                        .digest('hex');
                expect(hash()).toBe(expectedHash);
                const helper = join(project, 'scripts/apply-upstream-patch.mjs');
                expect(invoke(process.execPath, [helper], project).status).toBe(0);
                const savedSource = readFileSync(source);
                writeFileSync(source, Buffer.concat([savedSource, Buffer.from('\n// altered\n')]));
                const altered = invoke(process.execPath, [helper], project);
                expect(altered.status).not.toBe(0);
                expect(altered.stderr).toContain(
                    'Unexpected markdown-it-directive source before patching',
                );
                writeFileSync(source, savedSource);
                const savedManifest = readFileSync(manifest);
                const wrong = JSON.parse(savedManifest.toString());
                wrong.version = '2.0.7';
                writeFileSync(manifest, JSON.stringify(wrong));
                const invalid = invoke(process.execPath, [helper], project);
                expect(invalid.status).not.toBe(0);
                expect(invalid.stderr).toContain('Unexpected markdown-it-directive version');
                writeFileSync(manifest, savedManifest);
                expect(invoke(process.execPath, [helper], project).status).toBe(0);
                expect(hash()).toBe(expectedHash);
            } finally {
                rmSync(dir, {recursive: true, force: true});
            }
        },
        180000,
    );
});
