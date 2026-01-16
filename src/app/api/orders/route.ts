/**
 * ============================================================================
 * DEMO API: ORDERS ENDPOINT
 * ============================================================================
 * 
 * This API demonstrates more complex telemetry scenarios including:
 * - Multiple child spans (database + external API)
 * - Business metrics (orders, revenue)
 * - Error scenarios with different status codes
 * - Trace context propagation to external services
 * 
 * 🎓 REAL-WORLD PATTERNS DEMONSTRATED:
 * 1. Calling external payment service (traced as CLIENT span)
 * 2. Database transactions (multiple operations)
 * 3. Revenue and order metrics
 * 4. Proper error categorization
 */

import {
    addSpanAttributes,
    addSpanEvent,
    createHistogram,
    logBusinessEvent,
    logger,
    otelLog,
    recordException,
    recordOrder,
    recordRevenue,
    traceAsync,
    traceHttpCall,
    withTelemetry,
} from '@/lib/telemetry';
import { SpanKind } from '@opentelemetry/api';
import { NextRequest, NextResponse } from 'next/server';

// 🎓 Custom histogram for order values
const orderValueHistogram = createHistogram(
    'business.order.value',
    'Distribution of order values',
    'USD'
);

/**
 * Mock order database
 */
const MOCK_ORDERS = [
    { id: 'ORD-001', userId: '1', total: 99.99, status: 'completed', items: 3, createdAt: '2024-01-20' },
    { id: 'ORD-002', userId: '2', total: 249.50, status: 'completed', items: 5, createdAt: '2024-01-21' },
    { id: 'ORD-003', userId: '1', total: 49.99, status: 'pending', items: 1, createdAt: '2024-01-22' },
    { id: 'ORD-004', userId: '3', total: 599.00, status: 'completed', items: 2, createdAt: '2024-01-23' },
];

/**
 * Simulate fetching orders from database
 */
async function fetchOrders(userId?: string) {
    return traceAsync('db.orders.findMany', async () => {
        addSpanAttributes({
            'db.system': 'postgresql',
            'db.operation': 'SELECT',
            'db.sql.table': 'orders',
            ...(userId && { 'db.filter.user_id': userId }),
        });

        // Simulate query latency
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 40));

        let orders = MOCK_ORDERS;
        if (userId) {
            orders = orders.filter(o => o.userId === userId);
        }

        addSpanEvent('query_completed', {
            'db.rows_returned': orders.length,
        });

        return orders;
    });
}

/**
 * Simulate payment processing with external service
 * 
 * 🎓 LEARNING POINT:
 * When calling external services, use SpanKind.CLIENT to indicate
 * this is an outgoing request. The span will show up as a client
 * call in your trace, making it clear that latency is from an
 * external dependency.
 */
async function processPayment(orderId: string, amount: number) {
    return traceHttpCall({
        method: 'POST',
        url: 'https://api.stripe.com/v1/charges',
        fn: async () => {
            // 🎓 In a real app, this would be an actual API call
            addSpanAttributes({
                'payment.provider': 'stripe',
                'payment.order_id': orderId,
                // Never log full amounts in production if sensitive
                'payment.amount_range': amount > 100 ? 'high' : 'standard',
            });

            // Simulate external API latency (150-350ms - external APIs are slow!)
            await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));

            // Simulate occasional failures (10% chance)
            if (Math.random() < 0.1) {
                const error = new Error('Payment declined: Insufficient funds');
                (error as NodeJS.ErrnoException).code = 'PAYMENT_DECLINED';
                throw error;
            }

            addSpanEvent('payment_authorized', {
                'payment.transaction_id': `txn_${Date.now()}`,
            });

            return {
                success: true,
                transactionId: `txn_${Date.now()}`,
                chargeId: `ch_${Math.random().toString(36).substr(2, 9)}`,
            };
        },
    });
}

/**
 * Simulate inventory check
 */
async function checkInventory(items: string[]) {
    return traceAsync('service.inventory.check', async () => {
        addSpanAttributes({
            'inventory.items_count': items.length,
        });

        // Simulate service call
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));

        return { available: true, reservationId: `res_${Date.now()}` };
    }, { kind: SpanKind.CLIENT });
}

/**
 * GET /api/orders - Fetch orders
 */
