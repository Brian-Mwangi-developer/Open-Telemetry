/**
 * ============================================================================
 * METRICS UTILITIES
 * ============================================================================
 * 
 * Metrics are numerical measurements that tell you about your system's behavior
 * over time. Unlike traces (which are per-request), metrics are aggregated data.
 * 
 * 🎓 LEARNING POINTS:
 * 
 * 1. METRIC TYPES:
 *    - Counter: Only goes up (requests, errors, bytes sent)
 *    - UpDownCounter: Can go up or down (active connections, queue size)
 *    - Histogram: Distribution of values (latency, request size)
 *    - Gauge: Point-in-time value (CPU usage, memory) - use Observable
 * 
 * 2. DIMENSIONS/LABELS:
 *    - Attributes that segment your metrics
 *    - Example: http_requests_total{method="GET", status="200"}
 *    - ⚠️ WARNING: High cardinality = expensive! Don't use user IDs as labels.
 * 
 * 3. AGGREGATION:
 *    - Metrics are aggregated before export (sum, count, histogram buckets)
 *    - This makes them efficient for dashboards and alerting
 */

import { Attributes, Counter, Histogram, metrics, UpDownCounter } from '@opentelemetry/api';
import { METRIC_NAMES, TELEMETRY_CONFIG } from './config';

/**
 * Get the meter instance for creating metrics
 * 
 * 🎓 LEARNING POINT:
 * A Meter is like a Tracer, but for metrics. It's named after your service
 * so metrics can be grouped and filtered.
 */
function getMeter() {
    return metrics.getMeter(TELEMETRY_CONFIG.serviceName);
}

// ============================================================================
// HTTP METRICS
// ============================================================================

/**
 * 🎓 LEARNING POINT: Lazy initialization
 * We create metrics lazily (on first use) because the MeterProvider
 * might not be set up yet when this module loads.
 */
let httpRequestCounter: Counter | null = null;
let httpRequestDuration: Histogram | null = null;
let httpActiveRequests: UpDownCounter | null = null;
let httpErrorCounter: Counter | null = null;

/**
 * Get or create the HTTP request counter
 * 
 * 🎓 LEARNING POINT:
 * A Counter is the simplest metric type - it only goes up.
 * Perfect for counting events like requests, errors, or bytes.
 */
function getHttpRequestCounter(): Counter {
    if (!httpRequestCounter) {
        httpRequestCounter = getMeter().createCounter(METRIC_NAMES.HTTP_REQUEST_COUNT, {
            description: 'Total number of HTTP requests',
            unit: 'requests',
        });
    }
    return httpRequestCounter;
}

/**
 * Get or create the HTTP request duration histogram
 * 
 * 🎓 LEARNING POINT:
 * Histograms track the distribution of values. They automatically create
 * "buckets" (ranges) so you can answer questions like:
 * - What's the p50/p95/p99 latency?
 * - How many requests took longer than 1 second?
 */
function getHttpRequestDuration(): Histogram {
    if (!httpRequestDuration) {
        httpRequestDuration = getMeter().createHistogram(METRIC_NAMES.HTTP_REQUEST_DURATION, {
            description: 'Duration of HTTP requests',
            unit: 'ms',
            // 🎓 Custom buckets for latency (in milliseconds)
            // Adjust based on your application's expected latency
            // These create buckets: <10ms, <50ms, <100ms, <250ms, <500ms, <1s, <2.5s, <5s, <10s
            advice: {
                explicitBucketBoundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
            },
        });
    }
    return httpRequestDuration;
}

/**
 * Get or create the active HTTP requests gauge
 * 
 * 🎓 LEARNING POINT:
 * An UpDownCounter can increase or decrease. Perfect for tracking
 * concurrent/active things like connections, in-flight requests, or queue size.
 */
function getHttpActiveRequests(): UpDownCounter {
    if (!httpActiveRequests) {
        httpActiveRequests = getMeter().createUpDownCounter(METRIC_NAMES.HTTP_ACTIVE_REQUESTS, {
            description: 'Number of active HTTP requests',
            unit: 'requests',
        });
    }
    return httpActiveRequests;
}

/**
 * Get or create the HTTP error counter
 */
function getHttpErrorCounter(): Counter {
    if (!httpErrorCounter) {
        httpErrorCounter = getMeter().createCounter(METRIC_NAMES.HTTP_ERROR_COUNT, {
            description: 'Total number of HTTP errors',
            unit: 'errors',
        });
    }
    return httpErrorCounter;
}

/**
 * Record an HTTP request with all relevant metrics
 * 
 * 🎓 LEARNING POINT:
 * This is a "metrics wrapper" that records multiple metrics for a single
 * HTTP request. It's common to track:
 * - Request count (how many?)
 * - Duration (how fast?)
 * - Error rate (how reliable?)
 * - Active requests (how busy?)
 * 
 * @example
 * // In your API route or middleware:
 * const startTime = performance.now();
 * httpActiveRequests.increment();
 * 
 * try {
 *   const response = await handleRequest(req);
 *   recordHttpRequest({
 *     method: 'GET',
 *     route: '/api/users',
 *     statusCode: response.status,
 *     duration: performance.now() - startTime,
 *   });
 * } finally {
 *   httpActiveRequests.decrement();
 * }
 */
