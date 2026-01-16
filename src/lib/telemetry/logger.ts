/**
 * ============================================================================
 * STRUCTURED LOGGING WITH TRACE CORRELATION
 * ============================================================================
 * 
 * Logs are the third pillar of observability. Unlike traces (which show flow)
 * and metrics (which show aggregates), logs capture detailed events.
 * 
 * 🎓 LEARNING POINTS:
 * 
 * 1. STRUCTURED LOGGING:
 *    - Use JSON format, not plain text
 *    - Makes logs searchable and parseable
 *    - Example: { "level": "error", "msg": "Failed", "userId": "123" }
 * 
 * 2. LOG LEVELS:
 *    - DEBUG: Detailed debugging info (off in production)
 *    - INFO: Normal operation events
 *    - WARN: Something unexpected but not critical
 *    - ERROR: Something failed but app continues
 *    - FATAL: App is about to crash
 * 
 * 3. TRACE CORRELATION:
 *    - Include trace_id and span_id in every log
 *    - Enables clicking from log → trace in your observability tool
 *    - "Show me all logs for this request"
 * 
 * 4. SENSITIVE DATA:
 *    - NEVER log passwords, tokens, or PII
 *    - Be careful with request bodies
 *    - Consider redaction utilities
 */

import pino from 'pino';
import { TELEMETRY_CONFIG } from './config';
import { getTraceContext } from './tracer';

/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Context that can be added to log messages
 */
export interface LogContext {
    [key: string]: unknown;
}

/**
 * Create the base Pino logger instance
 * 
 * 🎓 LEARNING POINT:
 * Pino is chosen because:
 * - It's the fastest Node.js logger
 * - Native JSON output
 * - Great TypeScript support
 * - Works well with OpenTelemetry
 */
const baseLogger = pino({
    level: process.env.LOG_LEVEL || 'silent',

    // 🎓 Base fields added to every log message
    base: {
        service: TELEMETRY_CONFIG.serviceName,
        version: TELEMETRY_CONFIG.serviceVersion,
        env: TELEMETRY_CONFIG.environment,
    },

    // 🎓 Timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,

    // 🎓 Format for development (pretty print) vs production (JSON)
    transport: process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});

/**
 * Add trace context to log message
 * 
 * 🎓 LEARNING POINT:
 * This is the magic that connects logs to traces. When you view a trace
 * in Jaeger/Grafana, you can click to see all logs with that trace_id.
 */
function withTraceContext(context: LogContext = {}): LogContext {
    const { traceId, spanId } = getTraceContext();

    return {
        ...context,
        // 🎓 Standard field names for trace correlation
        // Different observability tools expect different names:
        // - trace_id, span_id (OpenTelemetry standard)
        // - dd.trace_id, dd.span_id (Datadog)
        // - traceId, spanId (some tools)
        trace_id: traceId,
        span_id: spanId,
    };
}

/**
 * Create a child logger with additional context
 * 
 * 🎓 LEARNING POINT:
 * Child loggers inherit parent context and add their own.
 * Great for adding request-scoped data.
 * 
 * @example
 * const requestLogger = logger.child({ requestId: 'abc123', userId: 'user456' });
 * requestLogger.info('Processing request'); // Includes requestId and userId
 */
export function createChildLogger(context: LogContext): Logger {
    const childPino = baseLogger.child(context);
    return new Logger(childPino);
}

/**
 * Main Logger class with trace correlation
 * 
 * 🎓 LEARNING POINT:
 * We wrap Pino to automatically add trace context to every log.
 * This ensures you never forget to include correlation IDs.
 */
export class Logger {
    private pinoLogger: pino.Logger;

    constructor(pinoLogger?: pino.Logger) {
        this.pinoLogger = pinoLogger || baseLogger;
    }

    /**
     * Log a debug message
     * 
     * 🎓 WHEN TO USE:
     * - Detailed debugging information
     * - Variable values during development
     * - Typically disabled in production (too verbose)
     * 
     * @example
     * logger.debug({ query: sql, params }, 'Executing database query');
     */
    debug(context: LogContext | string, message?: string): void {
        if (typeof context === 'string') {
            this.pinoLogger.debug(withTraceContext(), context);
        } else {
            this.pinoLogger.debug(withTraceContext(context), message || '');
        }
    }

    /**
     * Log an info message
     * 
     * 🎓 WHEN TO USE:
     * - Normal operation events
     * - Request received/completed
     * - User actions (login, purchase)
     * - State changes
     * 
     * @example
     * logger.info({ userId, action: 'login' }, 'User logged in successfully');
     */
    info(context: LogContext | string, message?: string): void {
        if (typeof context === 'string') {
            this.pinoLogger.info(withTraceContext(), context);
        } else {
            this.pinoLogger.info(withTraceContext(context), message || '');
        }
    }

