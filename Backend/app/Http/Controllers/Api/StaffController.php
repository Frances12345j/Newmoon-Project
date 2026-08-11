<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\QueryException;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        // Get both staff and delivery riders
        $query = User::whereIn('role', ['staff', 'delivery_rider'])
            ->with(['branchAssignments' => function ($q) {
                $q->where('is_active', true);
            }, 'branchAssignments.branch']);

        if ($request->has('branch_id')) {
            $query->whereHas('branchAssignments', function ($q) use ($request) {
                $q->where('branch_id', $request->branch_id);
            });
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('firstname', 'like', '%' . $request->search . '%')
                  ->orWhere('lastname', 'like', '%' . $request->search . '%')
                  ->orWhere('username', 'like', '%' . $request->search . '%');
            });
        }

        // Check if pagination is disabled
        $paginate = !$request->has('paginate') || $request->paginate !== 'false';

        if ($paginate) {
            // Return paginated results
            $staff = $query->paginate($request->per_page ?? 100);
            
            // Transform the items in the paginator
            $staff->getCollection()->transform(function ($user) {
                $assignment = $user->branchAssignments->first();
                $user->position = $assignment ? $assignment->position : ($user->role === 'delivery_rider' ? 'Rider' : 'Staff');
                // Add a flag to indicate if user can be assigned to a branch
                $user->can_be_assigned = $user->role === 'staff';
                return $user;
            });
            
            return response()->json($staff);
        }

        // Return all users without pagination
        $staff = $query->get();
        
        // Transform the collection
        $staff->transform(function ($user) {
            $assignment = $user->branchAssignments->first();
            $user->position = $assignment ? $assignment->position : ($user->role === 'delivery_rider' ? 'Rider' : 'Staff');
            // Add a flag to indicate if user can be assigned to a branch
            $user->can_be_assigned = $user->role === 'staff';
            return $user;
        });

        return response()->json($staff);
    }

    public function store(Request $request)
    {
        // Treat empty password from frontend as null (optional field).
        if ($request->input('password') === '') {
            $request->merge(['password' => null]);
        }
        if ($request->input('email') === '') {
            $request->merge(['email' => null]);
        }
        if ($request->input('phone') === '') {
            $request->merge(['phone' => null]);
        }

        $validated = $request->validate([
            'username' => 'required|string|unique:users',
            'password' => 'nullable|string|min:6',
            'email' => 'nullable|email|unique:users,email',
            'firstname' => 'required|string',
            'lastname' => 'required|string',
            'middlename' => 'nullable|string',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'branch_id' => 'nullable|exists:branches,id',
            'position' => 'nullable|string|in:Staff,Rider',
            'daily_rate' => 'nullable|numeric|min:0',
        ]);

        $plainPassword = $validated['password'] ?? 'default123';
        
        // Set user role based on position
        $position = $validated['position'] ?? 'Staff';
        $userRole = ($position === 'Rider') ? 'delivery_rider' : 'staff';
        
        // Prepare user data
        $userData = [
            'username' => $validated['username'],
            'password' => Hash::make($plainPassword),
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'middlename' => $validated['middlename'] ?? null,
            'address' => $validated['address'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? ($validated['username'] . '@newmoon.local'),
            'role' => $userRole,
            'is_active' => true,
        ];
        
        // Store position for staff assignment
        $position = $validated['position'] ?? 'Staff';
        $branchId = $validated['branch_id'] ?? null;
        $dailyRate = $validated['daily_rate'] ?? 500;

        DB::beginTransaction();

        try {
            $staff = User::create($userData);

            // Only create assignment if user is staff and branch is provided
            if ($userRole === 'staff' && $branchId) {
                StaffAssignment::create([
                    'user_id' => $staff->id,
                    'branch_id' => $branchId,
                    'position' => $position,
                    'daily_rate' => $dailyRate,
                    'is_active' => true,
                ]);
            }

            DB::commit();

            return response()->json($staff->load('branchAssignments'), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to create staff', 'error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        try {
            $staff = User::whereIn('role', ['staff', 'delivery_rider'])
                ->with(['branchAssignments.branch'])
                ->findOrFail($id);

            return response()->json($staff);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Staff member not found'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Unable to load staff data',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $staff = User::findOrFail($id);

        $validated = $request->validate([
            'firstname' => 'sometimes|string',
            'lastname' => 'sometimes|string',
            'middlename' => 'nullable|string',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:20',
            'branch_id' => 'nullable|exists:branches,id',
            'position' => 'nullable|string|in:Staff,Rider',
            'daily_rate' => 'nullable|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        // Update user role based on position if provided
        if (isset($validated['position'])) {
            $validated['role'] = ($validated['position'] === 'Rider') ? 'delivery_rider' : 'staff';
        }

        // Remove position from user update data (it's stored in staff_assignments)
        $userData = $validated;
        unset($userData['position']);
        unset($userData['branch_id']);
        unset($userData['daily_rate']);

        $staff->update($userData);

        // Only update assignment if user is staff
        if ($staff->role === 'staff') {
            if ($request->has('branch_id') || $request->has('position') || $request->has('daily_rate')) {
                $assignment = StaffAssignment::where('user_id', $id)->first();

                if ($assignment) {
                    $assignment->update([
                        'branch_id' => $request->branch_id ?? $assignment->branch_id,
                        'position' => $request->position ?? $assignment->position,
                        'daily_rate' => $request->daily_rate ?? $assignment->daily_rate,
                    ]);
                } elseif ($request->has('branch_id') && $request->branch_id) {
                    StaffAssignment::create([
                        'user_id' => $id,
                        'branch_id' => $request->branch_id,
                        'position' => $request->position ?? 'Staff',
                        'daily_rate' => $request->daily_rate ?? 500,
                        'is_active' => true,
                    ]);
                }
            }
        }

        return response()->json($staff->load('branchAssignments'));
    }

    public function destroy($id)
    {
        $staff = User::findOrFail($id);

        try {
            $staff->delete();
            return response()->json(['message' => 'Staff deleted successfully']);
        } catch (QueryException $e) {
            // Common case: staff has sales records; DB FK prevents delete.
            if ((string) $e->getCode() === '23000') {
                return response()->json([
                    'message' => 'Cannot delete this staff because there are sales records linked to this account. Disable the staff instead.',
                    'code' => 'STAFF_DELETE_CONSTRAINT',
                    'suggested_action' => 'disable',
                ], 409);
            }
            throw $e;
        }
    }
}