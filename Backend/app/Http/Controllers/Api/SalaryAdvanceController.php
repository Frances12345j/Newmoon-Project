<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalaryAdvance;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalaryAdvanceController extends Controller
{
    /**
     * Get cash advances for the authenticated user or by month for payroll
     */
    public function index(Request $request)
    {
        // If month and year are provided, return all approved advances for that month (for payroll)
        if ($request->has('month') && $request->has('year')) {
            $validated = $request->validate([
                'month' => 'required|integer|min:1|max:12',
                'year' => 'required|integer|min:2020|max:2100',
            ]);

            $advances = SalaryAdvance::where('status', 'approved')
                ->whereMonth('approved_at', $validated['month'])
                ->whereYear('approved_at', $validated['year'])
                ->with('user')
                ->get();

            // Group by user_id for payroll
            $grouped = [];
            foreach ($advances as $advance) {
                if (!isset($grouped[$advance->user_id])) {
                    $grouped[$advance->user_id] = [];
                }
                $grouped[$advance->user_id][] = $advance;
            }

            return response()->json($grouped);
        }

        // Otherwise, return advances for the authenticated user
        $user = $request->user();
        
        $advances = SalaryAdvance::where('user_id', $user->id)
            ->with(['user', 'approver', 'rejecter'])
            ->orderBy('requested_at', 'desc')
            ->paginate(5);

        return response()->json($advances);
    }

    /**
     * Get all cash advances (for admin)
     */
    public function all(Request $request)
    {
        $query = SalaryAdvance::with(['user', 'approver', 'rejecter'])
            ->orderBy('requested_at', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $advances = $query->paginate(5);

        return response()->json($advances);
    }

    /**
     * Store a new cash advance request
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'amount' => 'required|numeric|min:100|max:10000',
            'date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
            'reason' => 'nullable|string|max:500',
            'status' => 'nullable|in:pending,approved,rejected',
        ]);

        try {
            // If user_id is provided, it's an admin creating for a user
            // Otherwise, use the authenticated user
            $userId = $validated['user_id'] ?? $request->user()->id;
            $status = $validated['status'] ?? 'pending';
            $requestedAt = $validated['date'] ?? now();
            $reason = $validated['notes'] ?? $validated['reason'] ?? null;

            $advance = SalaryAdvance::create([
                'user_id' => $userId,
                'amount' => $validated['amount'],
                'reason' => $reason,
                'status' => $status,
                'requested_at' => $requestedAt,
            ]);

            // If auto-approved, set approval details
            if ($status === 'approved') {
                $advance->update([
                    'approved_at' => now(),
                    'approved_by' => $request->user()->id,
                ]);

                // Add to StaffDeduction for payroll integration
                $approvedAt = now();
                $month = $approvedAt->month;
                $year = $approvedAt->year;

                $deduction = \App\Models\StaffDeduction::updateOrCreate(
                    [
                        'user_id' => $userId,
                        'month' => $month,
                        'year' => $year,
                    ],
                    [
                        'cash_advance' => \DB::raw('cash_advance + ' . $advance->amount),
                    ]
                );
            }

            return response()->json($advance->load('user'), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create cash advance request', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a specific cash advance
     */
    public function show($id)
    {
        try {
            $advance = SalaryAdvance::with(['user', 'approver', 'rejecter'])
                ->findOrFail($id);

            return response()->json($advance);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Cash advance not found'], 404);
        }
    }

    /**
     * Approve a cash advance (admin only)
     */
    public function approve(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $advance = SalaryAdvance::findOrFail($id);

            if ($advance->status !== 'pending') {
                return response()->json(['message' => 'Cash advance can only be approved if pending'], 400);
            }

            $advance->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            // Add to StaffDeduction for payroll integration
            $approvedAt = now();
            $month = $approvedAt->month;
            $year = $approvedAt->year;

            $deduction = \App\Models\StaffDeduction::updateOrCreate(
                [
                    'user_id' => $advance->user_id,
                    'month' => $month,
                    'year' => $year,
                ],
                [
                    'cash_advance' => \DB::raw('cash_advance + ' . $advance->amount),
                ]
            );

            return response()->json($advance->load(['user', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to approve cash advance', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reject a cash advance (admin only)
     */
    public function reject(Request $request, $id)
    {
        $admin = $request->user();

        try {
            $advance = SalaryAdvance::findOrFail($id);

            if ($advance->status !== 'pending') {
                return response()->json(['message' => 'Cash advance can only be rejected if pending'], 400);
            }

            $advance->update([
                'status' => 'rejected',
                'rejected_at' => now(),
                'rejected_by' => $admin->id,
                'admin_notes' => $request->admin_notes ?? null,
            ]);

            return response()->json($advance->load(['user', 'approver', 'rejecter']));
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to reject cash advance', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get cash advance statistics for a user
     */
    public function statistics(Request $request)
    {
        $user = $request->user();

        $stats = [
            'total_requested' => SalaryAdvance::where('user_id', $user->id)->count(),
            'pending' => SalaryAdvance::where('user_id', $user->id)->where('status', 'pending')->count(),
            'approved' => SalaryAdvance::where('user_id', $user->id)->where('status', 'approved')->count(),
            'rejected' => SalaryAdvance::where('user_id', $user->id)->where('status', 'rejected')->count(),
            'total_amount_approved' => SalaryAdvance::where('user_id', $user->id)
                ->where('status', 'approved')
                ->sum('amount'),
        ];

        return response()->json($stats);
    }

    /**
     * Get cash advances for all staff by month (for payroll)
     */
    public function getByMonth(Request $request)
    {
        $validated = $request->validate([
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020|max:2100',
        ]);

        $advances = SalaryAdvance::where('status', 'approved')
            ->whereMonth('approved_at', $validated['month'])
            ->whereYear('approved_at', $validated['year'])
            ->with('user')
            ->get()
            ->groupBy('user_id');

        return response()->json($advances);
    }

    /**
     * Store a cash advance for a specific user (admin)
     */
    public function storeForUser(Request $request, $userId)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:100|max:10000',
            'date' => 'required|date',
            'note' => 'nullable|string|max:500',
        ]);

        try {
            $user = User::findOrFail($userId);

            $advance = SalaryAdvance::create([
                'user_id' => $userId,
                'amount' => $validated['amount'],
                'reason' => $validated['note'] ?? 'Cash advance request',
                'status' => 'approved',
                'requested_at' => $validated['date'],
                'approved_at' => now(),
                'approved_by' => $request->user()->id,
            ]);

            return response()->json($advance->load('user'), 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to create cash advance', 'error' => $e->getMessage()], 500);
        }
    }
}
