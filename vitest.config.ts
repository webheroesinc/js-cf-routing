import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text'],
            exclude: [
                'node_modules/',
                'tests/',
                '*.config.ts',
                '*.config.js',
            ],
            include: ['src/**/*.ts', 'lib/**/*.js'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
        testTimeout: 10000,
    },
});
