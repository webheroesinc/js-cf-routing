/// <reference types="@cloudflare/workers-types" />

import { Miniflare } from 'miniflare';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WorkerTestEnv {
    LOG_LEVEL: string;
}

export interface WorkerFixture {
    mf: Miniflare;
    env: WorkerTestEnv;
}

export async function setupWorkerRouter(): Promise<WorkerFixture> {
    const mf = new Miniflare({
        modules: true,
        scriptPath: path.join(__dirname, 'fixtures/dist/worker-router-test.js'),
        bindings: {
            LOG_LEVEL: 'fatal',
        },
        modulesRoot: path.join(__dirname, '..'),
    });

    return {
        mf,
        env: {
            LOG_LEVEL: 'fatal',
        },
    };
}

export interface DurableObjectTestEnv extends WorkerTestEnv {
    COUNTER: DurableObjectNamespace;
}

export interface DurableObjectFixture {
    mf: Miniflare;
    env: DurableObjectTestEnv;
}

export async function setupDurableObjectRouter(): Promise<DurableObjectFixture> {
    const mf = new Miniflare({
        modules: true,
        scriptPath: path.join(__dirname, 'fixtures/dist/durable-object-router-test.js'),
        bindings: {
            LOG_LEVEL: 'fatal',
        },
        durableObjects: {
            COUNTER: 'Counter',
        },
        modulesRoot: path.join(__dirname, '..'),
    });

    const COUNTER = (await mf.getDurableObjectNamespace('COUNTER')) as unknown as DurableObjectNamespace;

    return {
        mf,
        env: {
            LOG_LEVEL: 'fatal',
            COUNTER,
        },
    };
}
