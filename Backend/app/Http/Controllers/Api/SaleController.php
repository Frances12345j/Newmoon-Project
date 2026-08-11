<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductStock;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        $query = Sale::with(['user', 'branch', 'items.product']);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('date')) {
            $date = $request->date;
            // Backward compatibility for rows saved before PH business-date fix:
            // include rows whose created_at maps to this PH date.
            $query->where(function ($q) use ($date) {
                $q->whereDate('sale_date', $date)
                    ->orWhereRaw("DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?", [$date]);
            });
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('sale_date', [$request->start_date, $request->end_date]);
        }

        $sales = $query->orderBy('created_at', 'desc')->paginate(5);

        return response()->json($sales);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'user_id' => 'required|exists:users,id',
            'customer_name' => 'nullable|string|max:255',
            'senior_discount' => 'sometimes|boolean',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => [
                'required',
                'numeric',
                'min:0.5',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $q = round((float) $value, 2);
                    if (abs($q * 2 - round($q * 2)) > 0.001) {
                        $fail('Each quantity must be in halves (0.5, 1, 1.5, …).');
                    }
                },
            ],
            'cash_collected' => 'required|numeric|min:0',
            'payment_method' => 'sometimes|string',
        ]);

        DB::beginTransaction();

        try {
            $subtotal = 0;
            $items = [];

            foreach ($validated['items'] as $item) {
                $product = \App\Models\Product::find($item['product_id']);
                $qty = round((float) $item['quantity'], 2);
                $unitPrice = (float) $product->price;
                $total = round($unitPrice * $qty, 2);
                $subtotal += $total;

                \Log::info('[SALE STORE] Line item', [
                    'product_id' => $item['product_id'],
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'line_total' => $total,
                ]);

                // Check and update stock (FIFO)
                $stock = ProductStock::where('product_id', $item['product_id'])
                    ->where('branch_id', $validated['branch_id'])
                    ->first();

                $avail = round((float) ($stock->quantity ?? 0), 2);
                if (! $stock || $avail + 0.00001 < $qty) {
                    throw new \Exception("Insufficient stock for product: {$product->name}");
                }

                // Deduct from oldest batches first (FIFO)
                $remainingQty = $qty;
                $batches = StockBatch::where('product_id', $item['product_id'])
                    ->where('branch_id', $validated['branch_id'])
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

                $stock->decrement('quantity', $qty);

                $items[] = [
                    'product_id' => $item['product_id'],
                    'quantity' => $qty,
                    'price' => $product->price,
                    'total' => $total,
                ];
            }

            $tax = 0; // No VAT
            // Philippines Senior Citizen Discount: 20% (RA 9994)
            $isSenior = (bool) ($validated['senior_discount'] ?? false);
            $discountAmount = $isSenior ? round($subtotal * 0.20, 2) : 0;
            $total = max($subtotal - $discountAmount, 0);
            $change = $validated['cash_collected'] - $total;
            $invoiceNumber = 'INV-' . date('Ymd') . '-' . str_pad(Sale::count() + 1, 4, '0', STR_PAD_LEFT);

            // DATE column must follow business calendar (Philippines). App timezone is UTC, so `now()`
            // alone stores the UTC calendar day — POS/dashboard use local PH dates and miss sales (e.g. sale at 2am PH → UTC still "yesterday").
            $saleDatePh = now()->timezone('Asia/Manila')->toDateString();
            \Log::info('[SALE STORE] business date resolution', [
                'app_now' => now()->toDateTimeString(),
                'sale_date_ph' => $saleDatePh,
            ]);

            $sale = Sale::create([
                'invoice_number' => $invoiceNumber,
                'branch_id' => $validated['branch_id'],
                'user_id' => $validated['user_id'],
                'customer_name' => $validated['customer_name'] ?? null,
                'senior_discount' => $isSenior,
                'sale_date' => $saleDatePh,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'discount_amount' => $discountAmount,
                'total' => $total,
                'cash_collected' => $validated['cash_collected'],
                'change_given' => $change,
                'payment_method' => $validated['payment_method'] ?? 'cash',
            ]);

            foreach ($items as $item) {
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'price' => $item['price'],
                    'total' => $item['total'],
                ]);
            }

            DB::commit();

            return response()->json($sale->load('items.product'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Sale failed', 'error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        $sale = Sale::with(['user', 'branch', 'items.product'])->findOrFail($id);
        return response()->json($sale);
    }

    public function getProductIncentives(Request $request)
    {
        \Log::info('[BACKEND] getProductIncentives called', $request->all());

        $validated = $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
        ]);

        \Log::info('[BACKEND] Validated:', $validated);

        // Single query: sum sale_items.quantity grouped by sales.user_id
        // for the given month/year
        $productCounts = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereMonth('sales.sale_date', $validated['month'])
            ->whereYear('sales.sale_date', $validated['year'])
            ->select('sales.user_id', DB::raw('SUM(sale_items.quantity) as total_products_sold'))
            ->groupBy('sales.user_id')
            ->get();

        // Daily products (today only)
        $today = date('Y-m-d');
        $dailyCounts = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereDate('sales.sale_date', $today)
            ->select('sales.user_id', DB::raw('SUM(sale_items.quantity) as daily_products_sold'))
            ->groupBy('sales.user_id')
            ->get()
            ->keyBy('user_id');

        \Log::info('[BACKEND] Product counts:', $productCounts->toArray());

        // Compute incentive: every 40 products = ₱100
        $result = [];
        foreach ($productCounts as $row) {
            $totalSold = (int) $row->total_products_sold;
            $dailyRow = $dailyCounts->get($row->user_id);
            $dailySold = $dailyRow ? (int) $dailyRow->daily_products_sold : 0;
            $incentiveAmount = floor($totalSold / 40) * 100;

            $result[$row->user_id] = [
                'user_id' => $row->user_id,
                'total_products_sold' => $totalSold,
                'daily_products_sold' => $dailySold,
                'incentive_amount' => $incentiveAmount,
                'thresholds_reached' => floor($totalSold / 40),
            ];
        }

        \Log::info('[BACKEND] Final result:', $result);

        return response()->json($result);
    }

    /**
     * Get daily product sales incentives per user for a month
     * Returns sales grouped by date so frontend can show incentive on specific days
     */
    public function getDailyProductIncentives(Request $request)
    {
        $validated = $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020',
        ]);

        // Get daily sales grouped by user_id and date
        $dailySales = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereMonth('sales.sale_date', $validated['month'])
            ->whereYear('sales.sale_date', $validated['year'])
            ->select(
                'sales.user_id',
                DB::raw('DATE(sales.sale_date) as sale_date'),
                DB::raw('SUM(sale_items.quantity) as daily_quantity')
            )
            ->groupBy('sales.user_id', DB::raw('DATE(sales.sale_date)'))
            ->get();

        // Calculate running total and incentive per day
        $result = [];
        $userTotals = [];

        foreach ($dailySales as $row) {
            $userId = $row->user_id;
            $date = $row->sale_date;
            $dailyQty = (int) $row->daily_quantity;

            // Track running total per user
            if (!isset($userTotals[$userId])) {
                $userTotals[$userId] = 0;
            }
            $userTotals[$userId] += $dailyQty;

            // Calculate incentive based on running total (every 40 = ₱100)
            $incentiveAmount = floor($userTotals[$userId] / 40) * 100;

            $result[$userId][$date] = [
                'date' => $date,
                'daily_quantity' => $dailyQty,
                'running_total' => $userTotals[$userId],
                'incentive_amount' => $incentiveAmount,
            ];
        }

        return response()->json($result);
    }

    public function getSalesSummary(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|exists:branches,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $query = Sale::query();

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']]);
        }

        $summary = [
            'total_sales' => $query->sum('total'),
            'total_transactions' => $query->count(),
            'average_sale' => $query->avg('total'),
            'total_items_sold' => SaleItem::whereIn('sale_id', $query->pluck('id'))->sum('quantity'),
        ];

        return response()->json($summary);
    }
}