export function recordHttpRequest({
    method,
    route,
    statusCode,
    duration,
}: {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
}): void {
    // 🎓 Common attributes for all HTTP metrics
    // Using consistent labels enables easy correlation in dashboards
    const attributes: Attributes = {
        'http.method': method,
        'http.route': route,
        'http.status_code': statusCode,
        // 🎓 Status class helps with aggregation (2xx, 4xx, 5xx)
        'http.status_class': `${Math.floor(statusCode / 100)}xx`,
    };

    // Record request count
    getHttpRequestCounter().add(1, attributes);

    // Record duration
    getHttpRequestDuration().record(duration, attributes);

    // Record errors (4xx and 5xx)
    if (statusCode >= 400) {
        getHttpErrorCounter().add(1, attributes);
    }
}

/**
 * Increment active request count
 */
export function incrementActiveRequests(attributes?: Attributes): void {
    getHttpActiveRequests().add(1, attributes);
}

/**
 * Decrement active request count
 */
export function decrementActiveRequests(attributes?: Attributes): void {
    getHttpActiveRequests().add(-1, attributes);
}

// ============================================================================
// BUSINESS METRICS
// ============================================================================

/**
 * 🎓 LEARNING POINT: Business Metrics
 * 
 * Technical metrics (latency, errors) are important, but business metrics
 * help you understand if your product is working:
 * - User signups
 * - Orders placed
 * - Revenue
 * - Feature usage
 * 
 * These metrics can trigger business alerts like:
 * "Orders dropped by 50% in the last hour!"
 */

let userSignupCounter: Counter | null = null;
let ordersCounter: Counter | null = null;
let revenueHistogram: Histogram | null = null;

/**
 * Record a user signup
 * 
 * @example
 * recordUserSignup({
 *   plan: 'pro',
 *   source: 'google_ads',
 *   referrer: 'techblog.com',
 * });
 */
export function recordUserSignup(attributes?: Attributes): void {
    if (!userSignupCounter) {
        userSignupCounter = getMeter().createCounter(METRIC_NAMES.USER_SIGNUPS, {
            description: 'Total number of user signups',
            unit: 'users',
        });
    }
    userSignupCounter.add(1, attributes);
}

/**
 * Record an order
 * 
 * @example
 * recordOrder({
 *   productCategory: 'electronics',
 *   paymentMethod: 'credit_card',
 *   country: 'US',
 * });
 */
export function recordOrder(attributes?: Attributes): void {
    if (!ordersCounter) {
        ordersCounter = getMeter().createCounter(METRIC_NAMES.ORDERS_PLACED, {
            description: 'Total number of orders placed',
            unit: 'orders',
        });
    }
    ordersCounter.add(1, attributes);
}

/**
 * Record revenue
 * 
 * 🎓 LEARNING POINT:
 * Revenue is tracked as a histogram so you can see:
 * - Average order value
 * - Distribution of order values
 * - Large orders vs small orders
 * 
 * @example
 * recordRevenue(99.99, {
 *   currency: 'USD',
 *   productCategory: 'subscriptions',
 * });
 */
export function recordRevenue(amount: number, attributes?: Attributes): void {
    if (!revenueHistogram) {
        revenueHistogram = getMeter().createHistogram(METRIC_NAMES.REVENUE_TOTAL, {
            description: 'Revenue from orders',
            unit: 'USD',
        });
    }
    revenueHistogram.record(amount, attributes);
}

// ============================================================================
// CUSTOM METRICS FACTORY
// ============================================================================

/**
 * Create a custom counter
 * 
 * 🎓 LEARNING POINT:
 * Sometimes you need metrics specific to your domain. This factory
 * makes it easy to create them on the fly.
 * 
 * @example
 * const apiCallCounter = createCounter('api.external.calls', 'External API calls');
 * apiCallCounter.add(1, { provider: 'stripe', operation: 'create_customer' });
 */
export function createCounter(name: string, description: string, unit = '1'): Counter {
    return getMeter().createCounter(name, { description, unit });
}

/**
 * Create a custom histogram
 * 
 * @example
 * const processingTime = createHistogram('job.processing.time', 'Background job processing time', 'ms');
 * processingTime.record(1234, { jobType: 'email_send' });
 */
export function createHistogram(name: string, description: string, unit = 'ms'): Histogram {
    return getMeter().createHistogram(name, { description, unit });
}

/**
 * Create a custom up-down counter
 * 
 * @example
 * const queueSize = createUpDownCounter('queue.size', 'Number of items in queue');
 * queueSize.add(1);  // Item added
 * queueSize.add(-1); // Item processed
 */
export function createUpDownCounter(name: string, description: string, unit = '1'): UpDownCounter {
    return getMeter().createUpDownCounter(name, { description, unit });
}

// ============================================================================
// METRIC UTILITIES
// ============================================================================

/**
 * Timer utility for measuring durations
 * 
 * 🎓 LEARNING POINT:
 * Measuring duration is so common that a helper function is useful.
 * Use performance.now() for high-resolution timing.
 * 
 * @example
 * const timer = startTimer();
 * await doSomeWork();
 * const duration = timer.end();
 * httpDuration.record(duration);
 */
export function startTimer(): { end: () => number } {
    const start = performance.now();
    return {
        end: () => performance.now() - start,
    };
}

/**
 * Wrap an async function with automatic duration measurement
 * 
 * @example
 * const fetchUser = withMetrics(
 *   async (id: string) => db.users.find(id),
 *   getDbQueryDuration(),
 *   { operation: 'find', table: 'users' }
 * );
 * 
 * const user = await fetchUser('123');
 */
export async function withMetrics<T>(
    fn: () => Promise<T>,
    histogram: Histogram,
    attributes?: Attributes
): Promise<T> {
    const timer = startTimer();
    try {
        return await fn();
    } finally {
        histogram.record(timer.end(), attributes);
    }
}
