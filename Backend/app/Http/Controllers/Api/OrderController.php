<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderDetails;
use App\Models\ProductStock;
use App\Models\StockBatch;
use App\Models\StaffAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = Order::with(['items.product', 'branch', 'rider'])
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($orders);
    }

    public function show(Request $request, $id)
    {
        $order = Order::with(['items.product', 'branch', 'rider'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json($order);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
            'items.*.price' => 'required|numeric|min:0',
            'delivery_address' => 'required|string|max:500',
            'delivery_latitude' => 'nullable|numeric|between:-90,90',
            'delivery_longitude' => 'nullable|numeric|between:-180,180',
            'payment_method' => 'required|in:cod,gcash',
            'notes' => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($validated, $user) {
            $subtotal = 0;
            $items = [];

            foreach ($validated['items'] as $item) {
                $total = $item['price'] * $item['quantity'];
                $subtotal += $total;
                $items[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'total' => $total,
                ];
            }

            $deliveryFee = 50;
            $total = $subtotal + $deliveryFee;
            $orderNumber = 'ORD-' . now()->format('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

            $order = Order::create([
                'order_number' => $orderNumber,
                'user_id' => $user->id,
                'branch_id' => $validated['branch_id'],
                'status' => 'pending',
                'payment_method' => $validated['payment_method'],
                'payment_status' => $validated['payment_method'] === 'gcash' ? 'pending' : 'unpaid',
                'delivery_address' => $validated['delivery_address'],
                'delivery_latitude' => $validated['delivery_latitude'] ?? null,
                'delivery_longitude' => $validated['delivery_longitude'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total' => $total,
            ]);

            foreach ($items as $item) {
                $order->items()->create($item);
            }

            return response()->json(
                Order::with(['items.product', 'branch'])->find($order->id),
                201
            );
        });
    }

    public function cancel(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)->findOrFail($id);

        if (!in_array($order->status, ['pending', 'confirmed'])) {
            return response()->json(['message' => 'Order cannot be cancelled'], 400);
        }

        DB::transaction(function () use ($order) {
            if ($order->status === 'confirmed') {
                foreach ($order->items as $item) {
                    $stock = ProductStock::where('product_id', $item->product_id)
                        ->where('branch_id', $order->branch_id)
                        ->first();

                    if ($stock) {
                        $stock->increment('quantity', $item->quantity);
                    }
                }
            }

            $order->update(['status' => 'cancelled']);
        });

        return response()->json($order->fresh(['items.product', 'branch']));
    }

    public function statuses()
    {
        return response()->json([
            'pending' => 'Pending',
            'confirmed' => 'Confirmed',
            'preparing' => 'Preparing',
            'ready' => 'Ready for Pickup',
            'out_for_delivery' => 'Out for Delivery',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
        ]);
    }

    // ─── Staff Order Management ─────────────────────────────────

    public function staffIndex(Request $request)
    {
        $assignment = StaffAssignment::where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->first();

        if (!$assignment) {
            return response()->json(['message' => 'No active branch assignment'], 403);
        }

        $orders = Order::with(['user', 'items.product', 'branch'])
            ->where('branch_id', $assignment->branch_id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 50));

        $orders->getCollection()->transform(function ($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->user?->full_name ?? 'Customer',
                'customer_address' => $order->delivery_address,
                'customer_latitude' => $order->delivery_latitude ? (float) $order->delivery_latitude : null,
                'customer_longitude' => $order->delivery_longitude ? (float) $order->delivery_longitude : null,
                'items' => $order->items->map(fn($i) => [
                    'name' => $i->product?->name ?? 'Product',
                    'quantity' => (int) $i->quantity,
                    'price' => (float) $i->price,
                ]),
                'total' => (float) $order->total,
                'status' => $order->status,
                'branch_name' => $order->branch?->name,
                'created_at' => $order->created_at->toIso8601String(),
            ];
        });

        return response()->json($orders);
    }

    public function staffUpdateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:confirmed,preparing,ready',
        ]);

        $order = Order::findOrFail($id);

        $allowed = [
            'pending' => ['confirmed'],
            'confirmed' => ['preparing'],
            'preparing' => ['ready'],
        ];

        $next = $allowed[$order->status] ?? [];

        if (!in_array($validated['status'], $next)) {
            return response()->json([
                'message' => "Cannot transition from '{$order->status}' to '{$validated['status']}'",
            ], 400);
        }

        DB::transaction(function () use ($order, $validated) {
            $order->update(['status' => $validated['status']]);

            if ($validated['status'] === 'confirmed') {
                foreach ($order->items as $item) {
                    $stock = ProductStock::where('product_id', $item->product_id)
                        ->where('branch_id', $order->branch_id)
                        ->first();

                    if ($stock) {
                        $remainingQty = (float) $item->quantity;
                        $batches = StockBatch::where('product_id', $item->product_id)
                            ->where('branch_id', $order->branch_id)
                            ->where('remaining', '>', 0)
                            ->orderBy('received_at')
                            ->orderBy('id')
                            ->get();

                        foreach ($batches as $batch) {
                            if ($remainingQty <= 0) break;
                            $deduct = min($batch->remaining, $remainingQty);
                            $batch->decrement('remaining', $deduct);
                            $remainingQty -= $deduct;
                        }

                        $stock->decrement('quantity', $item->quantity);
                    }
                }
            }
        });

        return response()->json($order->fresh(['user', 'items.product', 'branch']));
    }

    // ─── Rider Order Management ─────────────────────────────────

    public function riderIndex(Request $request)
    {
        $user = $request->user();
        $branchId = $user->current_branch_id;

        $orders = Order::with(['user', 'items.product', 'branch'])
            ->where(function ($q) use ($user, $branchId) {
                $q->where('status', 'ready')
                  ->whereNull('rider_id')
                  ->when($branchId, fn($wq) => $wq->where('branch_id', $branchId));
                $q->orWhere('rider_id', $user->id);
            })
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 50));

        $orders->getCollection()->transform(function ($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->user?->full_name ?? 'Customer',
                'customer_address' => $order->delivery_address,
                'customer_latitude' => $order->delivery_latitude ? (float) $order->delivery_latitude : null,
                'customer_longitude' => $order->delivery_longitude ? (float) $order->delivery_longitude : null,
                'items' => $order->items->map(fn($i) => [
                    'name' => $i->product?->name ?? 'Product',
                    'quantity' => (int) $i->quantity,
                    'price' => (float) $i->price,
                ]),
                'total' => (float) $order->total,
                'status' => $order->status,
                'branch_name' => $order->branch?->name,
                'branch_address' => $order->branch?->address,
                'branch_latitude' => $order->branch?->latitude ? (float) $order->branch->latitude : null,
                'branch_longitude' => $order->branch?->longitude ? (float) $order->branch->longitude : null,
                'created_at' => $order->created_at->toIso8601String(),
            ];
        });

        return response()->json($orders);
    }

    public function riderUpdateStatus(Request $request, $id)
    {
        $order = Order::findOrFail($id);
        $user = $request->user();
        $newStatus = $request->input('status');

        $allowed = [
            'pending' => ['accepted'],
            'ready' => ['picked_up'],
            'accepted' => ['picked_up'],
            'picked_up' => ['out_for_delivery'],
            'out_for_delivery' => ['delivered'],
        ];

        $next = $allowed[$order->status] ?? [];

        if (!in_array($newStatus, $next)) {
            return response()->json([
                'message' => "Cannot transition from '{$order->status}' to '{$newStatus}'",
            ], 400);
        }

        $update = ['status' => $newStatus];

        if (in_array($newStatus, ['accepted', 'picked_up'])) {
            $update['rider_id'] = $user->id;
        }

        if ($newStatus === 'delivered') {
            $validated = $request->validate([
                'delivery_notes' => 'nullable|string|max:1000',
                'customer_confirmed' => 'required|string|max:255',
                'delivery_photo' => 'required|image|max:10240',
            ]);

            $photoPath = $request->file('delivery_photo')->store('delivery-proof', 'public');

            $update['delivery_notes'] = $validated['delivery_notes'] ?? null;
            $update['customer_confirmed'] = $validated['customer_confirmed'];
            $update['delivery_photo'] = $photoPath;
            $update['delivered_at'] = now();
        }

        $order->update($update);

        return response()->json($order->fresh(['user', 'items.product', 'branch']));
    }

    // ─── Rider Tracking ─────────────────────────────────────────

    public function updateLocation(Request $request, $id)
    {
        $validated = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $order = Order::where('rider_id', $request->user()->id)->findOrFail($id);

        $order->update([
            'rider_latitude' => $validated['latitude'],
            'rider_longitude' => $validated['longitude'],
            'rider_location_updated_at' => now(),
        ]);

        return response()->json(['message' => 'Location updated']);
    }

    public function trackRider(Request $request, $id)
    {
        $order = Order::with(['rider'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        if (!$order->rider_id) {
            return response()->json(['message' => 'No rider assigned yet'], 404);
        }

        return response()->json([
            'rider' => [
                'id' => $order->rider->id,
                'name' => $order->rider->full_name ?? $order->rider->firstname ?? 'Rider',
                'phone' => $order->rider->phone,
            ],
            'latitude' => $order->rider_latitude,
            'longitude' => $order->rider_longitude,
            'updated_at' => $order->rider_location_updated_at,
        ]);
    }

    public function assignRider(Request $request, $id)
    {
        $order = Order::findOrFail($id);

        $order->update([
            'rider_id' => $request->user()->id,
            'status' => 'out_for_delivery',
        ]);

        return response()->json($order->fresh(['items.product', 'branch', 'rider']));
    }
}
