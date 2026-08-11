<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductStock;
use App\Models\PullOut;
use App\Models\StockBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PullOutController extends Controller
{
    /**
     * Get pull-outs for the authenticated user
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $pullOuts = PullOut::where('user_id', $user->id)
            ->with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('pulled_out_at', 'desc')
            ->paginate(5);

        return response()->json($pullOuts);
    }

    /**
     * Get all pull-outs (for admin)
     */
    public function getall(Request $request)
    {
        $query = PullOut::with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('pulled_out_at', 'desc');

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Compute stats from ALL records (unpaginated)
        $stats = [
            'total' => PullOut::count(),
            'pending' => PullOut::where('status', 'pending')->count(),
            'approved' => PullOut::where('status', 'approved')->count(),
            'rejected' => PullOut::where('status', 'rejected')->count(),
            'total_quantity' => PullOut::where('status', 'approved')->sum('quantity'),
        ];

        // Return paginated data
        $perPage = (int) $request->per_page ?: 10;
        $pullOuts = $query->paginate($perPage);

        return response()->json([
            'data' => $pullOuts->items(),
            'stats' => $stats,
            'pagination' => [
                'current_page' => $pullOuts->currentPage(),
                'per_page' => $pullOuts->perPage(),
                'total' => $pullOuts->total(),
                'last_page' => $pullOuts->lastPage(),
            ],
        ]);
    }

    /**
     * Store a new pull-out (pending approval)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $user = $request->user();
            
            // Get the user's active staff assignment branch
            $staffAssignment = \App\Models\StaffAssignment::where('user_id', $user->id)
                ->where('is_active', true)
                ->first();

            if (!$staffAssignment) {
                return response()->json(['message' => 'No active branch assignment found for user'], 400);
            }

            // Create pull-out record with pending status
            $pullOut = PullOut::create([
                'user_id' => $user->id,
                'product_id' => $validated['product_id'],
                'branch_id' => $staffAssignment->branch_id,
                'quantity' => $validated['quantity'],
                'notes' => $validated['notes'] ?? null,
                'status' => 'pending',
                'pulled_out_at' => now(),
            ]);

            return response()->json($pullOut->load(['user', 'product', 'branch']), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create pull-out', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a specific pull-out
     */
    public function show($id)
    {
        try {
            $pullOut = PullOut::with(['user', 'product', 'branch', 'approver', 'rejecter'])
                ->findOrFail($id);

            return response()->json($pullOut);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Pull-out not found'], 404);
        }
    }

    /**
     * Get pull-out statistics for a user
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        $stats = [
            'total_pulled_out' => PullOut::where('user_id', $user->id)->count(),
            'total_quantity' => PullOut::where('user_id', $user->id)->sum('quantity'),
        ];

        return response()->json($stats);
    }

    /**
     * Approve a pull-out (admin only) — deducts stock via FIFO
     */
    public function approve(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $pullOut = PullOut::findOrFail($id);

            if ($pullOut->status !== 'pending') {
                return response()->json(['message' => 'Pull-out can only be approved if pending'], 400);
            }

            $stock = ProductStock::where('product_id', $pullOut->product_id)
                ->where('branch_id', $pullOut->branch_id)
                ->first();

            $availableQty = round((float) ($stock->quantity ?? 0), 2);
            $requestedQty = round((float) $pullOut->quantity, 2);

            if ($requestedQty > $availableQty + 0.001) {
                return response()->json([
                    'message' => "Insufficient stock. Only {$availableQty} unit(s) available, but {$requestedQty} requested for pull-out.",
                ], 422);
            }

            DB::beginTransaction();

            // Deduct from oldest stock batches first (FIFO)
            $remainingQty = $requestedQty;
            $batches = StockBatch::where('product_id', $pullOut->product_id)
                ->where('branch_id', $pullOut->branch_id)
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

            $stock->decrement('quantity', $requestedQty);

            $pullOut->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            DB::commit();

            return response()->json($pullOut->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve pull-out', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reject a pull-out (admin only)
     */
    public function reject(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $pullOut = PullOut::findOrFail($id);

            if ($pullOut->status !== 'pending') {
                return response()->json(['message' => 'Pull-out can only be rejected if pending'], 400);
            }

            $pullOut->update([
                'status' => 'rejected',
                'rejected_at' => now(),
                'rejected_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            return response()->json($pullOut->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to reject pull-out', 'error' => $e->getMessage()], 500);
        }
    }
}
