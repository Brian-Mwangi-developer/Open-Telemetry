/**
 * ============================================================================
 * TELEMETRY MODULE - PUBLIC API
 * ============================================================================
 * 
 * This is the main entry point for the telemetry module. It exports all the
 * utilities you need to instrument your Next.js application.
 * 
 * 🎓 LEARNING POINT:
 * A barrel file (index.ts) makes imports cleaner:
 * 
 * Instead of:
 *   import { traceAsync } from '@/lib/telemetry/tracer';
 *   import { recordHttpRequest } from '@/lib/telemetry/metrics';
 *   import { logger } from '@/lib/telemetry/logger';
 * 
 * You can do:
 *   import { traceAsync, recordHttpRequest, logger } from '@/lib/telemetry';
 */

// Re-export configuration
export {
    METRIC_NAMES, SEMANTIC_ATTRIBUTES, TELEMETRY_CONFIG, type MetricName
} from './config';

// Re-export tracing utilities
export {
    addSpanAttributes,
    addSpanEvent, getActiveSpan, getTraceContext, getTracer, recordException, traceAsync, Traced, traceDbOperation,
    traceHttpCall, traceSync
} from './tracer';

// Re-export metrics utilities
export {
    createCounter,
    createHistogram,
    createUpDownCounter, decrementActiveRequests, incrementActiveRequests, recordHttpRequest, recordOrder,
    recordRevenue, recordUserSignup, startTimer,
    withMetrics
} from './metrics';

// Re-export logging utilities
export {
    createChildLogger, logBusinessEvent, logDatabaseQuery, Logger, logger, logHttpRequest,
    logHttpResponse, logSecurityEvent, type LogContext, type LogLevel
} from './logger';

// Re-export OpenTelemetry logger (sends logs to Loki via OTLP)
export { emitOtelLog, otelLog } from './otel-logger';

// Re-export middleware
export {
    extractUserContext, withMetrics as withMetricsMiddleware, withTelemetry, type TelemetryMiddlewareOptions
} from './middleware';

// Re-export initialization
export { initTelemetry } from './init';
