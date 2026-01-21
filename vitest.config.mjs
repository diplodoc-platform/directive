import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: false,
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        exclude: ['node_modules', 'build', 'dist', 'coverage'],
        snapshotFormat: {
            escapeString: true,
            printBasicPrototype: true,
        },
    },
});
