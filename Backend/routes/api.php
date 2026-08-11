<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LoginController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\StaffAssignmentController;
use App\Http\Controllers\Api\DeductionIncentiveController;
use App\Http\Controllers\Api\FaceEnrollmentController;
use App\Http\Controllers\Api\SalaryAdvanceController;
use App\Http\Controllers\Api\SupplyRequestController;
use App\Http\Controllers\Api\PullOutController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\StaffPerformanceController;
use App\Http\Controllers\Api\BackToSaleController;
use App\Http\Controllers\Api\AddressController;
use App\Http\Controllers\Api\SalesTargetController;
use App\Http\Controllers\Api\PaymentController;

// PUBLIC ROUTES
Route::post('/login', [AuthController::class, 'login']);
Route::post('/admin/login', [LoginController::class, 'login']);
Route::post('/register', [RegisterController::class, 'register']);
Route::post('/check-username', [RegisterController::class, 'checkUsername']);
Route::post('/check-email', [RegisterController::class, 'checkEmail']);

// PROTECTED ROUTES
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    
    // Branches
    Route::get('/branches/user', [BranchController::class, 'getUserBranches']);
    Route::apiResource('branches', BranchController::class);
    Route::get('/branches/{id}/sales', [BranchController::class, 'getSales']);
    Route::get('/branches/{id}/attendance', [BranchController::class, 'getAttendance']);
    Route::get('/branches/{id}/dashboard', [BranchController::class, 'getDashboardData']);
    
    // Products  — named routes MUST come before apiResource to avoid {id} catching them
    Route::get('/products/low-stock/all', [ProductController::class, 'getLowStock']);
    Route::get('/products/restock/pending-count', [ProductController::class, 'pendingCount']);
    Route::apiResource('products', ProductController::class);
    Route::post('/products/{id}/restock', [ProductController::class, 'restock']);
    Route::post('/products/{id}/toggle-received', [ProductController::class, 'toggleReceived']);
    Route::get('/stock-batches', [ProductController::class, 'stockBatches']);
    
    // Staff (must come before apiResource to avoid {staff} catching "orders")
    Route::get('/staff/orders', [OrderController::class, 'staffIndex']);
    Route::post('/staff/orders/{id}/status', [OrderController::class, 'staffUpdateStatus']);
    Route::apiResource('staff', StaffController::class);
    
    // Staff Assignments - Add these routes
