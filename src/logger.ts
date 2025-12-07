/**
 * Simple console-based logger that respects LOG_LEVEL environment variable.
 * Uses proper console methods (debug, info, warn, error) for Cloudflare observability.
 *
 * @category Logging
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
};

/**
 * Logger class with level-based filtering and structured data support.
 *
 * @example
 * ```typescript
 * const log = new Logger('my-router', 'info');
 * log.info('Request received', { method: 'GET', path: '/users' });
 * log.error('Failed to process', { error: err.message });
 * ```
 */
export class Logger {
    private name: string;
    private level: number;

    constructor(name: string, level: LogLevel = 'info') {
        this.name = name;
        this.level = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    }

    setLevel(level: LogLevel | string): void {
        const normalized = (level?.toLowerCase() || 'info') as LogLevel;
        this.level = LOG_LEVELS[normalized] ?? LOG_LEVELS.info;
    }

    private shouldLog(messageLevel: LogLevel): boolean {
        return LOG_LEVELS[messageLevel] >= this.level;
    }

    private formatData(data?: Record<string, unknown>): string {
        if (!data || Object.keys(data).length === 0) return '';
        return ' ' + JSON.stringify(data);
    }

    trace(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('trace')) {
            console.debug(`[${this.name}] [TRACE] ${message}${this.formatData(data)}`);
        }
    }

    debug(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('debug')) {
            console.debug(`[${this.name}] ${message}${this.formatData(data)}`);
        }
    }

    info(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('info')) {
            console.info(`[${this.name}] ${message}${this.formatData(data)}`);
        }
    }

    warn(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('warn')) {
            console.warn(`[${this.name}] ${message}${this.formatData(data)}`);
        }
    }

    error(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('error')) {
            console.error(`[${this.name}] ${message}${this.formatData(data)}`);
        }
    }

    fatal(message: string, data?: Record<string, unknown>): void {
        if (this.shouldLog('fatal')) {
            console.error(`[${this.name}] [FATAL] ${message}${this.formatData(data)}`);
        }
    }
}
