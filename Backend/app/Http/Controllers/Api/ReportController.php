<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\PullOut;
use App\Models\PullOutItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StaffAssignment;
use App\Models\StaffDeduction;
use App\Models\StaffIncentive;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Sales Report
     * GET /api/reports/sales
     * Params: start_date, end_date, group_by (daily, weekly, monthly, detail), branch_id
     */
    public function sales(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'group_by' => 'required|in:daily,weekly,monthly,detail,items,branch',
            'branch_id' => 'nullable|exists:branches,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 5;
        $page = $validated['page'] ?? 1;

        $query = Sale::with(['user', 'branch', 'items.product'])
            ->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']]);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $validated['branch_id']);
        }

        $groupBy = $validated['group_by'];

        if ($groupBy === 'detail') {
            $sales = $query->orderBy('sale_date', 'desc')->paginate($perPage, ['*'], 'page', $page);
            return response()->json([
                'data' => $sales->items(),
                'pagination' => [
                    'current_page' => $sales->currentPage(),
                    'last_page' => $sales->lastPage(),
                    'per_page' => $sales->perPage(),
                    'total' => $sales->total(),
                ],
                'summary' => [
                    'total_sales' => $sales->sum('total'),
                    'total_transactions' => $sales->total(),
                    'total_items_sold' => $sales->getCollection()->sum(function ($sale) {
                        return $sale->items->sum('quantity');
                    }),
                ],
            ]);
        }

        // ---------- Items breakdown ----------
        if ($groupBy === 'items') {
            $itemQuery = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->join('products', 'sale_items.product_id', '=', 'products.id')
                ->select(
                    'products.id as product_id',
                    'products.name as product_name',
                    DB::raw('SUM(sale_items.quantity) as total_qty'),
                    DB::raw('SUM(sale_items.subtotal) as total_revenue'),
                    DB::raw('ROUND(AVG(sale_items.price), 2) as avg_price'),
                    DB::raw('COUNT(DISTINCT sales.id) as transaction_count')
                )
                ->whereBetween('sales.sale_date', [$validated['start_date'], $validated['end_date']])
                ->when($request->has('branch_id'), fn ($q) => $q->where('sales.branch_id', $validated['branch_id']))
                ->groupBy('products.id', 'products.name')
                ->orderByDesc('total_revenue');

            $perPageItems = $validated['per_page'] ?? 15;
            $pageItems = $validated['page'] ?? 1;
            $totalItems = $itemQuery->count();
            $items = $itemQuery->offset(($pageItems - 1) * $perPageItems)->limit($perPageItems)->get();

            $totalRevenue = $items->sum('total_revenue');
            $totalQty = $items->sum('total_qty');
            $lastPageItems = (int) ceil($totalItems / $perPageItems);

            return response()->json([
                'data' => $items,
                'pagination' => [
                    'current_page' => $pageItems,
                    'last_page' => $lastPageItems,
                    'per_page' => $perPageItems,
                    'total' => $totalItems,
                ],
                'summary' => [
                    'total_revenue' => (float) $items->sum('total_revenue'),
                    'total_qty_sold' => (int) $items->sum('total_qty'),
                    'total_products' => $totalItems,
                    'avg_price' => $totalQty > 0 ? round($totalRevenue / $totalQty, 2) : 0,
                ],
            ]);
        }

        // ---------- Branch breakdown ----------
        if ($groupBy === 'branch') {
            $branchQuery = DB::table('sales')
                ->join('branches', 'sales.branch_id', '=', 'branches.id')
                ->select(
                    'branches.id as branch_id',
                    'branches.name as branch_name',
                    DB::raw('COUNT(DISTINCT sales.id) as transaction_count'),
                    DB::raw('SUM(sales.total) as total_sales'),
                    DB::raw('ROUND(AVG(sales.total), 2) as avg_transaction')
                )
                ->whereBetween('sales.sale_date', [$validated['start_date'], $validated['end_date']])
                ->groupBy('branches.id', 'branches.name')
                ->orderByDesc('total_sales');

            // Items sold per branch
            $branchItems = DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->select(
                    'sales.branch_id',
                    DB::raw('SUM(sale_items.quantity) as total_items')
                )
                ->whereBetween('sales.sale_date', [$validated['start_date'], $validated['end_date']])
                ->groupBy('sales.branch_id')
                ->get()
                ->keyBy('branch_id');

            $branchResult = $branchQuery->get()->map(function ($b) use ($branchItems) {
                $itemsData = $branchItems->get($b->branch_id);
                return [
                    'branch_id' => $b->branch_id,
                    'branch_name' => $b->branch_name,
                    'transaction_count' => (int) $b->transaction_count,
                    'total_sales' => (float) $b->total_sales,
                    'avg_transaction' => (float) $b->avg_transaction,
                    'total_items' => $itemsData ? (int) $itemsData->total_items : 0,
                ];
            });

            return response()->json([
                'data' => $branchResult,
                'summary' => [
                    'total_revenue' => $branchResult->sum('total_sales'),
                    'total_transactions' => $branchResult->sum('transaction_count'),
                    'total_branches' => $branchResult->count(),
                    'avg_branch_revenue' => $branchResult->count() > 0
                        ? round($branchResult->sum('total_sales') / $branchResult->count(), 2)
                        : 0,
                    'top_branch' => $branchResult->first()['branch_name'] ?? '-',
                ],
            ]);
        }

        // Grouped reports
        $dateFormat = $groupBy === 'daily' ? '%Y-%m-%d' : 
                     ($groupBy === 'weekly' ? '%Y-%u' : '%Y-%m');

        $groupedData = DB::table('sales')
            ->select(
                DB::raw("DATE_FORMAT(sale_date, '$dateFormat') as period"),
                DB::raw('COUNT(*) as transaction_count'),
                DB::raw('SUM(total) as total_sales'),
                DB::raw('SUM(subtotal) as subtotal'),
                DB::raw('SUM(discount_amount) as discount_amount'),
                DB::raw('SUM(senior_discount) as senior_discount_count')
            )
            ->whereBetween('sale_date', [$validated['start_date'], $validated['end_date']])
            ->when($request->has('branch_id'), fn ($q) => $q->where('branch_id', $validated['branch_id']))
            ->groupBy(DB::raw("DATE_FORMAT(sale_date, '$dateFormat')"))
            ->orderBy('period')
            ->get();

        // Get items sold per period
        $itemsPerPeriod = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->select(
                DB::raw("DATE_FORMAT(sales.sale_date, '$dateFormat') as period"),
                DB::raw('SUM(sale_items.quantity) as total_items')
            )
            ->whereBetween('sales.sale_date', [$validated['start_date'], $validated['end_date']])
            ->when($request->has('branch_id'), fn ($q) => $q->where('sales.branch_id', $validated['branch_id']))
            ->groupBy(DB::raw("DATE_FORMAT(sales.sale_date, '$dateFormat')"))
            ->get()
            ->keyBy('period');

        $result = $groupedData->map(function ($item) use ($itemsPerPeriod) {
            $itemsData = $itemsPerPeriod->get($item->period);
            return [
                'period' => $item->period,
                'transaction_count' => (int) $item->transaction_count,
                'total_sales' => (float) $item->total_sales,
                'subtotal' => (float) $item->subtotal,
                'discount_amount' => (float) $item->discount_amount,
                'senior_discount_count' => (int) $item->senior_discount_count,
                'total_items' => $itemsData ? (float) $itemsData->total_items : 0,
            ];
        });

        return response()->json([
            'data' => $result,
            'summary' => [
                'total_sales' => $groupedData->sum('total_sales'),
                'total_transactions' => $groupedData->sum('transaction_count'),
                'total_items_sold' => $itemsPerPeriod->sum('total_items'),
            ],
        ]);
    }

    /**
     * Inventory Report
     * GET /api/reports/inventory
     * Params: branch_id (optional)
     */
    public function inventory(Request $request)
{
    $validated = $request->validate([
        'branch_id' => 'nullable|exists:branches,id',
        'page'      => 'nullable|integer|min:1',
        'per_page'  => 'nullable|integer|min:1|max:100',
    ]);

    $perPage = $validated['per_page'] ?? 15;
    $page    = $validated['page'] ?? 1;

    $query = ProductStock::with(['product', 'branch'])
        ->whereHas('product', fn($q) => $q->where('is_active', true));

    if (!empty($validated['branch_id'])) {
        $query->where('branch_id', $validated['branch_id']);
    }

    // No category filter

    $stocks = $query->paginate($perPage, ['*'], 'page', $page);

    $data = [];
    $totalItems = 0;
    $totalValue = 0;
    $lowStockCount = 0;
    $outOfStockCount = 0;

    foreach ($stocks as $stock) {
        $product = $stock->product;
        $quantity = (float) $stock->quantity;
        $unitCost = (float) $product->price;
        $totalValueRow = $quantity * $unitCost;
        $minStock = max((float) $stock->minimum_stock, 15);

        if ($quantity <= 0) {
            $status = 'Out of Stock';
            $outOfStockCount++;
        } elseif ($quantity < $minStock) {
            $status = 'Low Stock';
            $lowStockCount++;
        } else {
            $status = 'In Stock';
        }

        $data[] = [
            'id'            => $stock->id,
            'product_id'    => $product->id,
            'name'          => $product->name,
            'sku'           => $product->sku ?? '',
            'category_name' => $product->category ?? 'Uncategorized',
            'branch_id'     => $stock->branch_id,
            'branch_name'   => $stock->branch->name ?? 'Unknown',
            'current_stock' => $quantity,
            'reorder_level' => $minStock,
            'unit_cost'     => $unitCost,
            'total_value'   => $totalValueRow,
            'status'        => $status,
            'is_low_stock'  => $status === 'Low Stock',
        ];

        $totalItems += $quantity;
        $totalValue += $totalValueRow;
    }

    // --- Stock Movements ---
    $movementLimit = 50;

    // IN: stock deliveries received
    $deliveryMovements = \App\Models\ProductStockDelivery::with(['product', 'branch'])
        ->whereNotNull('received_at')
        ->when(!empty($validated['branch_id']), fn($q) => $q->where('branch_id', $validated['branch_id']))
        ->orderByDesc('received_at')
        ->limit($movementLimit)
        ->get()
        ->map(fn($d) => [
            'id'            => 'del-' . $d->id,
            'created_at'    => $d->received_at,
            'item_name'     => $d->product->name ?? 'Unknown',
            'movement_type' => 'IN',
            'quantity'      => (int) $d->quantity,
            'branch_name'   => $d->branch->name ?? 'N/A',
            'reference'     => 'Delivery #' . $d->id,
            'notes'         => 'Restocked delivery',
        ]);

    // OUT: products sold via sales
    $saleMovements = DB::table('sale_items')
        ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
        ->join('products', 'sale_items.product_id', '=', 'products.id')
        ->leftJoin('branches', 'sales.branch_id', '=', 'branches.id')
        ->select(
            'sale_items.id',
            'sales.sale_date as created_at',
            'products.name as item_name',
            DB::raw("'OUT' as movement_type"),
            'sale_items.quantity',
            DB::raw('COALESCE(branches.name, "N/A") as branch_name'),
            DB::raw('CONCAT("Sale #", sales.id) as reference'),
            DB::raw('"Sold via POS" as notes')
        )
        ->when(!empty($validated['branch_id']), fn($q) => $q->where('sales.branch_id', $validated['branch_id']))
        ->orderByDesc('sales.sale_date')
        ->limit($movementLimit)
        ->get()
        ->map(fn($r) => (array) $r);

    // Merge and sort by date descending, take top N
    $allMovements = $deliveryMovements->values()
        ->concat(collect($saleMovements))
        ->sortByDesc('created_at')
        ->values()
        ->take($movementLimit)
        ->all();

    return response()->json([
        'data' => $data,
        'movements' => $allMovements,
        'pagination' => [
            'current_page' => $stocks->currentPage(),
            'last_page'    => $stocks->lastPage(),
            'per_page'     => $stocks->perPage(),
            'total'        => $stocks->total(),
        ],
        'summary' => [
            'total_items'       => $totalItems,
            'total_value'       => $totalValue,
            'low_stock_items'   => $lowStockCount,
            'out_of_stock_items'=> $outOfStockCount,
            'total_products'    => $stocks->total(),
        ],
    ]);
}

    /**
     * Attendance Report
     * GET /api/reports/attendance
     * Params: start_date, end_date, branch_id (optional)
     */
    public function attendance(Request $request)
{
    $validated = $request->validate([
        'start_date' => 'required|date',
        'end_date'   => 'required|date',
        'branch_id'  => 'nullable|exists:branches,id',
        'user_id'    => 'nullable|exists:users,id',
        'page'       => 'nullable|integer|min:1',
        'per_page'   => 'nullable|integer|min:1|max:100',
    ]);

    $perPage = $validated['per_page'] ?? 5;
    $page    = $validated['page'] ?? 1;

    // Eager load user, branch, and branchAssignments (correct relation name)
    $query = Attendance::with(['user', 'branch', 'user.branchAssignments'])
        ->whereBetween('date', [$validated['start_date'], $validated['end_date']]);

    if (!empty($validated['branch_id'])) {
        $query->where('branch_id', $validated['branch_id']);
    }
    if (!empty($validated['user_id'])) {
        $query->where('user_id', $validated['user_id']);
    }

    $attendance = $query->orderBy('date', 'desc')->paginate($perPage, ['*'], 'page', $page);

    // Transform each record
    $transformed = collect($attendance->items())->map(function ($record) {
        $user = $record->user;
        $name = $user ? ($user->firstname . ' ' . $user->lastname) : 'Unknown';
        // Get position from first active branch assignment
        $position = 'Staff';
        if ($user && $user->branchAssignments) {
            $assignment = $user->branchAssignments->first();
            if ($assignment) {
                $position = $assignment->position ?? 'Staff';
            }
        }
        return [
            'id'           => $record->id,
            'date'         => $record->date,
            'staff_name'   => $name,
            'position'     => $position,
            'time_in'      => $record->time_in,
            'time_out'     => $record->time_out,
            'duration'     => $record->hours_worked ?? 0,
            'status'       => $record->status ?? 'absent',
            'is_late'      => $record->is_late ?? false,
            'late_minutes' => $record->late_minutes ?? 0,
            'branch_name'  => $record->branch->name ?? 'N/A',
        ];
    });

    // Staff summary (group by user)
    $staffSummary = [];
    $grouped = $attendance->getCollection()->groupBy('user_id');
    foreach ($grouped as $userId => $records) {
        $first = $records->first();
        $user = $first->user;
        $name = $user ? ($user->firstname . ' ' . $user->lastname) : 'Unknown';
        $daysPresent = $records->filter(fn($r) => in_array($r->status, ['present', 'completed', 'completed_late']))->count();
        $daysLate = $records->filter(fn($r) => $r->is_late)->count();
        $daysAbsent = $records->filter(fn($r) => $r->status === 'absent')->count();
        $totalHours = $records->sum('hours_worked');
        $totalDays = $records->count();
        $rate = $totalDays > 0 ? round(($daysPresent / $totalDays) * 100, 2) : 0;
        $staffSummary[] = [
            'staff_id'        => $userId,
            'staff_name'      => $name,
            'days_present'    => $daysPresent,
            'days_late'       => $daysLate,
            'days_absent'     => $daysAbsent,
            'total_hours'     => $totalHours,
            'attendance_rate' => $rate,
        ];
    }

    // Overall summary
    $totalRecords = $attendance->total();
    $presentCount = $attendance->getCollection()->filter(fn($r) => in_array($r->status, ['present', 'completed', 'completed_late']))->count();
    $lateCount = $attendance->getCollection()->filter(fn($r) => $r->is_late)->count();
    $absentCount = $attendance->getCollection()->filter(fn($r) => $r->status === 'absent')->count();
    $totalHours = $attendance->getCollection()->sum('hours_worked');

    return response()->json([
        'data' => $transformed,
        'pagination' => [
            'current_page' => $attendance->currentPage(),
            'last_page'    => $attendance->lastPage(),
            'per_page'     => $attendance->perPage(),
            'total'        => $attendance->total(),
        ],
        'summary' => [
            'total_days'      => $totalRecords,
            'total_present'   => $presentCount,
            'total_late'      => $lateCount,
            'total_absent'    => $absentCount,
            'attendance_rate' => $totalRecords > 0 ? round(($presentCount / $totalRecords) * 100, 2) : 0,
            'staff_summary'   => $staffSummary,
        ],
    ]);
}

    /**
     * Branch Report
     * GET /api/reports/branches
     * Params: start_date, end_date (optional)
     */
    public function branches(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $perPage = $validated['per_page'] ?? 15;
        $page = $validated['page'] ?? 1;

        $startDate = $validated['start_date'] ?? null;
        $endDate = $validated['end_date'] ?? null;

        // Compute previous period for growth calculation
        $prevStart = null;
        $prevEnd = null;
        if ($startDate && $endDate) {
            $startDt = Carbon::parse($startDate);
            $endDt = Carbon::parse($endDate);
            $periodDays = $startDt->diffInDays($endDt);
            $prevEnd = $startDt->subDay()->toDateString();
            $prevStart = $startDt->subDays($periodDays)->toDateString();
        }

        $branches = DB::table('branches')->get();

        $branchData = [];
        foreach ($branches as $branch) {
            $salesQuery = DB::table('sales')->where('branch_id', $branch->id);
            if ($startDate && $endDate) {
                $salesQuery->whereBetween('sale_date', [$startDate, $endDate]);
            }
            $totalSales = (float) $salesQuery->sum('total');
            $transactionCount = $salesQuery->count();

            // Previous period sales for growth
            $growth = null;
            if ($prevStart && $prevEnd) {
                $prevSales = (float) DB::table('sales')
                    ->where('branch_id', $branch->id)
                    ->whereBetween('sale_date', [$prevStart, $prevEnd])
                    ->sum('total');
                $growth = $prevSales > 0 ? round((($totalSales - $prevSales) / $prevSales) * 100, 1) : ($totalSales > 0 ? 100.0 : 0.0);
            }

            $staffCount = StaffAssignment::where('branch_id', $branch->id)
                ->where('is_active', true)
                ->count();

            $inventoryCount = ProductStock::where('branch_id', $branch->id)
                ->where('quantity', '>', 0)
                ->count();

            $branchData[] = [
                'id' => $branch->id,
                'name' => $branch->name,
                'location' => $branch->location ?? 'N/A',
                'total_sales' => $totalSales,
                'transaction_count' => $transactionCount,
                'staff_count' => $staffCount,
                'inventory_count' => $inventoryCount,
                'avg_transaction' => $transactionCount > 0 ? round($totalSales / $transactionCount, 2) : 0,
                'sales_per_staff' => $staffCount > 0 ? round($totalSales / $staffCount, 2) : 0,
                'growth' => $growth,
            ];
        }

        // Sort by total sales descending
        usort($branchData, fn($a, $b) => $b['total_sales'] <=> $a['total_sales']);

        // Manual pagination
        $offset = ($page - 1) * $perPage;
        $paginatedData = array_slice($branchData, $offset, $perPage);
        $total = count($branchData);
        $lastPage = (int) ceil($total / $perPage);

        $totalSalesAll = array_sum(array_column($branchData, 'total_sales'));
        $totalTransactionsAll = array_sum(array_column($branchData, 'transaction_count'));

        return response()->json([
            'data' => $paginatedData,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
            'summary' => [
                'total_branches' => $total,
                'total_revenue' => $totalSalesAll,
                'total_transactions' => $totalTransactionsAll,
                'avg_branch_revenue' => $total > 0 ? round($totalSalesAll / $total, 2) : 0,
                'top_branch' => $branchData[0]['name'] ?? '-',
                'performance_distribution' => collect($branchData)->map(fn($b) => [
                    'branch_id' => $b['id'],
                    'branch_name' => $b['name'],
                    'revenue' => $b['total_sales'],
                    'percentage' => $totalSalesAll > 0 ? round(($b['total_sales'] / $totalSalesAll) * 100, 1) : 0,
                ])->values()->all(),
            ],
        ]);
    }

    /**
     * Pull-Out Report
     * GET /api/reports/pull-out
     * Params: start_date, end_date, branch_id (optional), status (optional)
     */
    public function pullOut(Request $request)
{
    try {
        // ✅ BASE QUERY WITH RELATIONSHIPS
        $query = \App\Models\PullOut::with(['user', 'product', 'branch']);

        // ✅ FILTERS
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('source_branch_id') && $request->source_branch_id !== 'all') {
            $query->where('branch_id', $request->source_branch_id);
        }

        // ✅ PAGINATION
        $perPage = $request->per_page ?? 10;
        $pullOuts = $query->latest()->paginate($perPage);

        // ✅ TRANSFORM DATA
        $transformedData = collect($pullOuts->items())->map(function ($pullOut) {
            $productPrice = optional($pullOut->product)->price ?? 0;
            $userName = trim(
                (optional($pullOut->user)->firstname ?? '') . ' ' .
                (optional($pullOut->user)->lastname ?? '')
            ) ?: 'Unknown User';

            $branchName = optional($pullOut->branch)->name ?? 'Unknown Branch';

            // Get destination branch if it exists
            $destinationBranch = optional($pullOut->destinationBranch)->name ?? $branchName;

            return [
                'id' => $pullOut->id,
                'reference_number' => 'PO-' . str_pad($pullOut->id, 5, '0', STR_PAD_LEFT),
                'created_at' => $pullOut->created_at,
                'requested_by' => $userName,
                'source_branch' => $branchName,
                'destination_branch' => $destinationBranch, // Use actual destination if exists
                'items_count' => $pullOut->quantity,
                'total_value' => $pullOut->quantity * $productPrice,
                'status' => $pullOut->status,
                'notes' => $pullOut->notes,
                'items' => [
                    [
                        'id' => $pullOut->product_id,
                        'item_name' => optional($pullOut->product)->name ?? 'N/A',
                        'sku' => optional($pullOut->product)->sku ?? 'N/A',
                        'quantity' => $pullOut->quantity,
                        'unit_cost' => $productPrice,
                        'total' => $pullOut->quantity * $productPrice,
                    ]
                ]
            ];
        });

        // ✅ SUMMARY - FIXED to use the original query with proper counting
        $summary = [
            'total_transfers' => $pullOuts->total(),
            'completed' => \App\Models\PullOut::where('status', 'approved')->count(),
            'pending' => \App\Models\PullOut::where('status', 'pending')->count(),
            'total_value' => $pullOuts->getCollection()->sum(function ($item) {
                return ($item->quantity ?? 0) * (optional($item->product)->price ?? 0);
            }),
        ];

        // ✅ FINAL RESPONSE
        return response()->json([
            'success' => true,
            'data' => $transformedData,
            'summary' => $summary,
            'pagination' => [
                'current_page' => $pullOuts->currentPage(),
                'per_page' => $pullOuts->perPage(),
                'total' => $pullOuts->total(),
                'last_page' => $pullOuts->lastPage(),
            ]
        ]);

    } catch (\Exception $e) {
        \Log::error('PullOut error: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
            'line' => $e->getLine(),
            'file' => $e->getFile()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch pull-out records',
            'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
        ], 500);
    }
}
    /**
     * Delivery Report
     * GET /api/reports/deliveries
     * Params: start_date, end_date, status (optional), branch_id (optional), rider_id (optional)
     */
    public function deliveries(Request $request)
    {
        try {
            $query = \App\Models\Order::with(['user', 'rider', 'branch', 'items.product'])
                ->whereIn('status', ['ready', 'picked_up', 'out_for_delivery', 'delivered']);

            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->whereBetween('created_at', [
                    $request->start_date . ' 00:00:00',
                    $request->end_date . ' 23:59:59'
                ]);
            }

            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            if ($request->filled('branch_id') && $request->branch_id !== 'all') {
                $query->where('branch_id', $request->branch_id);
            }

            if ($request->filled('rider_id') && $request->rider_id !== 'all') {
                $query->where('rider_id', $request->rider_id);
            }

            $perPage = $request->per_page ?? 10;
            $orders = $query->latest()->paginate($perPage);

            $storageUrl = $request->getSchemeAndHttpHost() . '/storage/';
            $transformed = collect($orders->items())->map(function ($order) use ($storageUrl) {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'customer_name' => $order->user?->full_name ?? $order->user?->firstname ?? 'Customer',
                    'customer_phone' => $order->user?->phone,
                    'delivery_address' => $order->delivery_address,
                    'branch_name' => $order->branch?->name ?? 'N/A',
                    'rider_name' => $order->rider?->full_name ?? $order->rider?->firstname ?? 'Unassigned',
                    'rider_phone' => $order->rider?->phone,
                    'status' => $order->status,
                    'total' => (float) $order->total,
                    'payment_method' => $order->payment_method,
                    'items_count' => $order->items->count(),
                    'delivery_photo' => $order->delivery_photo ? $storageUrl . $order->delivery_photo : null,
                    'delivery_notes' => $order->delivery_notes,
                    'delivered_at' => $order->delivered_at,
                    'delivery_latitude' => $order->delivery_latitude,
                    'delivery_longitude' => $order->delivery_longitude,
                    'rider_latitude' => $order->rider_latitude,
                    'rider_longitude' => $order->rider_longitude,
                    'created_at' => $order->created_at->toIso8601String(),
                ];
            });

            $summary = [
                'total_deliveries' => $orders->total(),
                'delivered' => \App\Models\Order::where('status', 'delivered')->count(),
                'out_for_delivery' => \App\Models\Order::where('status', 'out_for_delivery')->count(),
                'picked_up' => \App\Models\Order::where('status', 'picked_up')->count(),
                'ready' => \App\Models\Order::where('status', 'ready')->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => $transformed,
                'summary' => $summary,
                'pagination' => [
                    'current_page' => $orders->currentPage(),
                    'per_page' => $orders->perPage(),
                    'total' => $orders->total(),
                    'last_page' => $orders->lastPage(),
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Deliveries report error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch delivery records',
            ], 500);
        }
    }
}