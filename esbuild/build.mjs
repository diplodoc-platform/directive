#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

import {build} from '@diplodoc/infra/esbuild';

import tsConfig from '../tsconfig.json' with {type: 'json'};

const outDir = 'build';
const require = createRequire(import.meta.url);

// Refuse to bundle a different or unpatched upstream implementation, even if
// installation lifecycle scripts were skipped.
execFileSync(process.execPath, [require.resolve('patch-package'), '--error-on-fail'], {
    stdio: 'inherit',
});
const upstream = require.resolve('markdown-it-directive');
const upstreamHash = createHash('sha256').update(readFileSync(upstream)).digest('hex');
if (upstreamHash !== '71aa399a9846c7d98031437a76e80e89bcaf34c08abead27a1a0e4b3224c6638') {
    throw new Error('Unexpected markdown-it-directive source after patching');
}

const directiveLicense = readFileSync(require.resolve('markdown-it-directive/LICENSE'), 'utf8');

/** @type {import('esbuild').BuildOptions}*/
const common = {
    bundle: true,
    sourcemap: true,
    target: tsConfig.compilerOptions.target,
    tsconfig: './tsconfig.publish.json',
};

build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: outDir + '/index.js',
    platform: 'node',
    packages: 'bundle',
    banner: {js: `/*!\n${directiveLicense}*/`},
});