async function handleGetOrders(request: NextRequest) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || undefined;

    addSpanAttributes({
        'query.user_filter': !!userId,
    });

    const orders = await fetchOrders(userId);

    // 🎓 Calculate and record aggregate metrics
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    addSpanEvent('orders_aggregated', {
        'orders.count': orders.length,
        'orders.total_revenue': totalRevenue,
    });

    return NextResponse.json({
        success: true,
        data: orders,
        meta: {
            count: orders.length,
            totalRevenue,
        },
    });
}

/**
 * POST /api/orders - Create a new order
 * 
 * 🎓 This demonstrates a complex multi-step operation:
 * 1. Validate input
 * 2. Check inventory
 * 3. Process payment
 * 4. Save to database
 * 5. Record metrics
 */
async function handleCreateOrder(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate
        if (!body.userId || !body.items || !body.total) {
            return NextResponse.json(
                { success: false, error: 'userId, items, and total are required' },
                { status: 400 }
            );
        }

        addSpanAttributes({
            'order.items_count': body.items.length,
            'order.user_id': body.userId,
        });

        // Step 1: Check inventory
        addSpanEvent('step_started', { step: 'inventory_check' });
        const inventory = await checkInventory(body.items);
        addSpanEvent('step_completed', { step: 'inventory_check', success: inventory.available });

        if (!inventory.available) {
            return NextResponse.json(
                { success: false, error: 'Items not available in inventory' },
                { status: 409 }
            );
        }

        // Step 2: Process payment
        addSpanEvent('step_started', { step: 'payment' });
        let payment;
        try {
            payment = await processPayment(`ORD-${Date.now()}`, body.total);
            addSpanEvent('step_completed', { step: 'payment', success: true });
        } catch (paymentError) {
            addSpanEvent('step_completed', { step: 'payment', success: false });

            // 🎓 Log payment failures with appropriate level
            logger.warn({
                userId: body.userId,
                amount: body.total,
                error: (paymentError as Error).message,
            }, 'Payment processing failed');

            // 🎓 Send warning log to Loki via OpenTelemetry
            otelLog.warn('Payment processing failed', {
                userId: body.userId,
                amount: body.total,
                error: (paymentError as Error).message,
            });

            return NextResponse.json(
                { success: false, error: 'Payment failed', reason: (paymentError as Error).message },
                { status: 402 }
            );
        }

        // Step 3: Save order
        addSpanEvent('step_started', { step: 'save_order' });
        const newOrder = await traceAsync('db.orders.insert', async () => {
            addSpanAttributes({
                'db.system': 'postgresql',
                'db.operation': 'INSERT',
                'db.sql.table': 'orders',
            });

            await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 30));

            return {
                id: `ORD-${Date.now()}`,
                userId: body.userId,
                total: body.total,
                items: body.items.length,
                status: 'completed',
                paymentId: payment.transactionId,
                createdAt: new Date().toISOString(),
            };
        });
        addSpanEvent('step_completed', { step: 'save_order', success: true });

        // 🎓 Record business metrics
        recordOrder({
            'order.payment_method': 'card',
            'order.items_count': String(body.items.length),
        });

        recordRevenue(body.total, {
            'order.id': newOrder.id,
            'order.payment_method': 'card',
        });

        orderValueHistogram.record(body.total, {
            'order.items_count': String(body.items.length),
        });

        // Log the business event
        logBusinessEvent({
            name: 'order_completed',
            userId: body.userId,
            properties: {
                orderId: newOrder.id,
                total: body.total,
                itemCount: body.items.length,
            },
        });

        // 🎓 Send business log to Loki via OpenTelemetry
        otelLog.info('Order completed successfully', {
            orderId: newOrder.id,
            userId: body.userId,
            total: body.total,
            itemCount: body.items.length,
        });

        addSpanAttributes({
            'order.id': newOrder.id,
            'order.success': true,
        });

        return NextResponse.json({
            success: true,
            data: newOrder,
        }, { status: 201 });

    } catch (error) {
        recordException(error as Error, 'Order creation failed');

        logger.error({
            error: (error as Error).message,
            stack: (error as Error).stack,
        }, 'Failed to create order');

        // 🎓 Send error log to Loki via OpenTelemetry
        otelLog.error('Failed to create order', {
            error: (error as Error).message,
        });

        return NextResponse.json(
            { success: false, error: 'Failed to create order' },
            { status: 500 }
        );
    }
}

export const GET = withTelemetry(handleGetOrders, {
    name: 'GET /api/orders',
    customAttributes: {
        'api.category': 'orders',
    },
});

export const POST = withTelemetry(handleCreateOrder, {
    name: 'POST /api/orders',
    customAttributes: {
        'api.category': 'orders',
    },
});
