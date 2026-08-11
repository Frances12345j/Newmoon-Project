<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffAssignment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class StaffAssignmentController extends Controller
{
    /**
     * Display a listing of staff assignments
     */
    public function index(Request $request)
    {
        $query = StaffAssignment::with(['user', 'branch'])
            ->whereHas('user', function ($q) {
                $q->whereIn('role', [User::ROLE_STAFF, User::ROLE_RIDER]);
            });

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('position')) {
            $query->where('position', $request->position);
        }

        // Filter by user role
        if ($request->filled('role')) {
            $query->whereHas('user', function ($q) use ($request) {
                $q->where('role', $request->role);
            });
        }

        $paginate = !$request->has('paginate') || $request->paginate !== 'false';
        $perPage = $request->has('per_page') ? (int)$request->per_page : 5;

        if ($paginate) {
            return response()->json($query->latest()->paginate($perPage));
        }

        return response()->json($query->latest()->get());
    }

    /**
     * Store a newly created staff assignment
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'user_id'    => 'required|exists:users,id',
                'branch_id'  => 'required|exists:branches,id',
                'position'   => 'nullable|string|max:255',
                'daily_rate' => 'nullable|numeric|min:0',
                'is_active'  => 'sometimes|boolean',
            ]);

            $user = User::find($validated['user_id']);
            if (!$user) {
                return response()->json([
                    'message' => 'User not found'
                ], 404);
            }

            // Allow both STAFF and RIDER
            if (!in_array($user->role, [User::ROLE_STAFF, User::ROLE_RIDER], true)) {
                return response()->json([
                    'message' => 'Only staff members and delivery riders can be assigned to branches.'
                ], 422);
            }

            // Set default position based on role
            $defaultPosition = $user->role === User::ROLE_RIDER ? 'Delivery Rider' : 'Staff';

            // Check if user already has an active assignment
            $existingActive = StaffAssignment::where('user_id', $validated['user_id'])
                ->where('is_active', true)
                ->first();

            if ($existingActive) {
                // If the user is being reassigned to the same branch and position, return error
                if ($existingActive->branch_id == $validated['branch_id'] && 
                    $existingActive->position == ($validated['position'] ?? $defaultPosition)) {
                    return response()->json([
                        'message' => 'This user is already assigned to this branch with the same position.',
                        'existing_assignment' => $existingActive
                    ], 422);
                }
                
                // Deactivate existing assignment
                $existingActive->update(['is_active' => false]);
            }

            // Create new assignment
            $assignment = StaffAssignment::create([
                'user_id'    => $validated['user_id'],
                'branch_id'  => $validated['branch_id'],
                'position'   => $validated['position'] ?? $defaultPosition,
                'daily_rate' => $validated['daily_rate'] ?? ($user->role === User::ROLE_RIDER ? 400.00 : 500.00),
                'is_active'  => $validated['is_active'] ?? true,
            ]);

            return response()->json([
                'message' => 'Branch assignment created successfully.',
                'data' => $assignment->load(['user', 'branch'])
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('StaffAssignment store error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to create assignment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified staff assignment
     */
    public function show($staff_assignment)
    {
        $assignment = StaffAssignment::with(['user', 'branch'])->find($staff_assignment);
        
        if (!$assignment) {
            return response()->json([
                'message' => 'Assignment not found.'
            ], 404);
        }

        return response()->json($assignment);
    }

    /**
     * Update the specified staff assignment
     */
    public function update(Request $request, $staff_assignment)
    {
        try {
            $assignment = StaffAssignment::find($staff_assignment);
            if (!$assignment) {
                return response()->json([
                    'message' => 'Assignment not found.'
                ], 404);
            }

            $validated = $request->validate([
                'user_id'    => 'sometimes|exists:users,id',
                'branch_id'  => 'sometimes|exists:branches,id',
                'position'   => 'nullable|string|max:255',
                'daily_rate' => 'nullable|numeric|min:0',
                'is_active'  => 'sometimes|boolean',
            ]);

            // If user_id is being changed, verify the user can be assigned.
            if (isset($validated['user_id'])) {
                $user = User::find($validated['user_id']);
                if (!$user) {
                    return response()->json([
                        'message' => 'User not found'
                    ], 404);
                }

                if (!in_array($user->role, [User::ROLE_STAFF, User::ROLE_RIDER], true)) {
                    return response()->json([
                        'message' => 'Only staff members and delivery riders can be assigned to branches.'
                    ], 422);
                }

                // Check if the new user already has an active assignment (different from current)
                if ($validated['user_id'] != $assignment->user_id) {
                    $existingActive = StaffAssignment::where('user_id', $validated['user_id'])
                        ->where('is_active', true)
                        ->where('id', '!=', $staff_assignment)
                        ->first();

                    if ($existingActive) {
                        return response()->json([
                            'message' => 'This user already has an active assignment.',
                            'existing_assignment' => $existingActive
                        ], 422);
                    }
                }
            }

            // Update the assignment
            $assignment->update($validated);

            return response()->json([
                'message' => 'Branch assignment updated successfully.',
                'data' => $assignment->load(['user', 'branch'])
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('StaffAssignment update error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to update assignment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified staff assignment
     */
    public function destroy($staff_assignment)
    {
        $assignment = StaffAssignment::find($staff_assignment);
        if (!$assignment) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $assignment->delete();

        return response()->json(['message' => 'Assignment deleted successfully.']);
    }

    /**
     * Get active assignment for a specific user
     * Route: GET /staff/{userId}/assignment
     */
    public function getUserAssignment($userId)
    {
        $assignment = StaffAssignment::with(['user', 'branch'])
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (!$assignment) {
            return response()->json([
                'message' => 'No active branch assignment found for this staff member.',
            ], 404);
        }

        return response()->json($assignment);
    }
}