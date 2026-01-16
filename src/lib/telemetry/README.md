# OpenTelemetry in Next.js - Learning Guide

## 🎯 What is OpenTelemetry?

OpenTelemetry (OTel) is an open-source observability framework that provides a single set of APIs, libraries, agents, and instrumentation to capture distributed traces, metrics, and logs from your application.

## 📚 Three Pillars of Observability

### 1. **Traces** 🔍

- Track the journey of a request through your system
- Shows parent-child relationships between operations
- Helps identify bottlenecks and errors
- **Key Concepts:**
  - **Span**: A single unit of work (e.g., HTTP request, database query)
  - **Trace**: Collection of spans that share a trace ID
  - **Context**: Carries trace information across service boundaries

### 2. **Metrics** 📊

- Numerical measurements collected over time
- Great for dashboards and alerting
- **Types:**
  - **Counter**: Always increasing (e.g., request count)
  - **Gauge**: Can go up or down (e.g., active connections)
  - **Histogram**: Distribution of values (e.g., response times)

### 3. **Logs** 📝

- Timestamped text records of events
- Correlated with traces using trace IDs
- Great for debugging specific issues

## 🏗️ Architecture in This Project

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Next.js App                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Application Code                           ││
│  │  • API Routes  • Server Components  • Client Components ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │           OpenTelemetry SDK (instrumentation.ts)        ││
│  │  • TracerProvider  • MeterProvider  • LoggerProvider    ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Exporters                            ││
│  │  • OTLP HTTP (to Jaeger/Grafana)  • Console (dev)       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Observability Backend (Local)                  │
│  • Jaeger (Traces)  • Prometheus (Metrics)  • Loki (Logs)   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
src/lib/telemetry/
├── README.md           # This file - learning guide
├── config.ts           # Configuration constants
├── tracer.ts           # Tracing utilities
├── metrics.ts          # Metrics utilities
├── logger.ts           # Logging utilities
├── middleware.ts       # Request/Response tracking
└── hooks.ts            # React hooks for client telemetry
```

## 🚀 Getting Started

1. Start the observability stack: `docker-compose up -d`
2. Run your Next.js app: `bun dev`
3. View traces at: http://localhost:16686 (Jaeger)
4. View metrics at: http://localhost:9090 (Prometheus)
5. View logs at: http://localhost:3100 (Loki/Grafana)

## 🎓 Key Learning Points

1. **Instrumentation bootstraps early** - We use `instrumentation.ts` in Next.js
2. **Context propagation is automatic** - OTel handles passing trace context
3. **Semantic conventions matter** - Use standard attribute names
4. **Sampling controls volume** - Don't trace everything in production
5. **Correlation is key** - Link logs to traces using trace IDs
