<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\UserFaceTemplate;
use App\Models\StaffAssignment;
use App\Services\FaceTemplateMatcher;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function getAttendance(Request $request)
    {
        $query = Attendance::with(['user', 'branch']);

        if ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }

        if ($request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        $attendance = $query->orderBy('date', 'desc')->paginate(5);

        return response()->json($attendance);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'branch_id' => 'required|exists:branches,id',
            'date' => 'required|date',
            'time_in' => 'nullable|date_format:H:i',
            'time_out' => 'nullable|date_format:H:i',
        ]);

        $attendance = Attendance::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'date' => $validated['date'],
            ],
            [
                'branch_id' => $validated['branch_id'],
                'time_in' => $validated['time_in'] ?? null,
                'time_out' => $validated['time_out'] ?? null,
                'is_late' => false,
                'late_minutes' => 0,
                'status' => 'present',
            ]
        );

        return response()->json($attendance, 201);
    }

    public function timeIn(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'branch_id' => 'required|exists:branches,id',
            'date' => 'nullable|date',
            'time_in' => 'required|string',
            'face_embedding' => 'nullable|array|min:64|max:256',
            'face_embedding.*' => 'numeric',
        ]);

        $authUser = $request->user();
        if ((int) $validated['user_id'] !== (int) $authUser->id) {
            return response()->json(['message' => 'Unauthorized attendance action.', 'error' => 'user_id mismatch'], 403);
        }

        // Staff attendance: enrolled face template required + embedding must match
        $authRole = strtolower((string) ($authUser->role ?? ''));
        if ($authRole === 'staff') {
            $template = UserFaceTemplate::where('user_id', $authUser->id)
                ->where('is_active', true)
                ->first();
            if (! $template) {
                return response()->json([
                    'message' => 'Register your face first before time in/out.',
                    'code' => 'FACE_NOT_ENROLLED',
                ], 422);
            }
            if ((int) ($template->embedding_dim ?? 0) < 64) {
                return response()->json([
                    'message' => 'Old face template detected. Please register again for high-accuracy face recognition.',
                    'code' => 'FACE_TEMPLATE_WEAK',
                ], 422);
            }
            if (! is_array($request->input('face_embedding')) || count($request->input('face_embedding')) < 8) {
                return response()->json([
                    'message' => 'Face verification required.',
                    'code' => 'FACE_EMBEDDING_REQUIRED',
                ], 422);
            }
            $probe = array_map('floatval', $request->input('face_embedding'));
            if (count($probe) < 64) {
                return response()->json([
                    'message' => 'High-accuracy face descriptor required. Please keep the app open and try again.',
                    'code' => 'FACE_STRONG_EMBEDDING_REQUIRED',
                ], 422);
            }
            if (count($probe) !== count($template->embedding)) {
                return response()->json([
                    'message' => 'Face template outdated. Please re-register your face.',
                    'code' => 'FACE_DIM_MISMATCH',
                ], 422);
            }
            $threshold = FaceTemplateMatcher::threshold();
            $similarity = FaceTemplateMatcher::cosineSimilarity($template->embedding, $probe);
            if ($similarity < $threshold) {
                \Log::warning('[ATTENDANCE] Face mismatch on time-in', ['user_id' => $authUser->id]);

                return response()->json([
                    'message' => 'Face not recognized. Time in denied.',
                    'code' => 'FACE_MISMATCH',
                    'similarity' => $similarity,
                    'threshold' => $threshold,
                ], 422);
            }
        }

        $assignment = StaffAssignment::where('user_id', $validated['user_id'])
            ->where('branch_id', $validated['branch_id'])
            ->where('is_active', true)
            ->first();

        if (!$assignment) {
            return response()->json([
                'message' => 'No active branch assignment found.',
                'error' => 'This staff member is not assigned to the selected branch.',
            ], 422);
        }

        $date = $validated['date'] ?? now()->toDateString();

        $existingAttendance = Attendance::where('user_id', $validated['user_id'])
            ->whereDate('date', $date)
            ->first();

        if ($existingAttendance && $existingAttendance->time_in) {
            return response()->json([
                'message' => 'Time in already recorded for today.',
                'error' => 'You cannot time in again until the next day.',
                'attendance' => $existingAttendance,
            ], 409);
        }

        // Check if user is late (after 9:00 AM)
        $timeIn = \Carbon\Carbon::parse($date . ' ' . $validated['time_in']);
        $cutoff = \Carbon\Carbon::parse($date . ' 09:00');
        $isLate = $timeIn->gt($cutoff);
        $lateMinutes = $isLate ? $cutoff->diffInMinutes($timeIn) : 0;

        $attendance = Attendance::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'date' => $date,
            ],
            [
                'branch_id' => $validated['branch_id'],
                'time_in' => $timeIn->format('H:i:s'),
                'is_late' => $isLate,
                'late_minutes' => $lateMinutes,
                'status' => $isLate ? 'late' : 'present',
            ]
        );

        // Optional debug for mobile UI (non-breaking if ignored)
        if (isset($similarity, $threshold)) {
            return response()->json([
                'attendance' => $attendance,
                'similarity' => $similarity,
                'threshold' => $threshold,
            ]);
        }

        return response()->json($attendance);
    }

    public function timeOut(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'time_out' => 'required|string',
                'face_embedding' => 'nullable|array|min:64|max:256',
                'face_embedding.*' => 'numeric',
            ]);

            $attendance = Attendance::findOrFail($id);

            $authUser = $request->user();
            if ((int) $attendance->user_id !== (int) $authUser->id) {
                return response()->json(['message' => 'Unauthorized attendance action.', 'error' => 'not your record'], 403);
            }

            $authRole = strtolower((string) ($authUser->role ?? ''));
            if ($authRole === 'staff') {
                $template = UserFaceTemplate::where('user_id', $authUser->id)
                    ->where('is_active', true)
                    ->first();
                if (! $template) {
                    return response()->json([
                        'message' => 'Register your face first before time in/out.',
                        'code' => 'FACE_NOT_ENROLLED',
                    ], 422);
                }
                if ((int) ($template->embedding_dim ?? 0) < 64) {
                    return response()->json([
                        'message' => 'Old face template detected. Please register again for high-accuracy face recognition.',
                        'code' => 'FACE_TEMPLATE_WEAK',
                    ], 422);
                }
                if (! is_array($request->input('face_embedding')) || count($request->input('face_embedding')) < 8) {
                    return response()->json([
                        'message' => 'Face verification required.',
                        'code' => 'FACE_EMBEDDING_REQUIRED',
                    ], 422);
                }
                $probe = array_map('floatval', $request->input('face_embedding'));
                if (count($probe) < 64) {
                    return response()->json([
                        'message' => 'High-accuracy face descriptor required. Please keep the app open and try again.',
                        'code' => 'FACE_STRONG_EMBEDDING_REQUIRED',
                    ], 422);
                }
                if (count($probe) !== count($template->embedding)) {
                    return response()->json([
                        'message' => 'Face template outdated. Please re-register your face.',
                        'code' => 'FACE_DIM_MISMATCH',
                    ], 422);
                }
                $threshold = FaceTemplateMatcher::threshold();
                $similarity = FaceTemplateMatcher::cosineSimilarity($template->embedding, $probe);
                if ($similarity < $threshold) {
                    \Log::warning('[ATTENDANCE] Face mismatch on time-out', ['user_id' => $authUser->id]);

                    return response()->json([
                        'message' => 'Face not recognized. Time out denied.',
                        'code' => 'FACE_MISMATCH',
                        'similarity' => $similarity,
                        'threshold' => $threshold,
                    ], 422);
                }
            }

            if (!$attendance->time_in) {
                return response()->json([
                    'message' => 'Time in is required before time out.',
                    'error' => 'Please time in first.',
                ], 422);
            }

            if ($attendance->time_out) {
                return response()->json([
                    'message' => 'Time out already recorded for today.',
                    'error' => 'You cannot time out again for the same attendance record.',
                    'attendance' => $attendance,
                ], 409);
            }

            $timeIn = \Carbon\Carbon::parse($attendance->time_in);
            $timeOut = \Carbon\Carbon::parse($timeIn->toDateString() . ' ' . $validated['time_out']);

            if ($timeOut->lt($timeIn)) {
                $timeOut->addDay();
            }

            $minutesWorked = $timeIn->diffInMinutes($timeOut);
            $hoursWorked = round($minutesWorked / 60, 2);
            
            // Set status: a late staff who completes time in + time out is "Completed Late"
            if ($attendance->is_late) {
                $status = 'completed_late';
            } elseif ($hoursWorked < 1) {
                $status = 'incomplete';
            } else {
                $status = 'completed';
            }

            $attendance->update([
                'time_out' => $timeOut->format('H:i:s'),
                'hours_worked' => $hoursWorked,
                'status' => $status,
            ]);

            if (isset($similarity, $threshold)) {
                return response()->json([
                    'attendance' => $attendance,
                    'similarity' => $similarity,
                    'threshold' => $threshold,
                ]);
            }

            return response()->json($attendance);
        } catch (\Exception $e) {
            \Log::error('TimeOut error: ' . $e->getMessage(), [
                'id' => $id,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Failed to record time out',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}