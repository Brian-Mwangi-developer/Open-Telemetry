/**
 * ============================================================================
 * OPENTELEMETRY SDK INITIALIZATION (NEXT.JS INSTRUMENTATION)
 * ============================================================================
 * 
 * This is the MOST IMPORTANT file for OpenTelemetry in Next.js!
 * 
 * 🎓 LEARNING POINT - HOW NEXT.JS INSTRUMENTATION WORKS:
 * 
 * Next.js has a special file called `instrumentation.ts` in the src/ folder.
 * When you export a `register()` function, Next.js calls it ONCE when the
 * server starts, BEFORE any request handling. This is the perfect place to
 * initialize OpenTelemetry.
 * 
 * WHY THIS MATTERS:
 * 1. OpenTelemetry needs to patch Node.js modules (http, fetch, etc.)
 * 2. Patching must happen BEFORE those modules are imported elsewhere
 * 3. The register() function runs early enough for this to work
 * 
 * WHAT THIS FILE SETS UP:
 * 1. TracerProvider - Creates and exports spans
 * 2. MeterProvider - Creates and exports metrics
 * 3. LoggerProvider - Creates and exports logs
 * 4. Auto-instrumentation - Automatically traces HTTP, fetch, etc.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'; // opentelemetry collector for logs
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'; // opentelemetry collector for metrics
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'; // opentelemetry collector for Traces
// below we have log exporters
//BatchLog- batches the logs before Emition
//ConsoleLog- Prints the Logs to the Console mostly used in Development
//SimpleLog - Emits Indiviual Logs as emitted and thus may cause overhead performance
import { BatchLogRecordProcessor, ConsoleLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
// PeriodicMetricReader - define the timestamp of when to Export metrics
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
//ResourceFromAttributes -Adds Metadata about who is sending the traces 
import { resourceFromAttributes } from '@opentelemetry/resources';
//Logs spans - A span is a timed record of a single operation. It answers: "What happened, how long did it take, did it succeed?"
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
// just naming convention to the different services
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { TELEMETRY_CONFIG } from './config';

/**
 * Initialize the OpenTelemetry SDK
 * 
 * 🎓 LEARNING POINT:
 * The SDK is the "brain" of OpenTelemetry. It:
 * - Creates providers for traces, metrics, and logs
 * - Configures how data is processed and exported
 * - Registers instrumentations that auto-capture telemetry
 */
