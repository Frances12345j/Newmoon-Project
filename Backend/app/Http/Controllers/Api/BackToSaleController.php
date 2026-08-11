<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BackToSale;
use App\Models\ProductStock;
use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BackToSaleController extends Controller
{
    public function index(Request $request)
    {
        $query = BackToSale::with(['user', 'product', 'branch', 'approver', 'rejecter']);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('returned_at', [$request->start_date, $request->end_date]);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%");
                })->orWhereHas('user', function ($sq) use ($search) {
                    $sq->where('firstname', 'like', "%{$search}%")
                      ->orWhere('lastname', 'like', "%{$search}%");
                });
            });
        }

        $backToSales = $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10);

        return response()->json($backToSales);
    }

    public function all(Request $request)
    {
        $query = BackToSale::with(['user', 'product', 'branch', 'approver', 'rejecter']);

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('returned_at', [$request->start_date, $request->end_date]);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%");
                })->orWhereHas('user', function ($sq) use ($search) {
                    $sq->where('firstname', 'like', "%{$search}%")
                      ->orWhere('lastname', 'like', "%{$search}%");
                });
            });
        }

        // Compute stats from ALL records (unfiltered, unpaginated)
        $stats = [
            'total' => BackToSale::count(),
            'pending' => BackToSale::where('status', 'pending')->count(),
            'approved' => BackToSale::where('status', 'approved')->count(),
            'rejected' => BackToSale::where('status', 'rejected')->count(),
            'total_quantity' => BackToSale::where('status', 'approved')->sum('quantity'),
        ];

        // Return paginated data (with filters applied)
        $perPage = (int) $request->per_page ?: 10;
        $backToSales = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $backToSales->items(),
            'stats' => $stats,
            'pagination' => [
                'current_page' => $backToSales->currentPage(),
                'per_page' => $backToSales->perPage(),
                'total' => $backToSales->total(),
                'last_page' => $backToSales->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'branch_id' => 'required|exists:branches,id',
            'quantity' => 'required|numeric|min:0.5',
            'notes' => 'nullable|string|max:500',
        ]);

        $stock = ProductStock::where('product_id', $validated['product_id'])
            ->where('branch_id', $validated['branch_id'])
            ->first();

        $availableQty = round((float) ($stock->quantity ?? 0), 2);
        $requestedQty = round((float) $validated['quantity'], 2);

        if ($requestedQty > $availableQty + 0.001) {
            return response()->json([
                'message' => "Insufficient stock. Only {$availableQty} unit(s) available for return.",
            ], 422);
        }

        $backToSale = BackToSale::create([
            'user_id' => Auth::id(),
            'product_id' => $validated['product_id'],
            'branch_id' => $validated['branch_id'],
            'quantity' => $validated['quantity'],
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
            'returned_at' => now(),
        ]);

        return response()->json($backToSale->load(['user', 'product', 'branch']), 201);
    }

    public function show($id)
    {
        $backToSale = BackToSale::with(['user', 'product', 'branch', 'approver', 'rejecter'])->findOrFail($id);
        return response()->json($backToSale);
    }

    public function approve($id)
    {
        $backToSale = BackToSale::findOrFail($id);

        if ($backToSale->status !== 'pending') {
            return response()->json(['message' => 'This return has already been processed'], 400);
        }

        $stock = ProductStock::where('product_id', $backToSale->product_id)
            ->where('branch_id', $backToSale->branch_id)
            ->first();

        if ($stock) {
            $stock->increment('quantity', $backToSale->quantity);
        } else {
            $stock = ProductStock::create([
                'product_id' => $backToSale->product_id,
                'branch_id' => $backToSale->branch_id,
                'quantity' => $backToSale->quantity,
                'minimum_stock' => 0,
                'received' => true,
            ]);
        }

        // Create a FIFO batch for the returned stock (newest batch = today)
        StockBatch::create([
            'product_id'  => $backToSale->product_id,
            'branch_id'   => $backToSale->branch_id,
            'quantity'    => $backToSale->quantity,
            'remaining'   => $backToSale->quantity,
            'received_at' => now(),
            'source_type' => 'back_to_sale',
            'source_id'   => $backToSale->id,
        ]);

        $backToSale->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => Auth::id(),
        ]);

        return response()->json($backToSale->load(['user', 'product', 'branch', 'approver']));
    }

    public function reject(Request $request, $id)
    {
        $validated = $request->validate([
            'admin_notes' => 'nullable|string|max:500',
        ]);

        $backToSale = BackToSale::findOrFail($id);

        if ($backToSale->status !== 'pending') {
            return response()->json(['message' => 'This return has already been processed'], 400);
        }

        $backToSale->update([
            'status' => 'rejected',
            'admin_notes' => $validated['admin_notes'] ?? null,
            'rejected_at' => now(),
            'rejected_by' => Auth::id(),
        ]);

        return response()->json($backToSale->load(['user', 'product', 'branch', 'rejecter']));
    }
}
