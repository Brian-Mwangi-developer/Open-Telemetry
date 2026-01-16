/**
 * ============================================================================
 * DEMO API: USERS ENDPOINT
 * ============================================================================
 * 
 * This is a demo API endpoint that showcases OpenTelemetry in action.
 * It simulates real-world operations like database queries and external
 * API calls, all wrapped with proper telemetry.
 * 
 * 🎓 LEARNING POINTS DEMONSTRATED:
 * 1. Using the withTelemetry middleware
 * 2. Creating custom spans for business logic
 * 3. Adding meaningful attributes and events
 * 4. Recording business metrics
 * 5. Proper error handling with trace correlation
 */

import {
    addSpanAttributes,
    addSpanEvent,
    createCounter,
    logBusinessEvent,
    logger,
    otelLog,
    recordException,
    startTimer,
    traceAsync,
    withTelemetry,
} from '@/lib/telemetry';
import { NextRequest, NextResponse } from 'next/server';

// 🎓 Create a custom metric for user API calls
const userApiCalls = createCounter('api.users.calls', 'Number of calls to the users API');

/**
 * Simulated database of users
 * 
 * 🎓 In a real app, this would be a database query.
 * The tracing would show the actual database latency.
 */
const MOCK_USERS = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'user', createdAt: '2024-02-20' },
    { id: '3', name: 'Carol Williams', email: 'carol@example.com', role: 'user', createdAt: '2024-03-10' },
    { id: '4', name: 'David Brown', email: 'david@example.com', role: 'moderator', createdAt: '2024-04-05' },
    { id: '5', name: 'Eve Davis', email: 'eve@example.com', role: 'user', createdAt: '2024-05-12' },
];

/**
 * Simulate a database query with artificial latency
 * 
 * 🎓 LEARNING POINT:
 * We wrap this in traceAsync to create a child span. In your trace viewer,
 * you'll see:
 * 
 * GET /api/users (parent span)
 *   └── db.users.findAll (child span)
 *       └── (any nested operations)
 */
async function fetchUsersFromDatabase(filters?: { role?: string }): Promise<typeof MOCK_USERS> {
    return traceAsync('db.users.findAll', async () => {
        // 🎓 Add attributes about this database operation
        addSpanAttributes({
            'db.system': 'postgresql',
            'db.operation': 'SELECT',
            'db.sql.table': 'users',
            // Add filter info (but never log sensitive data!)
            ...(filters?.role && { 'db.filter.role': filters.role }),
        });

        // 🎓 Simulate database latency (50-150ms)
        const latency = 50 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, latency));

        // 🎓 Add an event when the query completes
        addSpanEvent('query_completed', {
            'db.rows_returned': MOCK_USERS.length,
            'db.latency_ms': latency,
        });

        // Apply filters
        let users = MOCK_USERS;
        if (filters?.role) {
            users = users.filter(u => u.role === filters.role);
        }

        return users;
    }, {
        attributes: {
            'operation.type': 'database',
        },
    });
}

/**
 * GET /api/users - Fetch all users
 * 
 * 🎓 The withTelemetry wrapper automatically:
 * - Creates a span for the entire request
 * - Records HTTP metrics (count, duration, status)
 * - Logs request/response
 * - Handles errors and sets appropriate span status
 */
async function handleGetUsers(request: NextRequest): Promise<NextResponse> {
    // 🎓 Increment our custom metric
    userApiCalls.add(1, { method: 'GET', endpoint: '/api/users' });

    const url = new URL(request.url);
    const role = url.searchParams.get('role') || undefined;

    // 🎓 Add business context to the current span
    addSpanAttributes({
        'api.version': 'v1',
        'request.has_filters': !!role,
    });

    // 🎓 Log the business event
    logBusinessEvent({
        name: 'users_list_requested',
        properties: {
            filters: { role },
        },
    });

    try {
        const timer = startTimer();
        const users = await fetchUsersFromDatabase({ role });
        const duration = timer.end();

        // 🎓 Add result info to span
        addSpanEvent('users_fetched', {
            'users.count': users.length,
            'query.duration_ms': duration,
        });

        logger.info({
            usersCount: users.length,
            queryDuration: duration,
        }, 'Successfully fetched users');

        // 🎓 Send log to Loki via OpenTelemetry
        otelLog.info('Successfully fetched users', {
            usersCount: users.length,
            queryDuration: duration,
        });

        return NextResponse.json({
            success: true,
            data: users,
            meta: {
                count: users.length,
                filters: { role },
            },
        });

    } catch (error) {
        // 🎓 Record the exception on the span
        recordException(error as Error, 'Failed to fetch users');

        logger.error({
            error: (error as Error).message,
        }, 'Failed to fetch users from database');

        // 🎓 Send error log to Loki via OpenTelemetry
        otelLog.error('Failed to fetch users from database', {
            error: (error as Error).message,
        });

        return NextResponse.json(
            { success: false, error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/users - Create a new user
 * 
 * 🎓 LEARNING POINT:
 * This demonstrates how to trace write operations and record
 * business metrics like user signups.
 */
async function handleCreateUser(request: NextRequest): Promise<NextResponse> {
    userApiCalls.add(1, { method: 'POST', endpoint: '/api/users' });

    try {
        const body = await request.json();

        // 🎓 Validate input (would be more thorough in real app)
        if (!body.name || !body.email) {
            addSpanEvent('validation_failed', {
                'validation.missing_fields': ['name', 'email'].filter(f => !body[f]).join(','),
            });

            return NextResponse.json(
                { success: false, error: 'Name and email are required' },
                { status: 400 }
            );
        }

        // 🎓 Simulate user creation
        const newUser = await traceAsync('db.users.insert', async () => {
            addSpanAttributes({
                'db.system': 'postgresql',
                'db.operation': 'INSERT',
                'db.sql.table': 'users',
            });

            // Simulate DB write latency
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));

            return {
                id: String(MOCK_USERS.length + 1),
                name: body.name,
                email: body.email,
                role: 'user',
                createdAt: new Date().toISOString(),
            };
        });

        // 🎓 Log the business event for analytics
        logBusinessEvent({
            name: 'user_created',
            properties: {
                userId: newUser.id,
                role: newUser.role,
            },
        });

        addSpanEvent('user_created', {
            'user.id': newUser.id,
            'user.role': newUser.role,
        });

        return NextResponse.json({
            success: true,
            data: newUser,
        }, { status: 201 });

    } catch (error) {
        recordException(error as Error, 'Failed to create user');

        logger.error({
            error: (error as Error).message,
        }, 'Failed to create user');

        // 🎓 Send error log to Loki via OpenTelemetry
        otelLog.error('Failed to create user', {
            error: (error as Error).message,
        });

        return NextResponse.json(
            { success: false, error: 'Failed to create user' },
            { status: 500 }
        );
    }
}

// 🎓 Export wrapped handlers with telemetry
export const GET = withTelemetry(handleGetUsers, {
    name: 'GET /api/users',
    customAttributes: {
        'api.category': 'users',
    },
});

export const POST = withTelemetry(handleCreateUser, {
    name: 'POST /api/users',
    customAttributes: {
        'api.category': 'users',
    },
});
