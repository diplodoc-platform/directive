import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Apply and verify the upstream patch at its actual standalone or workspace location.
 * @returns {string} The resolved, verified upstream entry point.
 */
export function patchUpstream() {
    const upstream = realpathSync(require.resolve('markdown-it-directive'));
    const upstreamRoot = dirname(upstream);
    const {name, version} = JSON.parse(readFileSync(join(upstreamRoot, 'package.json'), 'utf8'));
    if (name !== 'markdown-it-directive' || version !== '2.0.6') {
        throw new Error(
            `The directive patch requires markdown-it-directive@2.0.6, got ${name}@${version}`,
        );
    }

    const appRoot = dirname(dirname(upstreamRoot));
    // Keep the patch on the dependency's volume so relative Windows paths remain valid.
    const temporaryRoot = mkdtempSync(
        join(appRoot, 'node_modules', '.diplodoc-directive-patches-'),
    );
    try {
        const filename = 'markdown-it-directive+2.0.6.patch';
        copyFileSync(join(projectRoot, 'patches', filename), join(temporaryRoot, filename));
        execFileSync(
            process.execPath,
            [
                require.resolve('patch-package'),
                '--error-on-fail',
                '--patch-dir',
                relative(appRoot, temporaryRoot),
            ],
            {cwd: appRoot, stdio: 'inherit'},
        );
    } finally {
        rmSync(temporaryRoot, {recursive: true, force: true});
    }

    const source = readFileSync(upstream, 'utf8').replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(source).digest('hex');
    if (hash !== '71aa399a9846c7d98031437a76e80e89bcaf34c08abead27a1a0e4b3224c6638') {
        throw new Error('Unexpected markdown-it-directive source after patching');
    }
    return upstream;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    patchUpstream();
}
