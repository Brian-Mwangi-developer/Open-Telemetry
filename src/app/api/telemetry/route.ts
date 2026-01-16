/**
 * ============================================================================
 * TELEMETRY INGESTION API
 * ============================================================================
 * 
 * This endpoint receives client-side telemetry data (from browser).
 * It's used by the client-side hooks to send events, metrics, and logs.
 * 
 * 🎓 LEARNING POINT - CLIENT TELEMETRY ARCHITECTURE:
 * 
 * Browser → POST /api/telemetry → Server → OpenTelemetry Backend
 * 
 * Why not send directly from browser to OTel backend?
 * 1. CORS - OTel collectors may not allow browser origins
 * 2. Authentication - You don't want to expose API keys in browser
 * 3. Enrichment - Server can add server-side context
 * 4. Sampling - You can filter/sample on the server
 * 5. Privacy - You can redact sensitive data before export
 */

import {
    addSpanAttributes,
    createCounter,
    createHistogram,
    logger,
    traceAsync,
    withTelemetry,
} from '@/lib/telemetry';
import { NextRequest, NextResponse } from 'next/server';

// 🎓 Metrics for client telemetry
const clientEventsReceived = createCounter(
    'client.events.received',
    'Number of client-side events received'
);

const webVitalsHistogram = createHistogram(
    'client.web_vitals',
    'Client-side web vitals measurements',
    'ms'
);

interface TelemetryEvent {
    name: string;
    timestamp: number;
    properties: Record<string, unknown>;
    type: 'trace' | 'metric' | 'log';
}

interface TelemetryPayload {
    events: TelemetryEvent[];
}

async function handleTelemetry(request: NextRequest) {
    const body = await request.json() as TelemetryPayload;
    const events = body.events || [];

    addSpanAttributes({
        'telemetry.event_count': events.length,
        'telemetry.source': 'client',
    });

    // 🎓 Process each event
    for (const event of events) {
        clientEventsReceived.add(1, {
            'event.type': event.type,
            'event.name': event.name,
        });

        // Handle different event types
        switch (event.type) {
            case 'metric':
                await processMetricEvent(event);
                break;
            case 'trace':
                await processTraceEvent(event);
                break;
            case 'log':
                await processLogEvent(event);
                break;
        }
    }

    return NextResponse.json({
        success: true,
        processed: events.length
    });
}

/**
 * Process metric events from client
 */
async function processMetricEvent(event: TelemetryEvent) {
    return traceAsync('process.client.metric', async () => {
        const { name, properties } = event;

        // 🎓 Handle Web Vitals specifically
        if (name.startsWith('web_vital_')) {
            const vitalName = name.replace('web_vital_', '');
            const value = properties.value as number;

            webVitalsHistogram.record(value, {
                'vital.name': vitalName,
                'vital.good': String(properties.good),
                'page.url': String(properties.url || ''),
            });

            logger.info({
                webVital: vitalName,
                value,
                good: properties.good,
                url: properties.url,
            }, `Web Vital: ${vitalName}`);
        }

        // Handle navigation timing
        if (name === 'navigation_timing') {
            logger.info({
                timing: properties,
            }, 'Navigation timing received');
        }

        // Handle component render times
        if (name === 'component_render') {
            const duration = properties.duration as number;
            if (properties.slow) {
                logger.warn({
                    component: properties.component,
                    duration,
                }, 'Slow component render detected');
            }
        }
    });
}

/**
 * Process trace events from client
 */
async function processTraceEvent(event: TelemetryEvent) {
    return traceAsync('process.client.trace', async () => {
        const { name, properties } = event;

        // 🎓 Log client actions for debugging and analytics
        logger.info({
            event: name,
            ...properties,
        }, `Client event: ${name}`);

        // You could also:
        // - Store in analytics database
        // - Forward to product analytics (Amplitude, Mixpanel)
        // - Create server-side spans linked to client actions
    });
}

/**
 * Process log events from client
 */
async function processLogEvent(event: TelemetryEvent) {
    return traceAsync('process.client.log', async () => {
        const { name, properties } = event;

        if (name === 'client_error') {
            // 🎓 Client errors should be treated seriously
            logger.error({
                component: properties.component,
                error: properties.error,
                url: properties.url,
            }, 'Client-side error reported');

            // In production, you'd:
            // - Send to error tracking (Sentry, Bugsnag)
            // - Create alerts for critical errors
            // - Track error rates by component
        }
    });
}

export const POST = withTelemetry(handleTelemetry, {
    name: 'POST /api/telemetry',
    customAttributes: {
        'api.category': 'telemetry',
    },
});
