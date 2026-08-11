<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Sale;
use App\Models\Order;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $perPage = (int) ($request->get('per_page', 15));
        $search = $request->get('search', '');

        $query = User::where('role', User::ROLE_CUSTOMER);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('firstname', 'like', "%{$search}%")
                  ->orWhere('lastname', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $customers = $query->orderBy('created_at', 'desc')
            ->paginate($perPage);

        $data = $customers->map(function ($customer) {
            $totalSpent = Sale::where('customer_name', $customer->full_name)
                ->orWhere('user_id', $customer->id)
                ->sum('total');

            $orderCount = Order::where('user_id', $customer->id)->count();
            $saleCount = Sale::where('customer_name', $customer->full_name)
                ->orWhere('user_id', $customer->id)
                ->count();

            return [
                'id' => $customer->id,
                'username' => $customer->username,
                'firstname' => $customer->firstname,
                'lastname' => $customer->lastname,
                'middlename' => $customer->middlename,
                'full_name' => $customer->full_name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'address' => $customer->address,
                'is_active' => $customer->is_active,
                'created_at' => $customer->created_at,
                'total_spent' => $totalSpent,
                'total_orders' => $orderCount,
                'total_sales' => $saleCount,
            ];
        });

        return response()->json([
            'data' => $data,
            'pagination' => [
                'current_page' => $customers->currentPage(),
                'last_page' => $customers->lastPage(),
                'per_page' => $customers->perPage(),
                'total' => $customers->total(),
            ],
        ]);
    }

    public function show($id)
    {
        $customer = User::where('role', User::ROLE_CUSTOMER)->findOrFail($id);

        $sales = Sale::where(function ($q) use ($customer) {
                $q->where('customer_name', $customer->full_name)
                  ->orWhere('user_id', $customer->id);
            })
            ->with(['branch', 'items.product'])
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($sale) {
                return [
                    'id' => $sale->id,
                    'invoice_number' => $sale->invoice_number,
                    'branch' => $sale->branch?->name,
                    'subtotal' => $sale->subtotal,
                    'discount_amount' => $sale->discount_amount,
                    'senior_discount' => $sale->senior_discount,
                    'total' => $sale->total,
                    'cash_collected' => $sale->cash_collected,
                    'change_given' => $sale->change_given,
                    'sale_date' => $sale->sale_date,
                    'payment_method' => $sale->payment_method,
                    'customer_name' => $sale->customer_name,
                    'created_at' => $sale->created_at,
                    'items' => $sale->items->map(function ($item) {
                        return [
                            'product_name' => $item->product?->name ?? 'Unknown',
                            'quantity' => $item->quantity,
                            'price' => $item->price,
                            'total' => $item->total,
                        ];
                    }),
                ];
            });

        $orders = Order::where('user_id', $customer->id)
            ->with(['branch', 'items.product'])
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'branch' => $order->branch?->name,
                    'subtotal' => $order->subtotal,
                    'delivery_fee' => $order->delivery_fee,
                    'total' => $order->total,
                    'status' => $order->status,
                    'payment_method' => $order->payment_method,
                    'payment_status' => $order->payment_status,
                    'gcash_reference' => $order->gcash_reference,
                    'delivery_address' => $order->delivery_address,
                    'notes' => $order->notes,
                    'created_at' => $order->created_at,
                    'items' => $order->items->map(function ($item) {
                        return [
                            'product_name' => $item->product?->name ?? 'Unknown',
                            'quantity' => $item->quantity,
                            'price' => $item->price,
                            'total' => $item->total,
                        ];
                    }),
                ];
            });

        $totalSpent = $sales->sum('total') + $orders->sum('total');

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'username' => $customer->username,
                'firstname' => $customer->firstname,
                'lastname' => $customer->lastname,
                'middlename' => $customer->middlename,
                'full_name' => $customer->full_name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'address' => $customer->address,
                'is_active' => $customer->is_active,
                'created_at' => $customer->created_at,
                'total_spent' => $totalSpent,
                'total_orders' => $orders->count(),
                'total_sales' => $sales->count(),
            ],
            'sales' => $sales,
            'orders' => $orders,
        ]);
    }

    public function toggleActive($id)
    {
        $customer = User::where('role', User::ROLE_CUSTOMER)->findOrFail($id);
        $customer->is_active = !$customer->is_active;
        $customer->save();

        return response()->json([
            'message' => 'Customer status updated',
            'is_active' => $customer->is_active,
        ]);
    }
}
