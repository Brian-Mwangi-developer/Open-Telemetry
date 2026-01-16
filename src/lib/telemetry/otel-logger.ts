import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { TELEMETRY_CONFIG } from './config';
import { getTraceContext } from './tracer';


function getOtelLogger() {
    return logs.getLogger(TELEMETRY_CONFIG.serviceName);
}

export function emitOtelLog(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    attributes: Record<string, unknown> = {}
) {
    const severityMap: Record<string, SeverityNumber> = {
        debug: SeverityNumber.DEBUG,
        info: SeverityNumber.INFO,
        warn: SeverityNumber.WARN,
        error: SeverityNumber.ERROR,
        fatal: SeverityNumber.FATAL,
    };

    const { traceId, spanId } = getTraceContext();

    getOtelLogger().emit({
        severityNumber: severityMap[level],
        severityText: level.toUpperCase(),
        body: message,
        attributes: {
            ...attributes,
            'service.name': TELEMETRY_CONFIG.serviceName,
            trace_id: traceId,
            span_id: spanId,
        },
    });
}


export const otelLog = {
    debug: (msg: string, attrs?: Record<string, unknown>) => emitOtelLog('debug', msg, attrs),
    info: (msg: string, attrs?: Record<string, unknown>) => emitOtelLog('info', msg, attrs),
    warn: (msg: string, attrs?: Record<string, unknown>) => emitOtelLog('warn', msg, attrs),
    error: (msg: string, attrs?: Record<string, unknown>) => emitOtelLog('error', msg, attrs),
    fatal: (msg: string, attrs?: Record<string, unknown>) => emitOtelLog('fatal', msg, attrs),
};