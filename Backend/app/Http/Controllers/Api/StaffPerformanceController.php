<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Attendance;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalesTarget;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffPerformanceController extends Controller
{
    public function index(Request $request)
    {
        $month = $request->input('month', date('Y-m'));
        $branchId = $request->input('branch_id');
        $startDate = $month . '-01';
        $endDate = date('Y-m-t', strtotime($startDate));

        $prevMonth = date('Y-m', strtotime($month . '-01 -1 month'));
        $prevStart = $prevMonth . '-01';
        $prevEnd = date('Y-m-t', strtotime($prevStart));

        $staffQuery = User::where('role', User::ROLE_STAFF);
        if ($branchId) {
            $staffQuery->whereHas('branchAssignments', function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->where('is_active', true);
            });
        }
        $staff = $staffQuery->with(['branchAssignments' => function ($q) {
            $q->where('is_active', true)->with('branch');
        }])->get();

        // Current month data
        $attendanceData = Attendance::whereBetween('date', [$startDate, $endDate])
            ->selectRaw('user_id, COUNT(*) as present_days, COALESCE(SUM(CASE WHEN is_late = 1 OR is_late = true THEN 1 ELSE 0 END), 0) as late_days, COALESCE(SUM(hours_worked), 0) as total_hours')
            ->groupBy('user_id')->get()->keyBy('user_id');

        $salesData = Sale::whereBetween('sale_date', [$startDate, $endDate])
            ->selectRaw('user_id, COUNT(*) as total_transactions, COALESCE(SUM(total), 0) as total_sales')
            ->groupBy('user_id')->get()->keyBy('user_id');

        $productData = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.sale_date', [$startDate, $endDate])
            ->selectRaw('sales.user_id, COALESCE(SUM(sale_items.quantity), 0) as total_products')
            ->groupBy('sales.user_id')->get()->keyBy('user_id');

        // Daily products (today only)
        $today = date('Y-m-d');
        $dailyProductData = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereDate('sales.sale_date', $today)
            ->selectRaw('sales.user_id, COALESCE(SUM(sale_items.quantity), 0) as daily_products')
            ->groupBy('sales.user_id')->get()->keyBy('user_id');

        // Previous month for trends
        $prevAttendance = Attendance::whereBetween('date', [$prevStart, $prevEnd])
            ->selectRaw('user_id, COUNT(*) as present_days')
            ->groupBy('user_id')->get()->keyBy('user_id');

        $prevSales = Sale::whereBetween('sale_date', [$prevStart, $prevEnd])
            ->selectRaw('user_id, COALESCE(SUM(total), 0) as total_sales')
            ->groupBy('user_id')->get()->keyBy('user_id');

        $prevProducts = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereBetween('sales.sale_date', [$prevStart, $prevEnd])
            ->selectRaw('sales.user_id, COALESCE(SUM(sale_items.quantity), 0) as total_products')
            ->groupBy('sales.user_id')->get()->keyBy('user_id');

        // Targets
        $targetsQuery = SalesTarget::query();
        if ($branchId) {
            $targetsQuery->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }
        $targets = $targetsQuery->get();
        $branchTargets = $targets->whereNotNull('branch_id')->whereNull('user_id')->keyBy('branch_id');
        $userTargets = $targets->whereNotNull('user_id')->keyBy('user_id');

        $results = [];
        $branchAggregates = [];

        foreach ($staff as $user) {
            $att = $attendanceData->get($user->id);
            $sales = $salesData->get($user->id);
            $prod = $productData->get($user->id);
            $prevAtt = $prevAttendance->get($user->id);
            $prevSale = $prevSales->get($user->id);
            $prevProd = $prevProducts->get($user->id);

            $totalProducts = $prod ? (int) $prod->total_products : 0;
            $dailyProd = $dailyProductData->get($user->id);
            $dailyProducts = $dailyProd ? (int) $dailyProd->daily_products : 0;
            $thresholds = floor($totalProducts / 40);
            $incentive = $thresholds * 100;

            $branch = null;
            $branchIdVal = null;
            if ($user->branchAssignments->isNotEmpty()) {
                $assignment = $user->branchAssignments->first();
                $branchIdVal = $assignment->branch_id;
                $branch = ['id' => $assignment->branch_id, 'name' => $assignment->branch?->name];
            }

            $presentDays = $att ? (int) $att->present_days : 0;
            $lateDays = $att ? (int) $att->late_days : 0;
            $onTimeDays = $presentDays - $lateDays;
            $attendanceRate = $presentDays > 0 ? round(($onTimeDays / $presentDays) * 100, 1) : 0;

            $totalSales = $sales ? round((float) $sales->total_sales, 2) : 0;
            $totalTransactions = $sales ? (int) $sales->total_transactions : 0;
            $totalHours = $att ? round((float) $att->total_hours, 2) : 0;

            // Resolve product target
            $userTarget = $userTargets->get($user->id);
            $branchTarget = $branchIdVal ? $branchTargets->get($branchIdVal) : null;
            $activeTarget = $userTarget ?: $branchTarget;
            $targetProducts = $activeTarget ? (int) $activeTarget->target_products : 40;
            $productTargetPct = $targetProducts > 0 ? round(($totalProducts / $targetProducts) * 100, 1) : 0;
            $dailyTarget = (int) ceil($targetProducts / date('t', strtotime($startDate)));

            $score = $this->computePerformanceScore($attendanceRate, $totalProducts, $targetProducts);

            // Trends
            $prevPresentDays = $prevAtt ? (int) $prevAtt->present_days : 0;
            $prevAttendanceRate = $prevPresentDays > 0 ? 100 : 0;
            $prevTotalSales = $prevSale ? round((float) $prevSale->total_sales, 2) : 0;
            $prevTotalProducts = $prevProd ? (int) $prevProd->total_products : 0;

            $salesTrend = $prevTotalSales > 0 ? round((($totalSales - $prevTotalSales) / $prevTotalSales) * 100, 1) : ($totalSales > 0 ? 100 : 0);
            $productTrend = $prevTotalProducts > 0 ? round((($totalProducts - $prevTotalProducts) / $prevTotalProducts) * 100, 1) : ($totalProducts > 0 ? 100 : 0);
            $attendanceTrend = $prevAttendanceRate > 0 ? round($attendanceRate - $prevAttendanceRate, 1) : 0;

            $results[] = [
                'id' => $user->id,
                'firstname' => $user->firstname,
                'lastname' => $user->lastname,
                'full_name' => trim($user->firstname . ' ' . $user->lastname),
                'branch' => $branch,
                'attendance' => [
                    'present_days' => $presentDays,
                    'late_days' => $lateDays,
                    'on_time_days' => $onTimeDays,
                    'total_hours' => $totalHours,
                    'attendance_rate' => $attendanceRate,
                ],
                'sales' => [
                    'total_transactions' => $totalTransactions,
                    'total_sales' => $totalSales,
                ],
                'quota' => [
                    'total_products_sold' => $totalProducts,
                    'daily_products_sold' => $dailyProducts,
                    'target_products' => $targetProducts,
                    'daily_target' => $dailyTarget,
                    'product_target_pct' => $productTargetPct,
                    'threshold_40_pcs' => $thresholds,
                    'incentive_amount' => $incentive,
                ],
                'performance_score' => $score,
                'rating' => $this->getRating($score),
                'trend' => [
                    'sales' => $salesTrend,
                    'products' => $productTrend,
                    'attendance' => $attendanceTrend,
                ],
            ];

            // Branch aggregates
            if ($branch) {
                if (!isset($branchAggregates[$branchIdVal])) {
                    $branchAggregates[$branchIdVal] = [
                        'branch_id' => $branchIdVal,
                        'branch_name' => $branch['name'],
                        'staff_count' => 0,
                        'total_sales' => 0,
                        'total_products' => 0,
                        'total_target_products' => 0,
                        'total_hours' => 0,
                        'avg_attendance_rate' => 0,
                        'avg_score' => 0,
                    ];
                }
                $agg = &$branchAggregates[$branchIdVal];
                $agg['staff_count']++;
                $agg['total_sales'] += $totalSales;
                $agg['total_products'] += $totalProducts;
                $agg['total_target_products'] += $targetProducts;
                $agg['total_hours'] += $totalHours;
                $agg['avg_attendance_rate'] += $attendanceRate;
                $agg['avg_score'] += $score;
                unset($agg);
            }
        }

        foreach ($branchAggregates as &$agg) {
            if ($agg['staff_count'] > 0) {
                $agg['avg_attendance_rate'] = round($agg['avg_attendance_rate'] / $agg['staff_count'], 1);
                $agg['avg_score'] = round($agg['avg_score'] / $agg['staff_count'], 1);
                $agg['target_achievement_pct'] = $agg['total_target_products'] > 0
                    ? round(($agg['total_products'] / $agg['total_target_products']) * 100, 1)
                    : 0;
            }
        }
        unset($agg);

        usort($results, fn($a, $b) => $b['performance_score'] - $a['performance_score']);

        $totalProductsSold = collect($results)->sum('quota.total_products_sold');
        $totalTargetProducts = collect($results)->sum('quota.target_products');
        $totalDailyProducts = collect($results)->sum('quota.daily_products_sold');
        $totalDailyTargets = collect($results)->sum('quota.daily_target');

        return response()->json([
            'data' => $results,
            'month' => $month,
            'meta' => [
                'total_staff' => count($results),
                'total_branches' => collect($results)->pluck('branch.name')->unique()->filter()->count(),
                'total_sales' => round(collect($results)->sum('sales.total_sales'), 2),
                'total_products_sold' => $totalProductsSold,
                'total_daily_products' => $totalDailyProducts,
                'total_daily_targets' => $totalDailyTargets,
                'total_incentives' => collect($results)->sum('quota.incentive_amount'),
                'avg_attendance_rate' => collect($results)->avg('attendance.attendance_rate'),
                'avg_performance_score' => round(collect($results)->avg('performance_score'), 1),
                'total_target_products' => $totalTargetProducts,
                'target_achievement_pct' => $totalTargetProducts > 0
                    ? round(($totalProductsSold / $totalTargetProducts) * 100, 1)
                    : 0,
                'daily_target_achievement_pct' => $totalDailyTargets > 0
                    ? round(($totalDailyProducts / $totalDailyTargets) * 100, 1)
                    : 0,
            ],
            'branches' => array_values($branchAggregates),
            'monthly_trend' => $this->getMonthlyTrend($branchId),
        ]);
    }

    private function computePerformanceScore($attendanceRate, $totalProducts, $targetProducts)
    {
        $attendanceScore = ($attendanceRate / 100) * 40;
        $productScore = min(60, ($totalProducts / max($targetProducts, 1)) * 60);
        return round(min(100, $attendanceScore + $productScore));
    }

    private function getRating($score)
    {
        if ($score >= 90) return 'Excellent';
        if ($score >= 75) return 'Good';
        if ($score >= 60) return 'Average';
        if ($score >= 40) return 'Needs Improvement';
        return 'Poor';
    }

    private function getMonthlyTrend($branchId = null)
    {
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $months[] = date('Y-m', strtotime("-{$i} months"));
        }

        $results = [];
        foreach ($months as $m) {
            $start = $m . '-01';
            $end = date('Y-m-t', strtotime($start));

            $salesTotal = Sale::whereBetween('sale_date', [$start, $end])
                ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
                ->sum('total');

            $productTotal = SaleItem::join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->whereBetween('sales.sale_date', [$start, $end])
                ->when($branchId, fn($q) => $q->where('sales.branch_id', $branchId))
                ->sum('sale_items.quantity');

            $attendanceRate = 0;
            $attRecords = Attendance::whereBetween('date', [$start, $end])
                ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN is_late = 0 OR is_late IS NULL THEN 1 ELSE 0 END) as on_time')
                ->first();

            if ($attRecords && $attRecords->total > 0) {
                $attendanceRate = round(($attRecords->on_time / $attRecords->total) * 100, 1);
            }

            $results[] = [
                'month' => $m,
                'label' => date('M Y', strtotime($start)),
                'total_sales' => round((float) $salesTotal, 2),
                'total_products' => (int) $productTotal,
                'attendance_rate' => $attendanceRate,
            ];
        }

        return $results;
    }
}
