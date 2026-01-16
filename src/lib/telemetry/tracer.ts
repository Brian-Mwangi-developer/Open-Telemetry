/**
 * ============================================================================
 * TRACING UTILITIES
 * ============================================================================
 * 
 * This file provides utilities for creating and managing traces in your
 * application. Traces help you understand the flow of requests and identify
 * performance bottlenecks.
 * 
 * 🎓 LEARNING POINTS:
 * 
 * 1. SPAN LIFECYCLE:
 *    - Create span → Add attributes → Add events → End span
 *    - Always end spans! Memory leaks happen if you forget.
 * 
 * 2. SPAN KINDS:
 *    - INTERNAL: Default, for internal operations
 *    - SERVER: For handling incoming requests
 *    - CLIENT: For making outgoing requests
 *    - PRODUCER: For async message production
 *    - CONSUMER: For async message consumption
 * 
 * 3. CONTEXT PROPAGATION:
 *    - Spans automatically become children of the current active span
 *    - Use context.with() for explicit parent-child relationships
 */

import {
    Attributes,
    Span,
    SpanKind,
    SpanStatusCode,
    trace,
    Tracer
} from '@opentelemetry/api';
import { SEMANTIC_ATTRIBUTES, TELEMETRY_CONFIG } from './config';

/**
 * Get the tracer instance for creating spans
 * 
 * 🎓 LEARNING POINT:
 * Each tracer is identified by a name (usually your service/module name).
 * This helps in filtering and organizing traces in your observability backend.
 */
export function getTracer(name?: string): Tracer {
    return trace.getTracer(name || TELEMETRY_CONFIG.serviceName);
}

/**
 * Get the currently active span (if any)
 * 
 * 🎓 LEARNING POINT:
 * The active span is stored in the current context. When you create a new
 * span, it automatically becomes a child of the active span, creating the
 * trace hierarchy.
 */
export function getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
}

/**
 * Add attributes to the current active span
 * 
 * 🎓 LEARNING POINT:
 * Attributes are key-value pairs that provide context about a span.
 * They're searchable in most observability tools, making them great for
 * filtering (e.g., find all spans where user.id = "123").
 * 
 * @example
 * addSpanAttributes({
 *   'user.id': '123',
 *   'user.tier': 'premium',
 *   'feature.flag': 'new-checkout-flow',
 * });
 */
export function addSpanAttributes(attributes: Attributes): void {
    const span = getActiveSpan();
    if (span) {
        span.setAttributes(attributes);
    }
}

/**
 * Add an event to the current active span
 * 
 * 🎓 LEARNING POINT:
 * Events are timestamped annotations within a span. Use them to mark
 * significant moments during an operation, like:
 * - "cache hit" or "cache miss"
 * - "validation passed"
 * - "payment authorized"
 * 
 * @example
 * addSpanEvent('cache_lookup', { 
 *   'cache.key': 'user:123',
 *   'cache.hit': true,
 * });
 */

//Add significant  operations
export function addSpanEvent(name: string, attributes?: Attributes): void {
    const span = getActiveSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Record an exception on the current span and set error status
 * 
 * 🎓 LEARNING POINT:
 * When an error occurs within a span, you should:
 * 1. Record the exception (adds stack trace and error details)
 * 2. Set the span status to ERROR (makes it easy to filter errors)
 * 
 * This makes errors visible in your observability tools and helps with
 * debugging.
 */
export function recordException(error: Error, message?: string): void {
    const span = getActiveSpan();
    if (span) {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: message || error.message,
        });
    }
}

/**
 * Trace a synchronous function
 * 
 * 🎓 LEARNING POINT:
 * This is a "wrapper" pattern - it wraps any function with tracing.
 * The span automatically captures:
 * - Duration (from start to end)
 * - Success/failure status
 * - Any attributes you add
 * 
 * @example
 * const result = traceSync('calculateDiscount', () => {
 *   addSpanAttributes({ 'discount.type': 'percentage' });
 *   return calculateDiscount(cart);
 * });
 */
export function traceSync<T>(
    spanName: string,
    fn: () => T,
    options?: {
        kind?: SpanKind;
        attributes?: Attributes;
    }
): T {
    const tracer = getTracer();

    return tracer.startActiveSpan(
        spanName,
        {
            kind: options?.kind || SpanKind.INTERNAL,
            attributes: options?.attributes,
        },
        (span) => {
            try {
                const result = fn();
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                if (error instanceof Error) {
                    span.recordException(error);
                    span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: error.message,
                    });
                }
                throw error;
            } finally {
                // 🎓 CRITICAL: Always end spans!
                span.end();
            }
        }
    );
}

/**
 * Trace an async function
 * 
 * 🎓 LEARNING POINT:
 * Same as traceSync but for async functions. Most real-world operations
 * are async (API calls, database queries, etc.), so you'll use this often.
 * 
 * @example
 * const user = await traceAsync('fetchUserProfile', async () => {
 *   addSpanAttributes({ 'user.id': userId });
 *   return await db.users.findById(userId);
 * });
 */
