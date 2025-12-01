import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupWorkerRouter, WorkerFixture } from '../setup';

/**
 * Minimal integration smoke tests for WorkerRouter
 * These tests verify the library works in a real Workers environment.
 * Detailed functionality is tested in unit tests.
 */
describe('WorkerRouter Integration Smoke Tests', () => {
    let worker: WorkerFixture;

    beforeAll(async () => {
        worker = await setupWorkerRouter();
    });

    afterAll(async () => {
        if (worker?.mf) {
            await worker.mf.dispose();
        }
    });

    it('should handle basic GET request with RouteHandler', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/health');

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');

        const data = await response.json<{ status: string }>();
        expect(data.status).toBe('healthy');
    });

    it('should handle route params', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/users/123');

        expect(response.status).toBe(200);
        const data = await response.json<{ user_id: string }>();
        expect(data.user_id).toBe('123');
    });

    it('should handle HttpError correctly', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/error');

        expect(response.status).toBe(400);
        const data = await response.json<{ error: string }>();
        expect(data.error).toBe('Bad Request Error');
    });

    it('should include CORS headers (without origin by default)', async () => {
        const response = await worker.mf.dispatchFetch('http://localhost/health');

        // By default, Access-Control-Allow-Origin is NOT set (security fix)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
});
