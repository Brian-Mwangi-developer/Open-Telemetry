'use client';

/**
 * ============================================================================
 * CLIENT-SIDE TELEMETRY HOOKS
 * ============================================================================
 * 
 * These hooks bring observability to your React components. While server-side
 * telemetry is crucial, client-side telemetry helps you understand:
 * - User interactions (clicks, form submissions)
 * - Page performance (Core Web Vitals)
 * - Client-side errors
 * - User journeys through your app
 * 
 * 🎓 LEARNING POINTS:
 * 
 * 1. CLIENT VS SERVER TELEMETRY:
 *    - Server: Automatic with OpenTelemetry SDK
 *    - Client: Manual, sent via API or beacon
 * 
 * 2. PERFORMANCE METRICS (Core Web Vitals):
 *    - LCP (Largest Contentful Paint): Loading performance
 *    - FID (First Input Delay): Interactivity
 *    - CLS (Cumulative Layout Shift): Visual stability
 * 
 * 3. USER INTERACTION TRACKING:
 *    - Track meaningful actions, not everything
 *    - Include context that helps debugging
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * Telemetry event that can be sent to the server, name,timestamp,properties,type
 */
interface TelemetryEvent {
    name: string;
    timestamp: number;
    properties: Record<string, unknown>;
    type: 'trace' | 'metric' | 'log';
}

/**
 * Queue of events to be sent
 * 🎓 We batch events to reduce network requests
 */
const eventQueue: TelemetryEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

/**
 * Send events to the telemetry API
 * 
 * 🎓 LEARNING POINT:
 * We use the Beacon API when available because:
 * - It's guaranteed to send even when the page is closing
 * - It doesn't block the main thread
 * - Perfect for analytics/telemetry data
 */
function flushEvents(): void {
    if (eventQueue.length === 0) return;

    const events = [...eventQueue];
    eventQueue.length = 0;

    // Use sendBeacon for reliability, fall back to fetch
    const payload = JSON.stringify({ events });

    if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry', payload);
    } else {
        fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            // 🎓 keepalive ensures the request completes even if page closes
            keepalive: true,
        }).catch(() => {
            // Silently fail - telemetry should never break the app
        });
    }
}

/**
 * Queue an event to be sent
 */
function queueEvent(event: TelemetryEvent): void {
    eventQueue.push(event);

    // 🎓 Debounce: Wait 1 second before flushing
    // This batches rapid events together
    if (flushTimeout) {
        clearTimeout(flushTimeout);
    }
    flushTimeout = setTimeout(flushEvents, 1000);
}

// Flush on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushEvents();
        }
    });

    window.addEventListener('beforeunload', flushEvents);
}

/**
 * Hook to track user actions/events
 * 
 * 🎓 LEARNING POINT:
 * Track meaningful user actions, not every click.
 * Good events: "add_to_cart", "checkout_started", "search_performed"
 * Bad events: "button_clicked", "div_hovered" (too generic)
 * 
 * @example
 * function ProductCard({ product }) {
 *   const trackEvent = useTrackEvent();
 *   
 *   const handleAddToCart = () => {
 *     trackEvent('add_to_cart', {
 *       productId: product.id,
 *       productName: product.name,
 *       price: product.price,
 *     });
 *     addToCart(product);
 *   };
 *   
 *   return <button onClick={handleAddToCart}>Add to Cart</button>;
 * }
 */
export function useTrackEvent() {
    const track = useCallback((
        name: string,
        properties: Record<string, unknown> = {}
    ) => {
        queueEvent({
            name,
            timestamp: Date.now(),
            properties: {
                ...properties,
                // 🎓 Automatically include useful context
                url: window.location.href,
                pathname: window.location.pathname,
                referrer: document.referrer || undefined,
                userAgent: navigator.userAgent,
                // Screen info for debugging layout issues
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
            },
            type: 'trace',
        });
    }, []);

    return track;
}

/**
 * Hook to measure component render time
 * 
 * 🎓 LEARNING POINT:
 * Slow components = bad UX. This hook helps identify:
 * - Components that take too long to render
 * - Performance regressions
 * - Heavy components that need optimization
 * 
 * @example
 * function ExpensiveComponent({ data }) {
 *   const measureRender = useMeasureRender('ExpensiveComponent');
 *   
 *   useEffect(() => {
 *     measureRender.end();
 *   }, []);
 *   
 *   // ... heavy rendering logic
 * }
 */
export function useMeasureRender(componentName: string) {
    const startTime = useRef<number | null>(null);

    // Initialize on first render
    useEffect(() => {
        startTime.current = performance.now();
    }, []);

    const end = useCallback(() => {
        if (startTime.current === null) return;
        const duration = performance.now() - startTime.current;

        // 🎓 Only report if render took significant time
        if (duration > 16) { // More than one frame (60fps = 16.67ms)
            queueEvent({
                name: 'component_render',
                timestamp: Date.now(),
                properties: {
                    component: componentName,
                    duration,
                    slow: duration > 100,
                },
                type: 'metric',
            });
        }
    }, [componentName]);

    return { end };
}

