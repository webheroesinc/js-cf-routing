import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDurableObjectRouter, DurableObjectFixture } from '../setup';

/**
 * Minimal integration smoke tests for DurableObjectRouter
 * These tests verify the library works in a real Workers environment.
 * Detailed functionality is tested in unit tests.
 */
describe('DurableObjectRouter Integration Smoke Tests', () => {
    let worker: DurableObjectFixture;

    beforeAll(async () => {
        worker = await setupDurableObjectRouter();
    });

    afterAll(async () => {
        if (worker?.mf) {
            await worker.mf.dispose();
        }
    });

    it('should handle basic GET request', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/info');

        expect(response.status).toBe(200);
        const data = await response.json<{ name: string }>();
        expect(data.name).toBe('Counter Durable Object');
    });

    it('should persist state across requests', async () => {
        // Reset counter
        await worker.mf.dispatchFetch('http://localhost/count', {
            method: 'DELETE',
        });

        // Increment
        await worker.mf.dispatchFetch('http://localhost/count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ increment: 5 }),
        });

        // Verify persistence
        const response = await worker.mf.dispatchFetch('http://localhost/count');
        const data = await response.json<{ count: number }>();
        expect(data.count).toBe(5);
    });

    it('should handle route params', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/state/testkey', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 'testvalue' }),
        });

        expect(response.status).toBe(200);
        const data = await response.json<{ key: string; value: string }>();
        expect(data.key).toBe('testkey');
        expect(data.value).toBe('testvalue');
    });

    it('should include CORS headers (without origin by default)', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/info');

        // By default, Access-Control-Allow-Origin is NOT set (security fix)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
});
