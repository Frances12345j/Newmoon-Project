<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    private function paymongoHeaders(): array
    {
        $secret = config('services.paymongo.secret_key', env('PAYMONGO_SECRET_KEY'));
        return [
            'Authorization' => 'Basic ' . base64_encode($secret . ':'),
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }

    private function paymongoBaseUrl(): string
    {
        $key = config('services.paymongo.secret_key', env('PAYMONGO_SECRET_KEY'));
        return str_starts_with($key, 'sk_live')
            ? 'https://api.paymongo.com/v1'
            : 'https://api.paymongo.com/v1';
    }

    /**
     * Create a GCash source for an order and return the checkout URL.
     */
    public function createGcashSource(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
        ]);

        $order = Order::findOrFail($validated['order_id']);

        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($order->payment_method !== 'gcash') {
            return response()->json(['message' => 'Order is not set for GCash payment'], 400);
        }

        if ($order->payment_status === 'paid') {
            return response()->json(['message' => 'Order is already paid'], 400);
        }

        $amountInCents = (int) round($order->total * 100);

        $response = Http::withHeaders($this->paymongoHeaders())
            ->post($this->paymongoBaseUrl() . '/sources', [
                'data' => [
                    'attributes' => [
                        'amount' => $amountInCents,
                        'currency' => 'PHP',
                        'type' => 'gcash',
                        'redirect' => [
                            'success' => env('APP_URL', 'http://localhost') . '/api/payment/gcash/success?order_id=' . $order->id,
                            'failed' => env('APP_URL', 'http://localhost') . '/api/payment/gcash/failed?order_id=' . $order->id,
                        ],
                    ],
                ],
            ]);

        if (!$response->successful()) {
            Log::error('[PAYMONGO] Create source failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return response()->json(['message' => 'Failed to create GCash payment. Please try again.'], 500);
        }

        $source = $response->json('data');

        $order->update([
            'gcash_reference' => $source['id'],
            'payment_status' => 'pending',
        ]);

        $checkoutUrl = $source['attributes']['redirect']['checkout_url'] ?? null;

        return response()->json([
            'checkout_url' => $checkoutUrl,
            'source_id' => $source['id'],
        ]);
    }

    /**
     * Check the status of a GCash source.
     * Mobile app polls this after opening the checkout URL.
     */
    public function checkSourceStatus(Request $request)
    {
        $validated = $request->validate([
            'source_id' => 'required|string',
        ]);

        $response = Http::withHeaders($this->paymongoHeaders())
            ->get($this->paymongoBaseUrl() . '/sources/' . $validated['source_id']);

        if (!$response->successful()) {
            return response()->json(['status' => 'unknown'], 200);
        }

        $source = $response->json('data');
        $sourceStatus = $source['attributes']['status'] ?? 'unknown';

        return response()->json(['status' => $sourceStatus]);
    }

    /**
     * Handle successful GCash redirect (browser redirect from PayMongo).
     */
    public function gcashSuccess(Request $request)
    {
        $orderId = $request->query('order_id');
        $sourceId = $request->query('source_id');

        if ($orderId) {
            $order = Order::find($orderId);
            if ($order && $order->payment_method === 'gcash' && $order->payment_status !== 'paid') {
                $order->update(['payment_status' => 'paid']);
            }
        }

        return response()->json(['message' => 'Payment recorded']);
    }

    /**
     * Handle failed GCash redirect.
     */
    public function gcashFailed(Request $request)
    {
        $orderId = $request->query('order_id');

        if ($orderId) {
            $order = Order::find($orderId);
            if ($order) {
                $order->update(['payment_status' => 'failed']);
            }
        }

        return response()->json(['message' => 'Payment not completed']);
    }

    /**
     * PayMongo webhook handler.
     * PayMongo sends events when source status changes.
     */
    public function webhook(Request $request)
    {
        $payload = $request->all();
        $eventType = $payload['data']['attributes']['type'] ?? '';

        Log::info('[PAYMONGO WEBHOOK] Received', ['type' => $eventType]);

        if ($eventType === 'source.chargeable') {
            $sourceId = $payload['data']['id'] ?? null;

            if ($sourceId) {
                $order = Order::where('gcash_reference', $sourceId)->first();
                if ($order) {
                    $order->update(['payment_status' => 'paid']);
                    Log::info('[PAYMONGO WEBHOOK] Order marked as paid', ['order_id' => $order->id]);
                }
            }
        }

        if ($eventType === 'source.failed') {
            $sourceId = $payload['data']['id'] ?? null;

            if ($sourceId) {
                $order = Order::where('gcash_reference', $sourceId)->first();
                if ($order) {
                    $order->update(['payment_status' => 'failed']);
                    Log::info('[PAYMONGO WEBHOOK] Order marked as failed', ['order_id' => $order->id]);
                }
            }
        }

        return response()->json(['received' => true]);
    }
}
