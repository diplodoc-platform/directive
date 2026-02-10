import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {coverageConfigDefaults, defineConfig} from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: __dirname,
    resolve: {
        alias: {
            // Run tests against source so coverage is collected from src/ (not build/)
            '@diplodoc/directive': join(__dirname, 'src'),
        },
    },
    test: {
        globals: false,
        include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
        exclude: ['**/node_modules/**', 'build', 'dist', 'coverage'],
        coverage: {
            all: true,
            provider: 'v8',
            include: ['src/**'],
            exclude: ['tests/**', ...coverageConfigDefaults.exclude],
            excludeAfterRemap: true,
            reporter: ['text', 'json', 'html', 'lcov'],
        },
        snapshotFormat: {
            escapeString: true,
            printBasicPrototype: true,
        },
    },
});