/**
 * Hook to track page views
 * 
 * 🎓 LEARNING POINT:
 * Page view tracking is fundamental for:
 * - Understanding user navigation patterns
 * - Identifying popular/unpopular pages
 * - Measuring conversion funnels
 * 
 * @example
 * function Layout({ children }) {
 *   usePageView();
 *   return <div>{children}</div>;
 * }
 */
export function usePageView() {
    useEffect(() => {
        queueEvent({
            name: 'page_view',
            timestamp: Date.now(),
            properties: {
                url: window.location.href,
                pathname: window.location.pathname,
                search: window.location.search,
                referrer: document.referrer || undefined,
                title: document.title,
            },
            type: 'trace',
        });
    }, []);
}

/**
 * Hook to track Core Web Vitals
 * 
 * 🎓 LEARNING POINT:
 * Core Web Vitals are Google's metrics for user experience:
 * - LCP (Largest Contentful Paint): <2.5s is good
 * - FID (First Input Delay): <100ms is good
 * - CLS (Cumulative Layout Shift): <0.1 is good
 * 
 * These affect SEO ranking and user satisfaction!
 * 
 * @example
 * function App({ children }) {
 *   useWebVitals();
 *   return <>{children}</>;
 * }
 */
export function useWebVitals() {
    useEffect(() => {
        // 🎓 Only run on client
        if (typeof window === 'undefined') return;

        // Track navigation timing
        const reportNavTiming = () => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (navigation) {
                queueEvent({
                    name: 'navigation_timing',
                    timestamp: Date.now(),
                    properties: {
                        // 🎓 Key timing metrics
                        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
                        tcp: navigation.connectEnd - navigation.connectStart,
                        ttfb: navigation.responseStart - navigation.requestStart,
                        download: navigation.responseEnd - navigation.responseStart,
                        domParse: navigation.domInteractive - navigation.responseEnd,
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                        load: navigation.loadEventEnd - navigation.loadEventStart,
                        // Total page load time
                        total: navigation.loadEventEnd - navigation.startTime,
                    },
                    type: 'metric',
                });
            }
        };

        // Wait for load to complete
        if (document.readyState === 'complete') {
            reportNavTiming();
        } else {
            window.addEventListener('load', reportNavTiming);
            return () => window.removeEventListener('load', reportNavTiming);
        }
    }, []);

    useEffect(() => {
        // 🎓 Track LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];

            queueEvent({
                name: 'web_vital_lcp',
                timestamp: Date.now(),
                properties: {
                    value: lastEntry.startTime,
                    good: lastEntry.startTime < 2500,
                },
                type: 'metric',
            });
        });

        try {
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
            // LCP not supported
        }

        // 🎓 Track CLS (Cumulative Layout Shift)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // TypeScript doesn't know about LayoutShift entries
                const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
                if (!layoutShift.hadRecentInput) {
                    clsValue += layoutShift.value;
                }
            }
        });

        try {
            clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch {
            // CLS not supported
        }

        // Report CLS when page is hidden
        const reportCLS = () => {
            queueEvent({
                name: 'web_vital_cls',
                timestamp: Date.now(),
                properties: {
                    value: clsValue,
                    good: clsValue < 0.1,
                },
                type: 'metric',
            });
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                reportCLS();
            }
        });

        return () => {
            lcpObserver.disconnect();
            clsObserver.disconnect();
        };
    }, []);
}

/**
 * Hook to track errors in a component
 * 
 * 🎓 LEARNING POINT:
 * Client-side errors are invisible unless you track them.
 * This helps you catch errors that only happen on users' devices.
 * 
 * @example
 * function MyComponent() {
 *   const { trackError } = useErrorTracking('MyComponent');
 *   
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       trackError(error as Error, { action: 'riskyOperation' });
 *     }
 *   };
 * }
 */
export function useErrorTracking(componentName: string) {
    const trackError = useCallback((
        error: Error,
        context: Record<string, unknown> = {}
    ) => {
        queueEvent({
            name: 'client_error',
            timestamp: Date.now(),
            properties: {
                component: componentName,
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                },
                ...context,
                url: window.location.href,
            },
            type: 'log',
        });
    }, [componentName]);

    return { trackError };
}

/**
 * Hook to track time spent on a page/section
 * 
 * 🎓 LEARNING POINT:
 * Time-on-page tells you about user engagement.
 * High time + low bounce = good content
 * Low time + high bounce = problem
 * 
 * @example
 * function ArticlePage({ article }) {
 *   useTimeOnPage('article', { articleId: article.id });
 *   return <article>...</article>;
 * }
 */
export function useTimeOnPage(
    pageName: string,
    properties: Record<string, unknown> = {}
) {
    const startTime = useRef<number>(0);

    useEffect(() => {
        startTime.current = Date.now();

        return () => {
            const timeSpent = Date.now() - startTime.current;

            queueEvent({
                name: 'time_on_page',
                timestamp: Date.now(),
                properties: {
                    page: pageName,
                    duration: timeSpent,
                    durationSeconds: Math.round(timeSpent / 1000),
                    ...properties,
                },
                type: 'metric',
            });
        };
    }, [pageName, properties]);
}
