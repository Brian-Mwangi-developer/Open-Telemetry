'use client';

/**
 * ============================================================================
 * TELEMETRY DASHBOARD - MAIN PAGE
 * ============================================================================
 * 
 * This is a beautiful, interactive dashboard that demonstrates OpenTelemetry
 * concepts in action. You can:
 * - Make API calls and see traces generated
 * - View metrics in real-time
 * - Understand the three pillars of observability
 * 
 * 🎓 This page also demonstrates CLIENT-SIDE telemetry using our hooks!
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  GitBranch,
  Layers,
  Play,
  RefreshCw,
  Send,
  ShoppingCart,
  Terminal,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { usePageView, useTrackEvent, useWebVitals } from '@/lib/telemetry/hooks';


interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Order {
  id: string;
  userId: string;
  total: number;
  status: string;
  items: number;
  createdAt: string;
}

interface ApiCall {
  id: string;
  method: string;
  endpoint: string;
  status: 'pending' | 'success' | 'error';
  statusCode?: number;
  duration?: number;
  timestamp: Date;
}

export default function TelemetryDashboard() {
  // 🎓 Client-side telemetry hooks in action!
  usePageView(); // Track page view
  useWebVitals(); // Track Core Web Vitals
  const trackEvent = useTrackEvent();

  // State for API calls
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Make an API call and track it
  const makeApiCall = useCallback(async (
    method: string,
    endpoint: string,
    body?: object
  ) => {
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    // Add to call history
    setApiCalls(prev => [{
      id: callId,
      method,
      endpoint,
      status: 'pending' as const,
      timestamp: new Date(),
    }, ...prev].slice(0, 10));

    setIsLoading(callId);

    // 🎓 Track the API call as a client event
    trackEvent('api_call_initiated', {
      method,
      endpoint,
    });

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      // Update call status
      setApiCalls(prev => prev.map(call =>
        call.id === callId
          ? { ...call, status: response.ok ? 'success' : 'error', statusCode: response.status, duration }
          : call
      ));

      // Track completion
      trackEvent('api_call_completed', {
        method,
        endpoint,
        statusCode: response.status,
        duration,
        success: response.ok,
      });

      return { response, data, duration };
    } catch (error) {
      const duration = performance.now() - startTime;

      setApiCalls(prev => prev.map(call =>
        call.id === callId
          ? { ...call, status: 'error', duration }
          : call
      ));

      trackEvent('api_call_failed', {
        method,
        endpoint,
        error: (error as Error).message,
        duration,
      });

      throw error;
    } finally {
      setIsLoading(null);
    }
  }, [trackEvent]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const { data } = await makeApiCall('GET', '/api/users');
    if (data.success) {
      setUsers(data.data);
    }
  }, [makeApiCall]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    const { data } = await makeApiCall('GET', '/api/orders');
    if (data.success) {
      setOrders(data.data);
    }
  }, [makeApiCall]);

  // Create a new order (demonstrates complex traces)
  const createOrder = useCallback(async () => {
    const orderData = {
      userId: '1',
      items: ['item-1', 'item-2', 'item-3'],
      total: 99.99 + Math.random() * 100,
    };

    await makeApiCall('POST', '/api/orders', orderData);
    // Refresh orders
    await fetchOrders();
  }, [makeApiCall, fetchOrders]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">OpenTelemetry Lab</h1>
                <p className="text-sm text-slate-400">Learn observability by doing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                Telemetry Active
              </Badge>
              <a
                href="http://localhost:16686"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Jaeger
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <Alert className="bg-linear-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/30">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <AlertTitle className="text-emerald-400">Welcome to the OpenTelemetry Learning Lab!</AlertTitle>
            <AlertDescription className="text-slate-300">
              This interactive dashboard demonstrates the three pillars of observability: <strong>Traces</strong>, <strong>Metrics</strong>, and <strong>Logs</strong>.
              Make API calls below and watch as telemetry is collected. Check the console and Jaeger UI to see your traces!
            </AlertDescription>
          </Alert>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="playground" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700 p-1">
            <TabsTrigger value="playground" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Play className="h-4 w-4 mr-2" />
              Playground
            </TabsTrigger>
            <TabsTrigger value="concepts" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <BookOpen className="h-4 w-4 mr-2" />
              Learn Concepts
            </TabsTrigger>
            <TabsTrigger value="architecture" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Layers className="h-4 w-4 mr-2" />
              Architecture
            </TabsTrigger>
          </TabsList>

          {/* Playground Tab */}
          <TabsContent value="playground" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* API Controls */}
              <div className="lg:col-span-2 space-y-6">
                {/* Users API */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Users className="h-5 w-5 text-blue-400" />
                      Users API
                    </CardTitle>
                    <CardDescription>
                      Fetch users to see basic tracing with database operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <Button
                        onClick={fetchUsers}
                        disabled={isLoading !== null}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        GET /api/users
                      </Button>
                    </div>

                    {users.length > 0 && (
                      <div className="rounded-lg border border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-slate-400">Name</th>
                              <th className="px-4 py-2 text-left text-slate-400">Email</th>
                              <th className="px-4 py-2 text-left text-slate-400">Role</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {users.slice(0, 5).map(user => (
                              <tr key={user.id} className="text-slate-300">
                                <td className="px-4 py-2">{user.name}</td>
                                <td className="px-4 py-2 text-slate-400">{user.email}</td>
                                <td className="px-4 py-2">
                                  <Badge variant="outline" className="text-xs">
                                    {user.role}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Orders API */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <ShoppingCart className="h-5 w-5 text-purple-400" />
                      Orders API
                    </CardTitle>
                    <CardDescription>
                      Complex traces with database + external payment service
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <Button
                        onClick={fetchOrders}
                        disabled={isLoading !== null}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        GET /api/orders
                      </Button>
                      <Button
                        onClick={createOrder}
                        disabled={isLoading !== null}
                        variant="outline"
                        className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        POST /api/orders
                      </Button>
                    </div>

                    <Alert className="bg-amber-500/10 border-amber-500/30">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <AlertDescription className="text-amber-200">
                        <strong>Try this:</strong> Create an order multiple times. About 10% will fail with a &quot;Payment declined&quot; error - check how errors appear in traces!
                      </AlertDescription>
                    </Alert>

                    {orders.length > 0 && (
                      <div className="rounded-lg border border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-slate-400">Order ID</th>
                              <th className="px-4 py-2 text-left text-slate-400">Total</th>
                              <th className="px-4 py-2 text-left text-slate-400">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {orders.slice(0, 5).map(order => (
                              <tr key={order.id} className="text-slate-300">
                                <td className="px-4 py-2 font-mono text-xs">{order.id}</td>
                                <td className="px-4 py-2">${order.total.toFixed(2)}</td>
                                <td className="px-4 py-2">
                                  <Badge
                                    variant="outline"
                                    className={order.status === 'completed'
                                      ? 'border-emerald-500/50 text-emerald-400'
                                      : 'border-amber-500/50 text-amber-400'
                                    }
                                  >
                                    {order.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* API Call History */}
              <div>
                <Card className="bg-slate-900/50 border-slate-800 sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Terminal className="h-5 w-5 text-emerald-400" />
                      API Call History
                    </CardTitle>
                    <CardDescription>
                      Recent API calls and their traces
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {apiCalls.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">
                        Make an API call to see traces here
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {apiCalls.map(call => (
                          <div
                            key={call.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                          >
                            <div className="flex items-center gap-3">
                              {call.status === 'pending' ? (
                                <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                              ) : call.status === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {call.method}
                                  </Badge>
                                  <span className="text-sm text-slate-300 font-mono">
                                    {call.endpoint}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {call.duration && `${call.duration.toFixed(0)}ms`}
                                  {call.statusCode && ` • ${call.statusCode}`}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Concepts Tab */}
          <TabsContent value="concepts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Traces */}
              <Card className="bg-linear-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-400">
                    <GitBranch className="h-5 w-5" />
                    Traces
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Traces follow a request through your entire system, showing the journey from start to finish.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Span:</strong> A single unit of work (HTTP request, DB query)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Trace:</strong> Collection of spans with same trace ID</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Context:</strong> Propagated across services</span>
                    </div>
                  </div>
                  <Separator className="bg-blue-500/30" />
                  <div className="text-xs text-slate-500">
                    🔍 Use traces to find bottlenecks and debug distributed systems
                  </div>
                </CardContent>
              </Card>

              {/* Metrics */}
              <Card className="bg-linear-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-emerald-400">
                    <BarChart3 className="h-5 w-5" />
                    Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Metrics are numerical measurements collected over time. Great for dashboards and alerting.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Counter:</strong> Always increases (requests, errors)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Gauge:</strong> Can go up/down (active users)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-emerald-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Histogram:</strong> Distribution (latency p50/p99)</span>
                    </div>
                  </div>
                  <Separator className="bg-emerald-500/30" />
                  <div className="text-xs text-slate-500">
                    📊 Use metrics for real-time dashboards and alerting
                  </div>
                </CardContent>
              </Card>

              {/* Logs */}
              <Card className="bg-linear-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-400">
                    <FileText className="h-5 w-5" />
                    Logs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Logs are timestamped text records of events. When correlated with traces, they become powerful.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Structured:</strong> JSON format for searchability</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Correlated:</strong> Include trace_id in every log</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-4 w-4 text-purple-400 mt-0.5" />
                      <span className="text-slate-400"><strong className="text-slate-200">Levels:</strong> DEBUG, INFO, WARN, ERROR, FATAL</span>
                    </div>
                  </div>
                  <Separator className="bg-purple-500/30" />
                  <div className="text-xs text-slate-500">
                    📝 Use logs for debugging specific issues
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Best Practices */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-amber-400" />
                  Production Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-emerald-400">✅ Do</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        Use semantic conventions for attribute names
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        Sample traces in production (don&apos;t record 100%)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        Include trace_id in all logs for correlation
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        Use batch processors for efficiency
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        Track business metrics (orders, revenue)
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-red-400">❌ Don&apos;t</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        Log sensitive data (passwords, tokens, PII)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        Use high-cardinality labels (user IDs as metric labels)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        Forget to end spans (causes memory leaks!)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        Trace health check endpoints (just noise)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">•</span>
                        Make telemetry synchronous (use batching)
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Architecture Tab */}
          <TabsContent value="architecture" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Layers className="h-5 w-5 text-cyan-400" />
                  OpenTelemetry Architecture in This Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Architecture Diagram */}
                <div className="bg-slate-950 rounded-lg p-6 font-mono text-sm overflow-x-auto">
                  <pre className="text-slate-400">
                    {`
┌─────────────────────────────────────────────────────────────────────────┐
│                           Your Next.js App                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Application Layer                              │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│  │   │  API Routes │  │   Server    │  │  Client Components      │   │  │
│  │   │  /api/*     │  │  Components │  │  useTrackEvent()        │   │  │
│  │   └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘   │  │
│  │          │                │                      │                 │  │
│  │          └────────────────┼──────────────────────┘                 │  │
│  │                           │                                        │  │
│  └───────────────────────────┼────────────────────────────────────────┘  │
│                              │                                           │
│  ┌───────────────────────────┼────────────────────────────────────────┐  │
│  │             Telemetry Layer (src/lib/telemetry/)                   │  │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────────┐    │  │
│  │   │ tracer  │  │ metrics │  │ logger  │  │    middleware     │    │  │
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └─────────┬─────────┘    │  │
│  │        └────────────┼───────────┼──────────────────┘              │  │
│  │                     │           │                                  │  │
│  └─────────────────────┼───────────┼──────────────────────────────────┘  │
│                        │           │                                     │
│  ┌─────────────────────┼───────────┼──────────────────────────────────┐  │
│  │         OpenTelemetry SDK (instrumentation.ts)                     │  │
│  │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │  │
│  │   │ TracerProvider  │ │ MeterProvider   │ │   LoggerProvider    │ │  │
│  │   │ (spans/traces)  │ │ (metrics)       │ │   (logs)            │ │  │
│  │   └────────┬────────┘ └────────┬────────┘ └──────────┬──────────┘ │  │
│  │            └───────────────────┼─────────────────────┘            │  │
│  └────────────────────────────────┼──────────────────────────────────┘  │
│                                   │                                     │
│  ┌────────────────────────────────┼──────────────────────────────────┐  │
│  │                         Exporters                                  │  │
│  │   ┌─────────────────────────┐  ┌────────────────────────────────┐ │  │
│  │   │   OTLP HTTP Exporter    │  │    Console Exporter (dev)      │ │  │
│  │   │   (Jaeger, Grafana)     │  │    (terminal output)           │ │  │
│  │   └────────────┬────────────┘  └────────────────────────────────┘ │  │
│  │                │                                                   │  │
│  └────────────────┼───────────────────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    Observability Backend (Local)                          │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│   │     Jaeger      │  │   Prometheus    │  │      Loki/Grafana       │  │
│   │  (traces UI)    │  │   (metrics)     │  │      (logs)             │  │
│   │  :16686         │  │   :9090         │  │      :3100              │  │
│   └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
`}
                  </pre>
                </div>

                {/* File Structure */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-white mb-4">📁 Project Structure</h3>
                    <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm">
                      <pre className="text-slate-400">
                        {`src/
├── instrumentation.ts    # SDK init (Next.js entry)
├── lib/telemetry/
│   ├── config.ts         # Configuration
│   ├── tracer.ts         # Tracing utilities
│   ├── metrics.ts        # Metrics utilities
│   ├── logger.ts         # Logging utilities
│   ├── middleware.ts     # API middleware
│   ├── hooks.ts          # React hooks
│   └── index.ts          # Public API
└── app/
    └── api/
        ├── users/route.ts    # Demo: Users API
        ├── orders/route.ts   # Demo: Orders API
        └── telemetry/route.ts # Client events`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white mb-4">🔧 Key Files Explained</h3>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <strong className="text-cyan-400">instrumentation.ts</strong>
                        <p className="text-slate-400 mt-1">
                          Next.js calls this on server start. We initialize OpenTelemetry here so it can patch modules before they&apos;re imported.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <strong className="text-emerald-400">middleware.ts</strong>
                        <p className="text-slate-400 mt-1">
                          Wraps API routes with automatic tracing, metrics, and logging. DRY pattern for observability.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                        <strong className="text-purple-400">hooks.ts</strong>
                        <p className="text-slate-400 mt-1">
                          Client-side React hooks for tracking user interactions, page views, and Web Vitals.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <p>OpenTelemetry Learning Lab • Built with Next.js + shadcn/ui</p>
            <div className="flex items-center gap-4">
              <a
                href="https://opentelemetry.io/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition-colors"
              >
                OpenTelemetry Docs
              </a>
              <a
                href="https://www.jaegertracing.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition-colors"
              >
                Jaeger
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
