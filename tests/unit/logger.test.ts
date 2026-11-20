import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger } from '../../src/logger.js';

describe('Logger', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function spyConsole() {
        return {
            debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
            info: vi.spyOn(console, 'info').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        };
    }

    function logAll(log: Logger) {
        log.trace('t');
        log.debug('d');
        log.info('i');
        log.warn('w');
        log.error('e');
        log.fatal('f');
    }

    describe('level filtering', () => {
        it('should log every level at trace, each to its console method', () => {
            const spy = spyConsole();
            logAll(new Logger('app', 'trace'));

            expect(spy.debug.mock.calls).toEqual([['[app] [TRACE] t'], ['[app] d']]);
            expect(spy.info.mock.calls).toEqual([['[app] i']]);
            expect(spy.warn.mock.calls).toEqual([['[app] w']]);
            expect(spy.error.mock.calls).toEqual([['[app] e'], ['[app] [FATAL] f']]);
        });

        it('should log only fatal at fatal', () => {
            const spy = spyConsole();
            logAll(new Logger('app', 'fatal'));

            expect(spy.debug).not.toHaveBeenCalled();
            expect(spy.info).not.toHaveBeenCalled();
            expect(spy.warn).not.toHaveBeenCalled();
            expect(spy.error.mock.calls).toEqual([['[app] [FATAL] f']]);
        });

        it('should default to info', () => {
            const spy = spyConsole();
            logAll(new Logger('app'));

            expect(spy.debug).not.toHaveBeenCalled();
            expect(spy.info).toHaveBeenCalledTimes(1);
        });

        it('should fall back to info for an unknown constructor level', () => {
            const spy = spyConsole();
            logAll(new Logger('app', 'verbose' as any));

            expect(spy.debug).not.toHaveBeenCalled();
            expect(spy.info).toHaveBeenCalledTimes(1);
        });
    });

    describe('setLevel', () => {
        it('should accept levels in any case', () => {
            const spy = spyConsole();
            const log = new Logger('app', 'fatal');
            log.setLevel('DEBUG');
            logAll(log);

            expect(spy.debug.mock.calls).toEqual([['[app] d']]);
        });

        it('should fall back to info for an unknown or empty level', () => {
            const log = new Logger('app', 'fatal');
            const spy = spyConsole();

            log.setLevel('verbose');
            log.info('unknown');
            log.setLevel('');
            log.info('empty');
            log.setLevel(undefined as any);
            log.info('undefined');
            log.debug('hidden');

            expect(spy.info.mock.calls).toEqual([
                ['[app] unknown'],
                ['[app] empty'],
                ['[app] undefined'],
            ]);
            expect(spy.debug).not.toHaveBeenCalled();
        });
    });

    describe('structured data', () => {
        it('should append data as JSON, omitting an empty object', () => {
            const spy = spyConsole();
            const log = new Logger('app', 'info');
            log.info('with', { method: 'GET', status: 200 });
            log.info('empty', {});

            expect(spy.info.mock.calls).toEqual([
                ['[app] with {"method":"GET","status":200}'],
                ['[app] empty'],
            ]);
        });
    });
});
