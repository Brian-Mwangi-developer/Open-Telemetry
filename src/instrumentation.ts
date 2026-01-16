/**
 * ============================================================================
 * NEXT.JS INSTRUMENTATION ENTRY POINT
 * ============================================================================
 * 
 * 🎓 THIS FILE IS SPECIAL!
 * 
 * Next.js looks for this file at `src/instrumentation.ts` (or `instrumentation.ts`
 * in the root). When found, it calls the `register()` function during server
 * startup, BEFORE any request handling begins.
 * 
 * WHY THIS MATTERS FOR OPENTELEMETRY:
 * 
 * OpenTelemetry works by "monkey-patching" Node.js modules like `http`, `https`,
 * and database clients. For this patching to work correctly, it MUST happen
 * before those modules are imported by your application code.
 * 
 * The `register()` function runs early enough in the Next.js lifecycle for
 * this patching to work correctly. If you try to initialize OpenTelemetry
 * later (e.g., in a route handler), it won't be able to capture all traces.
 * 
 * WHAT HAPPENS:
 * 1. Next.js starts
 * 2. Next.js finds this file
 * 3. Next.js calls register()
 * 4. We initialize OpenTelemetry
 * 5. OpenTelemetry patches Node.js modules
 * 6. Your application code loads (with patched modules)
 * 7. All HTTP/DB calls are automatically traced!
 * 
 * IMPORTANT NOTES:
 * - This function is called ONCE per server instance
 * - In development, it may be called multiple times due to hot reload
 * - The function must be synchronous (no await at top level)
 * - Only initialize on the Node.js runtime, not Edge runtime
 */

import { initTelemetry } from './lib/telemetry';

/**
 * Register function - called by Next.js during server startup
 * 
 * 🎓 LEARNING POINT:
 * We check `process.env.NEXT_RUNTIME` to only initialize on the Node.js
 * server, not on Edge runtime or during static generation.
 */
export async function register() {
    /**
     * 🎓 RUNTIME CHECK
     * 
     * Next.js runs code in different runtimes:
     * - 'nodejs': Traditional Node.js server (what we want)
     * - 'edge': Edge runtime (V8 isolates, limited APIs)
     * - undefined: During build/static generation
     * 
     * OpenTelemetry's NodeSDK only works in Node.js runtime.
     */
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('🚀 Next.js server starting in Node.js runtime');

        // Initialize OpenTelemetry
        initTelemetry();

        console.log('📊 Telemetry is now active!');
        console.log('');
        console.log('📚 Quick Reference:');
        console.log('   • Traces endpoint: http://localhost:4318/v1/traces');
        console.log('   • Metrics endpoint: http://localhost:4318/v1/metrics');
        console.log('   • View traces: http://localhost:16686 (Jaeger)');
        console.log('');
    } else {
        console.log(`⏭️ Skipping telemetry init (runtime: ${process.env.NEXT_RUNTIME || 'build'})`);
    }
}

/**
 * 🎓 ADVANCED: onRequestError hook (Next.js 15+)
 * 
 * This experimental hook allows you to capture and report errors
 * that occur during request handling. It's called for both client
 * and server errors.
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function onRequestError(
    error: { digest: string } & Error,
    request: {
        path: string;
        method: string;
        headers: { [key: string]: string };
    },
    context: {
        routerKind: 'Pages Router' | 'App Router';
        routePath: string;
        routeType: 'render' | 'route' | 'action' | 'middleware';
        renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
        revalidateReason: 'on-demand' | 'stale' | undefined;
    }
) {
    // 🎓 This is where you'd send errors to your error tracking service
    // In a real app, you might use Sentry, Bugsnag, etc.

    console.error('🔴 Request Error:', {
        error: {
            message: error.message,
            digest: error.digest,
            stack: error.stack,
        },
        request: {
            path: request.path,
            method: request.method,
        },
        context: {
            routerKind: context.routerKind,
            routePath: context.routePath,
            routeType: context.routeType,
        },
    });

    // Example: Report to error tracking service
    // await reportToSentry(error, request, context);
}
