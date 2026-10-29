import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {basename, dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const directiveRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const upstreamManifest = require.resolve('markdown-it-directive/package.json');
const upstreamDirectory = dirname(upstreamManifest);
const nodeModules = dirname(upstreamDirectory);
if (basename(nodeModules) !== 'node_modules') {
    throw new Error('Unexpected markdown-it-directive installation path');
}
const owner = dirname(nodeModules);
const version = JSON.parse(readFileSync(upstreamManifest, 'utf8')).version;
if (version !== '2.0.6') throw new Error(`Unexpected markdown-it-directive version: ${version}`);
const upstream = require.resolve('markdown-it-directive');
const hash = () =>
    createHash('sha256')
        .update(readFileSync(upstream, 'utf8').replace(/\r\n/g, '\n'))
        .digest('hex');
const original = 'df6bcf9f06c6d79e61d510ba917df56bf4cf71f5f5ba7b69f75620ba3b47fa45';
const patched = '71aa399a9846c7d98031437a76e80e89bcaf34c08abead27a1a0e4b3224c6638';
if (![original, patched].includes(hash())) {
    throw new Error('Unexpected markdown-it-directive source before patching');
}
execFileSync(
    process.execPath,
    [
        require.resolve('patch-package'),
        '--error-on-fail',
        '--patch-dir',
        relative(owner, join(directiveRoot, 'patches')),
    ],
    {cwd: owner, stdio: ['ignore', 2, 2]},
);
if (hash() !== patched) throw new Error('Unexpected markdown-it-directive source after patching');
