# 🔭 OpenTelemetry Learning Lab for Next.js

A comprehensive, production-ready OpenTelemetry implementation for Next.js with an interactive learning dashboard.

![OpenTelemetry + Next.js](https://img.shields.io/badge/OpenTelemetry-Next.js-blue?style=for-the-badge&logo=opentelemetry)

## 🎯 What You'll Learn

This project teaches you the **three pillars of observability**:

1. **📍 Traces** - Follow requests through your system
2. **📊 Metrics** - Numerical measurements over time
3. **📝 Logs** - Structured event records with trace correlation

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Start the Observability Backend (Optional but Recommended)

Start Docker Desktop, then run:

```bash
docker-compose up -d
```

This starts:

- **Jaeger** - Trace visualization at [http://localhost:16686](http://localhost:16686)
- **Prometheus** - Trace Metrics from the App on port 9090
- **Loki** - Visualize the App logs using pino on port 3100 but available in UI in grafana -> explore -> Loki
- **Grafana** - Visualize the different data from the above port 3001 
- **OTLP Collector** - Receives telemetry on port 4318

### 3. Run the Next.js App

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the interactive dashboard.

#### To see logs in your Machine Terminal

Open src/lib/telemetry/logger and change pino  level config from silent to info

## 📁 Project Structure

```
src/
├── instrumentation.ts          # OpenTelemetry SDK initialization
├── lib/telemetry/
│   ├── config.ts               # Configuration & constants
│   ├── tracer.ts               # Tracing utilities
│   ├── metrics.ts              # Metrics utilities
│   ├── logger.ts               # Structured logging
│   ├── middleware.ts           # API route middleware
│   ├── hooks.ts                # React hooks for client telemetry
│   ├── init.ts                 # SDK setup
│   └── index.ts                # Public API exports
├── app/
│   ├── page.tsx                # Interactive dashboard
│   └── api/
│       ├── users/route.ts      # Demo: Users API with tracing
│       ├── orders/route.ts     # Demo: Complex traces
│       └── telemetry/route.ts  # Client event ingestion
```

## 🎓 Learning Path

### Level 1: Basic Tracing

Start with [src/app/api/users/route.ts](src/app/api/users/route.ts) to see:

- How to wrap API routes with `withTelemetry()`
- Creating custom spans with `traceAsync()`
- Adding attributes and events to spans

### Level 2: Complex Traces

Check [src/app/api/orders/route.ts](src/app/api/orders/route.ts) for:

- Multi-step operations with child spans
- External API calls (simulated payment)
- Error handling in traces

### Level 3: Metrics & Business Analytics

Explore [src/lib/telemetry/metrics.ts](src/lib/telemetry/metrics.ts):

- Counters, histograms, and gauges
- HTTP request metrics
- Business metrics (orders, revenue)

### Level 4: Structured Logging

See [src/lib/telemetry/logger.ts](src/lib/telemetry/logger.ts):

- JSON structured logs
- Trace correlation (trace_id in every log)
- Log levels and best practices

### Level 5: Client-Side Telemetry

Check [src/lib/telemetry/hooks.ts](src/lib/telemetry/hooks.ts):

- Page view tracking
- Core Web Vitals
- User interaction tracking

## 🔧 Configuration

All telemetry configuration is in [src/lib/telemetry/config.ts](src/lib/telemetry/config.ts):

```typescript
export const TELEMETRY_CONFIG = {
  serviceName: "nextjs-telem-app",
  serviceVersion: "1.0.0",
  environment: process.env.NODE_ENV,

  otlp: {
    tracesEndpoint: "http://localhost:4318/v1/traces",
    metricsEndpoint: "http://localhost:4318/v1/metrics",
    logsEndpoint: "http://localhost:4318/v1/logs",
  },

  sampling: {
    ratio: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  },
};
```

## 📊 Viewing Your Telemetry

### Traces (Jaeger)

1. Make some API calls in the dashboard
2. Open [http://localhost:16686](http://localhost:16686)
3. Select service: `nextjs-telem-app`
4. Click "Find Traces"

### Console Output (Development)

In development, traces and logs are also printed to the console for easy debugging.

## 🏭 Production Deployment

For production, update these settings:

1. **Sampling** - Reduce to 1-10% for high-traffic apps
2. **Endpoints** - Point to your observability backend (Grafana Cloud, Honeycomb, Datadog, etc.)
3. **Authentication** - Add API keys in exporter headers
4. **Console Export** - Disable for performance

Example production config:

```typescript
const TELEMETRY_CONFIG = {
  sampling: { ratio: 0.1 },
  otlp: {
    tracesEndpoint: "https://otel.your-provider.com/v1/traces",
  },
  features: {
    consoleExporter: false,
    otlpExporter: true,
  },
};
```

## 🎨 Tech Stack

- **Next.js 16** - React framework
- **OpenTelemetry** - Observability framework
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Pino** - Fast JSON logger
- **Jaeger** - Trace visualization

## 📚 Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)

## 📄 License

MIT - Feel free to use this as a template for your projects!

---

Made with ❤️ for learning OpenTelemetry
