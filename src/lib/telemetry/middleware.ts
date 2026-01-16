/**
 * ============================================================================
 * API ROUTE MIDDLEWARE WITH OBSERVABILITY
 * ============================================================================
 * 
 * This middleware wraps API routes to automatically add:
 * - Tracing (spans for each request)
 * - Metrics (request count, duration, errors)
 * - Logging (request/response logs with trace correlation)
 * 
 * 🎓 LEARNING POINT:
 * Middleware is the best place for observability in web apps because:
 * 1. It's applied consistently to all routes
 * 2. You don't have to remember to add tracing in each handler
 * 3. Common attributes (method, route, status) are added automatically
 * 
 * In production, this pattern is used by all major companies.
 */

import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { NextRequest, NextResponse } from 'next/server';
import { SEMANTIC_ATTRIBUTES, TELEMETRY_CONFIG } from './config';
import { logHttpRequest, logHttpResponse, logger } from './logger';
import {
    decrementActiveRequests,
    incrementActiveRequests,
    recordHttpRequest,
    startTimer,
} from './metrics';

/**
 * Configuration options for the telemetry middleware
 */
export interface TelemetryMiddlewareOptions {
    /** Skip tracing for certain paths (e.g., health checks) */
    skipPaths?: string[];
    /** Add custom attributes to every span */
    customAttributes?: Record<string, string>;
    /** Enable detailed request body logging (⚠️ careful with PII!) */
    logRequestBody?: boolean;
}

/**
 * Type for API route handlers
 */
type ApiHandler = (
    request: NextRequest,
    context?: { params?: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap an API route with full observability
 * 
 * 🎓 LEARNING POINT:
 * This is a Higher-Order Function (HOF) pattern. It takes your handler
 * and returns a new handler with telemetry added. Your original handler
 * doesn't need to know anything about observability!
 * 
 * @example
 * // In your API route: app/api/users/route.ts
 * import { withTelemetry } from '@/lib/telemetry/middleware';
 * 
 * async function handler(request: NextRequest) {
 *   const users = await db.users.findMany();
 *   return NextResponse.json(users);
 * }
 * 
 * export const GET = withTelemetry(handler, { name: 'GET /api/users' });
 */
export function withTelemetry(
    handler: ApiHandler,
    options: {
        name: string;
        skipPaths?: string[];
        customAttributes?: Record<string, string>;
    }
): ApiHandler {
    const tracer = trace.getTracer(TELEMETRY_CONFIG.serviceName);

    return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
        const url = new URL(request.url);
        const path = url.pathname;

        // 🎓 Skip telemetry for certain paths (like health checks)
        // You don't want to pollute your traces with k8s health probes
        if (options.skipPaths?.some(skip => path.startsWith(skip))) {
            return handler(request, context);
        }

        // Start timing
        const timer = startTimer();

        // Track active requests
        incrementActiveRequests({ 'http.route': path });

        // Log the incoming request
        logHttpRequest({
            method: request.method,
            url: request.url,
            userAgent: request.headers.get('user-agent') || undefined,
            ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        });

        // 🎓 Create the span for this request
        // SpanKind.SERVER indicates this is handling an incoming request
        return tracer.startActiveSpan(
            options.name,
            {
                kind: SpanKind.SERVER,
                attributes: {
                    // Standard HTTP attributes from semantic conventions
                    [SEMANTIC_ATTRIBUTES.HTTP_METHOD]: request.method,
                    [SEMANTIC_ATTRIBUTES.HTTP_URL]: request.url,
                    [SEMANTIC_ATTRIBUTES.HTTP_ROUTE]: path,
                    [SEMANTIC_ATTRIBUTES.HTTP_USER_AGENT]: request.headers.get('user-agent') || '',
                    // Custom attributes
                    ...options.customAttributes,
                    // Route params if any
                    ...(context?.params && { 'http.route.params': JSON.stringify(context.params) }),
                },
            },
            async (span) => {
                try {
                    // 🎓 Execute the actual handler
                    const response = await handler(request, context);

                    // Record success
                    const statusCode = response.status;
                    span.setAttribute(SEMANTIC_ATTRIBUTES.HTTP_STATUS_CODE, statusCode);

                    if (statusCode >= 400) {
                        // 🎓 4xx errors are client errors, 5xx are server errors
                        span.setStatus({
                            code: SpanStatusCode.ERROR,
                            message: `HTTP ${statusCode}`,
                        });
                    } else {
                        span.setStatus({ code: SpanStatusCode.OK });
                    }

                    // Record metrics
                    const duration = timer.end();
                    recordHttpRequest({
                        method: request.method,
                        route: path,
                        statusCode,
                        duration,
                    });

                    // Log the response
                    logHttpResponse({
                        method: request.method,
                        url: request.url,
                        statusCode,
                        duration,
                    });

                    return response;
                } catch (error) {
                    // 🎓 Handle exceptions
                    const err = error as Error;

                    span.recordException(err);
                    span.setStatus({
                        code: SpanStatusCode.ERROR,
                        message: err.message,
                    });

                    // Record error metrics
                    const duration = timer.end();
                    recordHttpRequest({
                        method: request.method,
                        route: path,
                        statusCode: 500,
                        duration,
                    });

                    // Log the error
                    logger.error({
                        error: {
                            message: err.message,
                            stack: err.stack,
                            name: err.name,
                        },
                        http: {
                            method: request.method,
                            url: request.url,
                        },
                    }, 'Unhandled error in API route');

                    // Re-throw to let Next.js handle the error
                    throw error;
                } finally {
                    // 🎓 ALWAYS end the span and decrement active requests
                    span.end();
                    decrementActiveRequests({ 'http.route': path });
                }
            }
        );
    };
}

/**
 * Simple timing middleware that only records metrics
 * 
 * 🎓 LEARNING POINT:
 * Sometimes you don't need full tracing, just timing.
 * This lighter-weight option is useful for high-frequency endpoints.
 * 
 * @example
 * const handler = withMetrics(async (req) => {
 *   return NextResponse.json({ ok: true });
 * }, '/api/health');
 */
export function withMetrics(
    handler: ApiHandler,
    routeName: string
): ApiHandler {
    return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
        const timer = startTimer();

        try {
            const response = await handler(request, context);

            recordHttpRequest({
                method: request.method,
                route: routeName,
                statusCode: response.status,
                duration: timer.end(),
            });

            return response;
        } catch (error) {
            recordHttpRequest({
                method: request.method,
                route: routeName,
                statusCode: 500,
                duration: timer.end(),
            });
            throw error;
        }
    };
}

/**
 * Extract user information from request for tracing
 * 
 * 🎓 LEARNING POINT:
 * Adding user context to spans helps you:
 * - Debug issues for specific users
 * - Understand user behavior patterns
 * - Filter traces by user
 * 
 * ⚠️ Be careful with PII regulations (GDPR, CCPA)!
 * Consider hashing user IDs or using internal IDs only.
 */
export function extractUserContext(request: NextRequest): Record<string, string> {
    // 🎓 In a real app, you'd extract from:
    // - JWT tokens
    // - Session cookies
    // - Auth headers

    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session');

    // Example: Extract user ID from JWT (you'd decode the token in reality)
    // This is just a placeholder showing the pattern
    return {
        // 'user.id': extractedUserId,
        // 'user.role': extractedRole,
        'auth.type': authHeader ? 'bearer' : sessionCookie ? 'session' : 'anonymous',
    };
}
