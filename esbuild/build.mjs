#!/usr/bin/env node

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

import {build} from '@diplodoc/infra/esbuild';

import {patchUpstream} from '../scripts/patch-upstream.mjs';

import tsConfig from '../tsconfig.json' with {type: 'json'};

const outDir = 'build';
const require = createRequire(import.meta.url);

// Refuse to bundle a different or unpatched upstream implementation, even if
// installation lifecycle scripts were skipped.
patchUpstream();

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