    /**
     * Log a warning message
     * 
     * 🎓 WHEN TO USE:
     * - Unexpected but handled situations
     * - Deprecated feature usage
     * - Retry attempts
     * - Rate limiting
     * 
     * @example
     * logger.warn({ attemptNumber: 3, maxAttempts: 5 }, 'Retrying failed operation');
     */
    warn(context: LogContext | string, message?: string): void {
        if (typeof context === 'string') {
            this.pinoLogger.warn(withTraceContext(), context);
        } else {
            this.pinoLogger.warn(withTraceContext(context), message || '');
        }
    }

    /**
     * Log an error message
     * 
     * 🎓 WHEN TO USE:
     * - Operation failed but app continues
     * - Exception caught and handled
     * - API returned error response
     * 
     * @example
     * logger.error({ 
     *   error: err.message, 
     *   stack: err.stack,
     *   userId,
     * }, 'Failed to process payment');
     */
    error(context: LogContext | string, message?: string): void {
        if (typeof context === 'string') {
            this.pinoLogger.error(withTraceContext(), context);
        } else {
            this.pinoLogger.error(withTraceContext(context), message || '');
        }
    }

    /**
     * Log a fatal message
     * 
     * 🎓 WHEN TO USE:
     * - App is about to crash
     * - Unrecoverable error
     * - Critical resource unavailable
     * 
     * @example
     * logger.fatal({ error: err.message }, 'Database connection lost');
     * process.exit(1);
     */
    fatal(context: LogContext | string, message?: string): void {
        if (typeof context === 'string') {
            this.pinoLogger.fatal(withTraceContext(), context);
        } else {
            this.pinoLogger.fatal(withTraceContext(context), message || '');
        }
    }

    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger {
        return new Logger(this.pinoLogger.child(context));
    }
}

// Export a default logger instance
export const logger = new Logger();

// ============================================================================
// SPECIALIZED LOGGERS
// ============================================================================

/**
 * HTTP Request Logger
 * 
 * 🎓 LEARNING POINT:
 * Create specialized loggers for common scenarios.
 * This ensures consistent log format across your codebase.
 */
export function logHttpRequest(request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    userAgent?: string;
    ip?: string;
}): void {
    logger.info({
        http: {
            method: request.method,
            url: request.url,
            userAgent: request.userAgent,
            // 🎓 IP addresses might be PII in some jurisdictions
            // Consider your privacy requirements
            ip: request.ip,
        },
    }, 'HTTP request received');
}

/**
 * HTTP Response Logger
 */
export function logHttpResponse(response: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
}): void {
    const level: LogLevel = response.statusCode >= 500 ? 'error'
        : response.statusCode >= 400 ? 'warn'
            : 'info';

    const logFn = logger[level].bind(logger);
    logFn({
        http: {
            method: response.method,
            url: response.url,
            statusCode: response.statusCode,
            duration: `${response.duration.toFixed(2)}ms`,
        },
    }, 'HTTP response sent');
}

/**
 * Database Query Logger
 * 
 * 🎓 LEARNING POINT:
 * Log slow queries to identify performance issues.
 * Set a threshold and only log queries that exceed it.
 */
export function logDatabaseQuery(query: {
    operation: string;
    table: string;
    duration: number;
    rowCount?: number;
    // 🎓 WARNING: Never log actual SQL with user data!
    // Either omit or sanitize the query string
    query?: string;
}): void {
    const slowQueryThreshold = 100; // milliseconds

    if (query.duration > slowQueryThreshold) {
        logger.warn({
            db: {
                operation: query.operation,
                table: query.table,
                duration: `${query.duration.toFixed(2)}ms`,
                rowCount: query.rowCount,
                slow: true,
            },
        }, 'Slow database query detected');
    } else {
        logger.debug({
            db: {
                operation: query.operation,
                table: query.table,
                duration: `${query.duration.toFixed(2)}ms`,
                rowCount: query.rowCount,
            },
        }, 'Database query executed');
    }
}

/**
 * Business Event Logger
 * 
 * 🎓 LEARNING POINT:
 * Business events are valuable for analytics and debugging.
 * They tell you what users are actually doing.
 */
export function logBusinessEvent(event: {
    name: string;
    userId?: string;
    properties?: Record<string, unknown>;
}): void {
    logger.info({
        event: {
            name: event.name,
            userId: event.userId,
            ...event.properties,
        },
    }, `Business event: ${event.name}`);
}

/**
 * Security Event Logger
 * 
 * 🎓 LEARNING POINT:
 * Security events should always be logged for audit trails.
 * Consider these non-negotiable: login, logout, permission changes,
 * failed auth attempts, sensitive data access.
 */
export function logSecurityEvent(event: {
    action: string;
    userId?: string;
    success: boolean;
    reason?: string;
    ip?: string;
}): void {
    const level: LogLevel = event.success ? 'info' : 'warn';
    const logFn = logger[level].bind(logger);

    logFn({
        security: {
            action: event.action,
            userId: event.userId,
            success: event.success,
            reason: event.reason,
            ip: event.ip,
        },
    }, `Security event: ${event.action}`);
}
