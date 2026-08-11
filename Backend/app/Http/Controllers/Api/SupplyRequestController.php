<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplyRequest;
use App\Models\ProductStock;
use App\Models\ProductStockDelivery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplyRequestController extends Controller
{
    /**
     * Get stock requests for the authenticated user
     */
    public function supplyRequest(Request $request)
    {
        $user = $request->user();
        
        // Simple Laravel pagination - auto-calculates pages
        $requests = SupplyRequest::where('user_id', $user->id)
            ->with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('requested_at', 'desc')
            ->paginate(5); // 5 items per page

        // Return as JSON with full pagination metadata
        return response()->json($requests);
    }

    /**
     * Get all stock requests (for admin)
     */
    public function getSupply(Request $request)
    {
        $query = SupplyRequest::with(['user', 'product', 'branch', 'approver', 'rejecter'])
            ->orderBy('requested_at', 'desc');

        // Apply filters if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        // Simple pagination with 5 items per page
        $requests = $query->paginate(5);

        // Return as JSON with full pagination metadata
        return response()->json($requests);
    }

    /**
     * Store a new stock request
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:500',
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

            $supplyRequest = SupplyRequest::create([
                'user_id' => $user->id,
                'product_id' => $validated['product_id'],
                'branch_id' => $staffAssignment->branch_id,
                'quantity' => $validated['quantity'],
                'reason' => $validated['reason'] ?? null,
                'status' => 'pending',
                'requested_at' => now(),
            ]);

            return response()->json($supplyRequest->load(['user', 'product', 'branch']), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create stock request', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a specific stock request
     */
    public function show($id)
    {
        try {
            $request = SupplyRequest::with(['user', 'product', 'branch', 'approver', 'rejecter'])
                ->findOrFail($id);

            return response()->json($request);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Stock request not found'], 404);
        }
    }

    /**
     * Approve a stock request (admin only)
     */
    public function approve(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $stockRequest = SupplyRequest::findOrFail($id);

            if ($stockRequest->status !== 'pending') {
                return response()->json(['message' => 'Stock request can only be approved if pending'], 400);
            }

            DB::beginTransaction();
            
            $stockRequest->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            // Create a pending delivery for the approved stock request
            $delivery = ProductStockDelivery::create([
                'product_id' => $stockRequest->product_id,
                'branch_id' => $stockRequest->branch_id,
                'quantity' => $stockRequest->quantity,
                'restocked_at' => \Carbon\Carbon::now('Asia/Manila'),
                'received_at' => null,
                'received_by' => null,
            ]);

            DB::commit();

            return response()->json($stockRequest->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to approve stock request', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reject a stock request (admin only)
     */
    public function reject(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $stockRequest = SupplyRequest::findOrFail($id);

            if ($stockRequest->status !== 'pending') {
                return response()->json(['message' => 'Stock request can only be rejected if pending'], 400);
            }

            $stockRequest->update([
                'status' => 'rejected',
                'rejected_at' => now(),
                'rejected_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            return response()->json($stockRequest->load(['user', 'product', 'branch', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to reject stock request', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get branches where the user has an active staff assignment
     */
    public function getUserBranches(Request $request)
    {
        $user = $request->user();
        
        // Get branches where the user has an active staff assignment
        $assignedBranchIds = \App\Models\StaffAssignment::where('user_id', $user->id)
            ->where('is_active', true)
            ->pluck('branch_id');

        $branches = \App\Models\Branch::where('is_active', true)
            ->whereIn('id', $assignedBranchIds)
            ->get();

        return response()->json($branches);
    }

    /**
     * Get stock request statistics for a user
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        $stats = [
            'total_requested' => SupplyRequest::where('user_id', $user->id)->count(),
            'pending' => SupplyRequest::where('user_id', $user->id)->where('status', 'pending')->count(),
            'approved' => SupplyRequest::where('user_id', $user->id)->where('status', 'approved')->count(),
            'rejected' => SupplyRequest::where('user_id', $user->id)->where('status', 'rejected')->count(),
            'total_quantity_approved' => SupplyRequest::where('user_id', $user->id)
                ->where('status', 'approved')
                ->sum('quantity'),
        ];

        return response()->json($stats);
    }
}