Route::get('staff-assignments', [StaffAssignmentController::class, 'index']);
Route::post('staff-assignments', [StaffAssignmentController::class, 'store']);
Route::get('staff-assignments/{staff_assignment}', [StaffAssignmentController::class, 'show']);
Route::put('staff-assignments/{staff_assignment}', [StaffAssignmentController::class, 'update']);
Route::patch('staff-assignments/{staff_assignment}', [StaffAssignmentController::class, 'update']); // optional, for PATCH support
Route::delete('staff-assignments/{staff_assignment}', [StaffAssignmentController::class, 'destroy']);
Route::get('/staff/{userId}/assignment', [StaffAssignmentController::class, 'getUserAssignment']);
    
    // Staff Deductions and Incentives
    Route::get('/staff/{userId}/deductions/{month}/{year}', [DeductionIncentiveController::class, 'getDeductions']);
    Route::get('/staff/{userId}/incentives/{month}/{year}', [DeductionIncentiveController::class, 'getIncentives']);
    Route::post('/staff/{userId}/deductions', [DeductionIncentiveController::class, 'storeDeductions']);
    Route::post('/staff/{userId}/incentives', [DeductionIncentiveController::class, 'storeIncentives']);
    Route::get('/deductions-incentives/all', [DeductionIncentiveController::class, 'getAllForMonth']);
    
    // Cash Advance
    Route::get('/cash-advances', [SalaryAdvanceController::class, 'index']);
    Route::get('/cash-advances/all', [SalaryAdvanceController::class, 'all']);
    Route::post('/cash-advances', [SalaryAdvanceController::class, 'store']);
    Route::get('/cash-advances/statistics', [SalaryAdvanceController::class, 'statistics']);
    Route::get('/cash-advances/{id}', [SalaryAdvanceController::class, 'show']);
    Route::post('/cash-advances/{id}/approve', [SalaryAdvanceController::class, 'approve']);
    Route::post('/cash-advances/{id}/reject', [SalaryAdvanceController::class, 'reject']);
    
    // Stock Requests
    Route::get('/supply-requests', [SupplyRequestController::class, 'supplyRequest']);
    Route::get('/supply-requests/all', [SupplyRequestController::class, 'getSupply']);
    Route::post('/supply-requests', [SupplyRequestController::class, 'store']);
    Route::get('/supply-requests/user/branches', [SupplyRequestController::class, 'getUserBranches']);
    Route::get('/supply-requests/statistics', [SupplyRequestController::class, 'statistics']);
    Route::get('/supply-requests/{id}', [SupplyRequestController::class, 'show']);
    Route::post('/supply-requests/{id}/approve', [SupplyRequestController::class, 'approve']);
    Route::post('/supply-requests/{id}/reject', [SupplyRequestController::class, 'reject']);
    
    // Pull-Outs
    Route::get('/pull-outs', [PullOutController::class, 'index']);
    Route::get('/pull-outs/getall', [PullOutController::class, 'getall']);
    Route::post('/pull-outs', [PullOutController::class, 'store']);
    Route::get('/pull-outs/statistics', [PullOutController::class, 'statistics']);
    Route::get('/pull-outs/{id}', [PullOutController::class, 'show']);
    Route::post('/pull-outs/{id}/approve', [PullOutController::class, 'approve']);
    Route::post('/pull-outs/{id}/reject', [PullOutController::class, 'reject']);

    // Back-to-Sales
    Route::get('/back-to-sales', [BackToSaleController::class, 'index']);
    Route::get('/back-to-sales/all', [BackToSaleController::class, 'all']);
    Route::post('/back-to-sales', [BackToSaleController::class, 'store']);
    Route::get('/back-to-sales/{id}', [BackToSaleController::class, 'show']);
    Route::post('/back-to-sales/{id}/approve', [BackToSaleController::class, 'approve']);
    Route::post('/back-to-sales/{id}/reject', [BackToSaleController::class, 'reject']);
    
    // Face enrollment (attendance)
    Route::get('/face/status', [FaceEnrollmentController::class, 'status']);
    Route::post('/face/enroll', [FaceEnrollmentController::class, 'enroll']);
    Route::post('/face/verify', [FaceEnrollmentController::class, 'verify']);
    Route::post('/face/reset', [FaceEnrollmentController::class, 'reset']);

    // Attendance
    Route::get('/attendance', [AttendanceController::class, 'getAttendance']);
    Route::post('/attendance/time-in', [AttendanceController::class, 'timeIn']);
    Route::put('/attendance/{id}/time-out', [AttendanceController::class, 'timeOut']);
    
    // Sales - Custom routes MUST come before apiResource
    Route::get('/sales/product-incentives', [SaleController::class, 'getProductIncentives']);
    Route::get('/sales/product-incentives/daily', [SaleController::class, 'getDailyProductIncentives']);
    Route::get('/sales/summary/overview', [SaleController::class, 'getSalesSummary']);
    Route::apiResource('sales', SaleController::class);

    // Customer Orders
    Route::get('/customer/orders', [OrderController::class, 'index']);
    Route::post('/customer/orders', [OrderController::class, 'store']);
    Route::get('/customer/orders/{id}', [OrderController::class, 'show']);
    Route::post('/customer/orders/{id}/cancel', [OrderController::class, 'cancel']);
    Route::get('/customer/orders/{id}/track', [OrderController::class, 'trackRider']);
    Route::get('/customer/order-statuses', [OrderController::class, 'statuses']);

    // Rider Orders
    Route::get('/rider/orders', [OrderController::class, 'riderIndex']);
    Route::post('/rider/orders/{id}/status', [OrderController::class, 'riderUpdateStatus']);

    // Rider Tracking
    Route::post('/rider/orders/{id}/location', [OrderController::class, 'updateLocation']);
    Route::post('/rider/orders/{id}/assign', [OrderController::class, 'assignRider']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    // Mark product as not received
    Route::post('/products/{id}/mark-not-received', [ProductController::class, 'markNotReceived']);

    // Reports
    Route::get('/reports/sales', [ReportController::class, 'sales']);
    Route::get('/reports/inventory', [ReportController::class, 'inventory']);
    Route::get('/reports/attendance', [ReportController::class, 'attendance']);
    Route::get('/reports/branches', [ReportController::class, 'branches']);
    Route::get('/reports/pull-out', [ReportController::class, 'pullOut']);
    Route::get('/reports/deliveries', [ReportController::class, 'deliveries']);

    // Customers
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::get('/customers/{id}', [CustomerController::class, 'show']);
    Route::post('/customers/{id}/toggle-active', [CustomerController::class, 'toggleActive']);

    // Staff Performance
    Route::get('/staff-performance', [StaffPerformanceController::class, 'index']);

    // Sales Targets
    Route::get('/sales-targets', [SalesTargetController::class, 'index']);
    Route::post('/sales-targets', [SalesTargetController::class, 'store']);
    Route::post('/sales-targets/bulk', [SalesTargetController::class, 'bulkStore']);
    Route::put('/sales-targets/{id}', [SalesTargetController::class, 'update']);
    Route::delete('/sales-targets/{id}', [SalesTargetController::class, 'destroy']);

    // Addresses
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::get('/addresses/{address}', [AddressController::class, 'show']);
    Route::put('/addresses/{address}', [AddressController::class, 'update']);
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);
    Route::post('/addresses/{address}/default', [AddressController::class, 'setDefault']);

    // Payment (PayMongo GCash)
    Route::post('/payment/gcash/create-source', [PaymentController::class, 'createGcashSource']);
    Route::get('/payment/gcash/check-status', [PaymentController::class, 'checkSourceStatus']);
    Route::get('/payment/gcash/success', [PaymentController::class, 'gcashSuccess']);
    Route::get('/payment/gcash/failed', [PaymentController::class, 'gcashFailed']);
});

// Webhook (no auth - PayMongo calls this)
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
