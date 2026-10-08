/// <reference types="@cloudflare/workers-types" />

import { Miniflare } from 'miniflare';

// Resolve paths relative to this file without Node's path/url modules, whose types
// would clash with the Workers types the tests are checked against
const resolve = (relative: string) => new URL(relative, import.meta.url).pathname;

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
        scriptPath: resolve('fixtures/dist/worker-router-test.js'),
        bindings: {
            LOG_LEVEL: 'fatal',
        },
        modulesRoot: resolve('..'),
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
        scriptPath: resolve('fixtures/dist/durable-object-router-test.js'),
        bindings: {
            LOG_LEVEL: 'fatal',
        },
        durableObjects: {
            COUNTER: 'Counter',
        },
        modulesRoot: resolve('..'),
    });

    const COUNTER = (await mf.getDurableObjectNamespace(
        'COUNTER'
    )) as unknown as DurableObjectNamespace;

    return {
        mf,
        env: {
            LOG_LEVEL: 'fatal',
            COUNTER,
        },
    };
}