export async function traceAsync<T>(
    spanName: string,
    fn: () => Promise<T>,
    options?: {
        kind?: SpanKind;
        attributes?: Attributes;
    }
): Promise<T> {
    const tracer = getTracer();

    return tracer.startActiveSpan(
        spanName,
        {
            kind: options?.kind || SpanKind.INTERNAL,
            attributes: options?.attributes,
        },
        async (span) => {
            try {
                const result = await fn();
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                if (error instanceof Error) {
                    span.recordException(error);
                    span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: error.message,
                    });
                }
                throw error;
            } finally {
                span.end();
            }
        }
    );
}

/**
 * Trace a database operation
 * 
 * 🎓 LEARNING POINT:
 * Database operations are critical to trace because:
 * - They're often the slowest part of a request
 * - N+1 queries become visible when you see many DB spans
 * - You can identify slow queries and optimize them
 * 
 * This helper adds standard database attributes automatically.
 * 
 * @example
 * const users = await traceDbOperation({
 *   operation: 'findMany',
 *   table: 'users',
 *   statement: 'SELECT * FROM users WHERE active = true',
 *   fn: async () => db.users.findMany({ where: { active: true } }),
 * });
 */
export async function traceDbOperation<T>({
    operation,
    table,
    statement,
    dbSystem = 'postgresql',
    fn,
}: {
    operation: string;
    table: string;
    statement?: string;
    dbSystem?: string;
    fn: () => Promise<T>;
}): Promise<T> {
    return traceAsync(
        `db.${operation}`,
        fn,
        {
            kind: SpanKind.CLIENT,
            attributes: {
                [SEMANTIC_ATTRIBUTES.DB_SYSTEM]: dbSystem,
                [SEMANTIC_ATTRIBUTES.DB_OPERATION]: operation,
                'db.sql.table': table,
                // 🎓 WARNING: Be careful with db.statement in production!
                // It might contain sensitive data. Consider redacting or omitting.
                ...(statement && { [SEMANTIC_ATTRIBUTES.DB_STATEMENT]: statement }),
            },
        }
    );
}

/**
 * Trace an external HTTP call
 * 
 * 🎓 LEARNING POINT:
 * External calls (to other APIs) should be traced as CLIENT spans.
 * This helps you:
 * - Identify slow third-party dependencies
 * - Track error rates from external services
 * - Understand your dependency on external systems
 * 
 * @example
 * const data = await traceHttpCall({
 *   method: 'GET',
 *   url: 'https://api.stripe.com/v1/customers',
 *   fn: async () => fetch('https://api.stripe.com/v1/customers'),
 * });
 */
export async function traceHttpCall<T>({
    method,
    url,
    fn,
}: {
    method: string;
    url: string;
    fn: () => Promise<T>;
}): Promise<T> {
    const urlObj = new URL(url);

    return traceAsync(
        `HTTP ${method} ${urlObj.pathname}`,
        fn,
        {
            kind: SpanKind.CLIENT,
            attributes: {
                [SEMANTIC_ATTRIBUTES.HTTP_METHOD]: method,
                [SEMANTIC_ATTRIBUTES.HTTP_URL]: url,
                'http.host': urlObj.host,
            },
        }
    );
}

/**
 * Get the current trace context for logging correlation
 * 
 * 🎓 LEARNING POINT:
 * To correlate logs with traces, you need the trace ID and span ID.
 * Include these in your log messages so you can click from a log
 * directly to the associated trace in your observability tool.
 * 
 * @example
 * const { traceId, spanId } = getTraceContext();
 * console.log(`[${traceId}/${spanId}] User logged in`);
 */
export function getTraceContext(): {
    traceId: string;
    spanId: string;
    traceFlags: number;
} {
    const span = getActiveSpan();
    if (span) {
        const spanContext = span.spanContext();
        return {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
            traceFlags: spanContext.traceFlags,
        };
    }
    return {
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
        traceFlags: 0,
    };
}

/**
 * Create a decorator for tracing class methods (TypeScript decorators)
 * 
 * 🎓 LEARNING POINT:
 * Decorators are a clean way to add tracing without cluttering your
 * business logic. This pattern is common in NestJS and other frameworks.
 * 
 * Note: Requires experimentalDecorators in tsconfig.json
 * 
 * @example
 * class UserService {
 *   @Traced('fetchUser')
 *   async getUser(id: string) {
 *     return db.users.findById(id);
 *   }
 * }
 */
export function Traced(spanName?: string) {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const name = spanName || `${(target as Record<string, unknown>).constructor?.name || 'Unknown'}.${propertyKey}`;

        descriptor.value = async function (...args: unknown[]) {
            return traceAsync(name, () => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}
