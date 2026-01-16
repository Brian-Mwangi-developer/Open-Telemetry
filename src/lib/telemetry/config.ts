/**
 * ============================================================================
 * OPENTELEMETRY CONFIGURATION
 * ============================================================================
 * 
 * This file centralizes all OpenTelemetry configuration. Having a single
 * source of truth makes it easier to:
 * - Switch between development and production settings
 * - Configure different exporters (Jaeger, Grafana, Datadog, etc.)
 * - Adjust sampling rates based on traffic volume
 * 
 * 🎓 LEARNING POINT:
 * Configuration should be environment-aware. In production, you'll typically
 * export to a managed service, while in development you might use local tools
 * or just console output.
 */

/**
 * Service identification - these attributes are attached to ALL telemetry data
 * 
 * 🎓 LEARNING POINT:
 * In a microservices architecture, the service name helps you filter and
 * identify which service generated the telemetry data. Always set meaningful
 * service names!
 */
export const TELEMETRY_CONFIG = {
    // Service identification
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-telem-app',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',

    // OTLP Exporter endpoints (OpenTelemetry Protocol)
    // 
    // 🎓 ARCHITECTURE - How data flows:
    // 
    //   Next.js App ──OTLP──► OTEL Collector (port 4318)
    //                              │
    //                              ├── Traces ────► Jaeger (UI: localhost:16686)
    //                              │
    //                              ├── Metrics ───► Prometheus scrapes port 8889
    //                              │                (UI: localhost:9090)
    //                              │
    //                              └── Logs ──────► Loki (port 3100)
    //                                               │
    //                                               ▼
    //                                          Grafana (UI: localhost:3001)
    //
    // All three endpoints below point to the OTEL Collector.
    // The collector handles routing each signal type to the correct backend.
    // This is the standard pattern - your app doesn't need to know about
    // Jaeger, Prometheus, or Loki directly!
    //
    otlp: {
        // OTEL Collector endpoint (handles all signal types)
        tracesEndpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
        metricsEndpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
        logsEndpoint: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || 'http://localhost:4318/v1/logs',
    },

    /**
     * Sampling Configuration
     * 
     * 🎓 LEARNING POINT:
     * Sampling determines what percentage of traces are recorded. In high-traffic
     * production environments, you can't record everything (too expensive!).
     * 
     * Common strategies:
     * - AlwaysOn (1.0): Record everything - good for dev/low traffic
     * - AlwaysOff (0.0): Record nothing - useful for load testing
     * - TraceIdRatio (0.1): Record 10% of traces - good for production
     * - ParentBased: Respect parent span's sampling decision
     */
    sampling: {
        // 1.0 = 100% sampling (record all traces) - ONLY for development!
        // In production, consider 0.1 (10%) or even lower for high-traffic apps
        ratio: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    },

    /**
     * Batch Processing Configuration
     * 
     * 🎓 LEARNING POINT:
     * Instead of sending each span individually (expensive!), the SDK batches
     * them and sends periodically. This reduces network overhead significantly.
     */
    batch: {
        // Maximum time to wait before sending a batch (milliseconds)
        scheduledDelayMillis: 5000,
        // Maximum batch size before forcing a send
        maxExportBatchSize: 512,
        // Maximum queue size (drops data if exceeded)
        maxQueueSize: 2048,
    },

    /**
     * Feature Flags
     * 
     * 🎓 LEARNING POINT:
     * Toggle different observability features. In development, you might want
     * console output for easy debugging. In production, you want efficient
     * OTLP export to your observability backend.
     */
    features: {
        // Enable console output for traces (great for development debugging)
        consoleExporter: false,
        // Enable OTLP export (for Jaeger, Grafana, etc.)
        otlpExporter: true,
        // Enable detailed HTTP instrumentation
        httpInstrumentation: true,
        // Enable fetch instrumentation for API calls
        fetchInstrumentation: true,
    },
} as const;

/**
 * Semantic Conventions - Standard attribute names
 * 
 * 🎓 LEARNING POINT:
 * OpenTelemetry defines standard attribute names (semantic conventions).
 * Using these makes your telemetry data interoperable across tools and
 * easier to query. Always prefer standard names over custom ones!
 * 
 * @see https://opentelemetry.io/docs/specs/semconv/
 */
export const SEMANTIC_ATTRIBUTES = {
    // HTTP attributes
    HTTP_METHOD: 'http.method',
    HTTP_URL: 'http.url',
    HTTP_STATUS_CODE: 'http.status_code',
    HTTP_ROUTE: 'http.route',
    HTTP_USER_AGENT: 'http.user_agent',

    // User attributes (custom - not in spec, but useful)
    USER_ID: 'user.id',
    USER_EMAIL: 'user.email',

    // Database attributes
    DB_SYSTEM: 'db.system',
    DB_STATEMENT: 'db.statement',
    DB_OPERATION: 'db.operation',

    // Custom business attributes
    FEATURE_FLAG: 'feature.flag',
    BUSINESS_OPERATION: 'business.operation',
    CART_VALUE: 'cart.value',
    ORDER_ID: 'order.id',
} as const;

/**
 * Custom Metric Names
 * 
 * 🎓 LEARNING POINT:
 * Define your metric names in one place to avoid typos and ensure consistency.
 * Good metric names are:
 * - Descriptive (tells you what it measures)
 * - Namespaced (e.g., 'app.http.requests')
 * - Use dots as separators
 */
export const METRIC_NAMES = {
    // HTTP metrics
    HTTP_REQUEST_DURATION: 'http.server.request.duration',
    HTTP_REQUEST_COUNT: 'http.server.request.count',
    HTTP_ACTIVE_REQUESTS: 'http.server.active_requests',
    HTTP_ERROR_COUNT: 'http.server.error.count',

    // Business metrics
    USER_SIGNUPS: 'business.user.signups',
    ORDERS_PLACED: 'business.orders.placed',
    REVENUE_TOTAL: 'business.revenue.total',

    // System metrics
    CACHE_HIT_RATE: 'system.cache.hit_rate',
    QUEUE_SIZE: 'system.queue.size',
} as const;

export type MetricName = typeof METRIC_NAMES[keyof typeof METRIC_NAMES];