export function initTelemetry(): NodeSDK {
    console.log('🔭 Initializing OpenTelemetry SDK...');

    /**
     * RESOURCE
     * 
     * 🎓 LEARNING POINT:
     * A Resource describes WHO is producing telemetry. Every span, metric,
     * and log will have these attributes attached. This helps you filter
     * by service, version, environment, etc.
     */
    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: TELEMETRY_CONFIG.serviceName,
        [ATTR_SERVICE_VERSION]: TELEMETRY_CONFIG.serviceVersion,
        'deployment.environment': TELEMETRY_CONFIG.environment,
        // 🎓 Add any custom resource attributes here
        'host.name': process.env.HOSTNAME || 'localhost',
    });

    /**
     * TRACE EXPORTER
     * 
     * 🎓 LEARNING POINT:
     * Exporters send telemetry to backends. OTLP (OpenTelemetry Protocol)
     * is the standard format understood by most observability tools:
     * - Jaeger
     * - Grafana Tempo
     * - Honeycomb
     * - Datadog
     * - New Relic
     * - And many more!
     */
    const traceExporter = new OTLPTraceExporter({
        url: TELEMETRY_CONFIG.otlp.tracesEndpoint,
        // 🎓 Headers for authentication (when using cloud providers)
        // headers: {
        //   'Authorization': `Bearer ${process.env.OTLP_API_KEY}`,
        // },
    });

    /**
     * SPAN PROCESSOR
     * 
     * 🎓 LEARNING POINT:
     * Span Processors handle spans before export. Two main types:
     * 
     * 1. BatchSpanProcessor (PRODUCTION):
     *    - Batches spans and sends periodically
     *    - Much more efficient (fewer network calls)
     *    - May lose data on crash (data in buffer)
     * 
     * 2. SimpleSpanProcessor (DEVELOPMENT):
     *    - Sends each span immediately
     *    - Slower but data is never lost
     *    - Great for debugging
     */
    const spanProcessors = [];

    // OTLP exporter (always enabled)
    // Here we are telling the  trace exporter when to export and how much data to export in the batches
    if (TELEMETRY_CONFIG.features.otlpExporter) {
        spanProcessors.push(
            new BatchSpanProcessor(traceExporter, {
                // 🎓 Batch configuration for production efficiency
                scheduledDelayMillis: TELEMETRY_CONFIG.batch.scheduledDelayMillis,
                maxExportBatchSize: TELEMETRY_CONFIG.batch.maxExportBatchSize,
                maxQueueSize: TELEMETRY_CONFIG.batch.maxQueueSize,
            })
        );
    }

    // Console exporter (development only)
    //causes the App to send the traces in the console of the server
    if (TELEMETRY_CONFIG.features.consoleExporter) {
        spanProcessors.push(
            new SimpleSpanProcessor(new ConsoleSpanExporter())
        );
    }

    /**
     * METRIC EXPORTER
     * 
     * 🎓 LEARNING POINT:
     * Metrics are exported periodically (not per-request like traces).
     * The PeriodicExportingMetricReader controls the export interval.
     */
    const metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            url: TELEMETRY_CONFIG.otlp.metricsEndpoint,
        }),
        // 🎓 Export metrics every 10 seconds
        // In production, you might increase this to 30-60 seconds
        exportIntervalMillis: 10000,
    });

    /**
     * LOG EXPORTER
     * 
     * 🎓 LEARNING POINT:
     * OpenTelemetry can also export logs! This correlates logs with traces
     * automatically using the trace context.
     */
    const logProcessors = [];

    if (TELEMETRY_CONFIG.features.otlpExporter) {
        logProcessors.push(
            new BatchLogRecordProcessor(
                new OTLPLogExporter({
                    url: TELEMETRY_CONFIG.otlp.logsEndpoint,
                })
            )
        );
    }

    if (TELEMETRY_CONFIG.features.consoleExporter) {
        logProcessors.push(
            new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())
        );
    }

    /**
     * AUTO-INSTRUMENTATIONS
     * 
     * 🎓 LEARNING POINT:
     * Auto-instrumentation is MAGIC! It automatically creates spans for:
     * - HTTP requests (incoming and outgoing)
     * - Fetch calls
     * - Database clients (pg, mysql, mongodb, redis, etc.)
     * - gRPC calls
     * - And much more!
     * 
     * You don't have to manually trace these - it just works!
     */
    const instrumentations = getNodeAutoInstrumentations({
        // 🎓 Configure specific instrumentations
        '@opentelemetry/instrumentation-http': {
            enabled: TELEMETRY_CONFIG.features.httpInstrumentation,
            // Ignore health check endpoints (they're just noise)
            ignoreIncomingRequestHook: (request) => {
                const url = request.url || '';
                return url.includes('/health') || url.includes('/ready') || url.includes('/_next');
            },
        },
        // 🎓 Disable instrumentations you don't need
        // This reduces overhead and noise
        '@opentelemetry/instrumentation-fs': {
            enabled: false, // File system ops are usually too noisy
        },
        '@opentelemetry/instrumentation-dns': {
            enabled: false, // DNS lookups are usually not interesting
        },
    });

    /**
     * CREATE THE SDK
     * 
     * 🎓 LEARNING POINT:
     * The NodeSDK ties everything together. It:
     * - Registers the TracerProvider globally
     * - Registers the MeterProvider globally
     * - Registers the LoggerProvider globally
     * - Enables all auto-instrumentations
     */
    const sdk = new NodeSDK({
        resource,
        spanProcessors,
        metricReader,
        logRecordProcessors: logProcessors,
        instrumentations,
    });

    // Start the SDK
    sdk.start();

    console.log('✅ OpenTelemetry SDK initialized successfully!');
    console.log(`   Service: ${TELEMETRY_CONFIG.serviceName}`);
    console.log(`   Environment: ${TELEMETRY_CONFIG.environment}`);
    console.log(`   Traces: ${TELEMETRY_CONFIG.otlp.tracesEndpoint}`);
    console.log(`   Metrics: ${TELEMETRY_CONFIG.otlp.metricsEndpoint}`);

    /**
     * GRACEFUL SHUTDOWN
     * 
     * 🎓 LEARNING POINT:
     * When your app shuts down, you need to flush any buffered telemetry.
     * Otherwise, data in the batch buffers will be lost!
     */
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs') {
        process.on('SIGTERM', () => {
            sdk.shutdown()
                .then(() => console.log('🔭 OpenTelemetry SDK shut down successfully'))
                .catch((error) => console.error('🔭 Error shutting down OpenTelemetry SDK', error))
                .finally(() => process.exit(0));
        });
    }

    return sdk;
}
