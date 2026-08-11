<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\ProductStockDelivery;
use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with(['stocks.branch', 'deliveries.branch']);
        $includeInactive = $request->boolean('include_inactive', false);
        if (!$includeInactive) {
            $query->where('is_active', true);
        }
        $perPage = min((int) $request->get('per_page', 100), 200);
        $products = $query->paginate($perPage);

        // Frontend/mobile expect `product_stocks`
        $products->getCollection()->transform(function ($p) {
            $p->product_stocks = $p->stocks;
            // New: pending/received delivery rows for "ongoing stocks"
            $p->ongoing_stocks = $p->deliveries;
            return $p;
        });

        return response()->json($products);
    }

    public function show($id)
    {
        $product = Product::with(['stocks.branch', 'deliveries.branch'])->findOrFail($id);
        $product->product_stocks = $product->stocks;
        $product->ongoing_stocks = $product->deliveries;
        return response()->json($product);
    }

    public function store(Request $request)
    {
        \Log::info('[ProductController.store] Request all:', $request->all());
        \Log::info('[ProductController.store] hasFile image:', [$request->hasFile('image')]);
        \Log::info('[ProductController.store] Content-Type:', [$request->header('Content-Type')]);

        $validated = $request->validate([
            'name' => 'required|string',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'image' => 'nullable|file|mimes:jpeg,png,jpg,webp|max:2048',
            'sku' => 'nullable|string|unique:products,sku',
            'category' => 'nullable|string',
            'branches' => 'sometimes|array',
            'branches.*' => 'exists:branches,id',
        ]);

        DB::beginTransaction();
        try {
            // `products.sku` is non-nullable in the DB schema, so ensure a value.
            $sku = $validated['sku'] ?? null;
            if (!$sku) {
                $base = Str::upper(Str::slug($validated['name'], '-'));
                $base = $base !== '' ? $base : 'PRODUCT';

                // Keep SKU reasonably short and unique-ish.
                $base = Str::limit($base, 24, '');
                $candidate = $base;
                $i = 1;
                while (Product::where('sku', $candidate)->exists()) {
                    $suffix = '-' . $i;
                    $candidate = Str::limit($base, 24 - strlen($suffix), '') . $suffix;
                    $i++;
                }
                $sku = $candidate;
            }

            $imagePath = null;
            if ($request->hasFile('image')) {
                $imagePath = $request->file('image')->store('products', 'public');
            }

            $product = Product::create([
                'name' => $validated['name'],
                'price' => $validated['price'],
                'description' => $validated['description'] ?? null,
                'image' => $imagePath,
                'sku' => $sku,
                'category' => $validated['category'] ?? null,
                'is_active' => true,
            ]);

            if (!empty($validated['branches'])) {
                foreach ($validated['branches'] as $branchId) {
                    ProductStock::create([
                        'product_id' => $product->id,
                        'branch_id' => $branchId,
                        'quantity' => 0,
                        'minimum_stock' => 0,
                    ]);
                }
            }

            DB::commit();

            $product->load(['stocks.branch', 'deliveries.branch']);
            $product->product_stocks = $product->stocks;
            $product->ongoing_stocks = $product->deliveries;
            return response()->json($product, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create product', 'error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);
        $validated = $request->validate([
            'name' => 'sometimes|string',
            'price' => 'sometimes|numeric|min:0',
            'description' => 'nullable|string',
            'image' => 'nullable|file|mimes:jpeg,png,jpg,webp|max:2048',
            'sku' => 'nullable|string|unique:products,sku,' . $product->id,
            'category' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($request->hasFile('image')) {
            // Delete old image if exists
            if ($product->image) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($product->image);
            }
            $validated['image'] = $request->file('image')->store('products', 'public');
        }

        $product->update($validated);
        $product->load(['stocks.branch', 'deliveries.branch']);
        $product->product_stocks = $product->stocks;
        $product->ongoing_stocks = $product->deliveries;
        return response()->json($product);
    }

    public function destroy($id)
    {
        $product = Product::findOrFail($id);
        try {
            $product->delete();
            return response()->json(['message' => 'Product deleted successfully']);
        } catch (QueryException $e) {
            if ((string) $e->getCode() === '23000') {
                return response()->json([
                    'message' => 'Cannot delete this product because it is used in sales records. Disable the product instead.',
                    'code' => 'PRODUCT_DELETE_CONSTRAINT',
                    'suggested_action' => 'disable',
                ], 409);
            }
            throw $e;
        }
    }

    public function restock(Request $request, $id)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'quantity' => 'required|integer|min:1',
        ]);

        // Restock represents "incoming stock" and must NOT immediately affect sellable inventory.
        // Insert a pending delivery row.
        $delivery = ProductStockDelivery::create([
            'product_id' => (int) $id,
            'branch_id' => $validated['branch_id'],
            'quantity' => $validated['quantity'],
            'restocked_at' => \Carbon\Carbon::now('Asia/Manila'),
            'received_at' => null,
            'received_by' => null,
        ]);

        return response()->json(['message' => 'Restocked successfully', 'delivery' => $delivery]);
    }

    public function pendingCount(Request $request)
    {
        $branchId = $request->query('branch_id');

        $query = ProductStockDelivery::whereNull('received_at');

        if ($branchId) {
            $query->where('branch_id', $branchId);
        }

        $count = $query->count();

        \Log::info('[PRODUCT] pendingCount', ['branch_id' => $branchId, 'count' => $count]);

        return response()->json(['pending_count' => $count]);
    }

    public function getLowStock(Request $request)
    {
        $query = ProductStock::with(['product', 'branch']);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        $query->whereColumn('quantity', '<', 'minimum_stock')
              ->where('minimum_stock', '>', 0)
              ->orderByRaw('(quantity / minimum_stock) ASC');

        $rows = $request->has('per_page')
            ? $query->paginate($request->per_page)
            : $query->get();

        $stats = [
            'total_low_stock' => ProductStock::whereColumn('quantity', '<', 'minimum_stock')
                ->where('minimum_stock', '>', 0)
                ->count(),
            'total_out_of_stock' => ProductStock::where('quantity', '<=', 0)->count(),
            'total_products' => ProductStock::where('quantity', '>', 0)->count(),
        ];

        return response()->json([
            'data' => $rows,
            'stats' => $stats,
        ]);
    }

    public function toggleReceived(Request $request, $id)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
        ]);

        // Receive ALL pending deliveries for this product+branch.
        $pending = ProductStockDelivery::where('product_id', (int) $id)
            ->where('branch_id', $validated['branch_id'])
            ->whereNull('received_at')
            ->get();

        if ($pending->isEmpty()) {
            return response()->json(['message' => 'No pending stock to receive'], 200);
        }

        $now = \Carbon\Carbon::now('Asia/Manila');
        $receiverId = $request->user()?->id;
        $totalQty = (int) $pending->sum('quantity');

        DB::beginTransaction();
        try {
            // Ensure current stock row exists, then add received quantity.
            $stock = ProductStock::firstOrCreate(
                ['product_id' => (int) $id, 'branch_id' => $validated['branch_id']],
                ['quantity' => 0, 'minimum_stock' => 0]
            );

            $stock->increment('quantity', $totalQty);
            $stock->restocked_at = $now;
            $stock->save();

            // Create a StockBatch per delivery (FIFO)
            $deliveries = ProductStockDelivery::where('product_id', (int) $id)
                ->where('branch_id', $validated['branch_id'])
                ->whereNull('received_at')
                ->get();

            foreach ($deliveries as $delivery) {
                StockBatch::create([
                    'product_id'  => (int) $id,
                    'branch_id'   => $validated['branch_id'],
                    'quantity'    => $delivery->quantity,
                    'remaining'   => $delivery->quantity,
                    'received_at' => $now,
                    'source_type' => 'delivery',
                    'source_id'   => $delivery->id,
                ]);
            }

            ProductStockDelivery::where('product_id', (int) $id)
                ->where('branch_id', $validated['branch_id'])
                ->whereNull('received_at')
                ->update([
                    'received_at' => $now,
                    'received_by' => $receiverId,
                    'marked_as_not_received' => false,
                    'not_received_at' => null,
                ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to receive stock', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Stock marked as received',
            'received_count' => $pending->count(),
            'received_quantity' => $totalQty,
        ]);
    }

    public function markNotReceived(Request $request, $id)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
        ]);

        $pending = ProductStockDelivery::where('product_id', (int) $id)
            ->where('branch_id', $validated['branch_id'])
            ->whereNull('received_at')
            ->where('marked_as_not_received', false)
            ->get();

        if ($pending->isEmpty()) {
            return response()->json(['message' => 'No pending stock to mark as not received'], 200);
        }

        $now = \Carbon\Carbon::now('Asia/Manila');

        DB::beginTransaction();
        try {
            ProductStockDelivery::where('product_id', (int) $id)
                ->where('branch_id', $validated['branch_id'])
                ->whereNull('received_at')
                ->where('marked_as_not_received', false)
                ->update([
                    'marked_as_not_received' => true,
                    'not_received_at' => $now,
                ]);

            $product = Product::find((int) $id);
            $productName = $product?->name ?? "Product #{$id}";

            Notification::create([
                'type' => 'stock_not_received',
                'message' => "{$productName} was marked as not received by staff",
                'data' => [
                    'product_id' => (int) $id,
                    'branch_id' => $validated['branch_id'],
                    'quantity' => $pending->sum('quantity'),
                ],
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to mark stock as not received', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Stock marked as not received. Admin has been notified.',
            'not_received_count' => $pending->count(),
            'not_received_quantity' => (int) $pending->sum('quantity'),
        ]);
    }

    public function stockBatches(Request $request)
    {
        $query = StockBatch::with(['product', 'branch'])
            ->orderBy('received_at')
            ->orderBy('id');

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }
        if ($request->filled('branch_id') && $request->branch_id !== 'all') {
            $query->where('branch_id', $request->branch_id);
        }

        $batches = $query->paginate($request->get('per_page', 50));

        return response()->json($batches);
    }
}

