<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'user_id',
        'branch_id',
        'rider_id',
        'status',
        'payment_method',
        'payment_status',
        'delivery_address',
        'delivery_latitude',
        'delivery_longitude',
        'notes',
        'subtotal',
        'delivery_fee',
        'total',
        'gcash_reference',
        'rider_latitude',
        'rider_longitude',
        'rider_location_updated_at',
        'delivery_notes',
        'customer_confirmed',
        'delivery_photo',
        'delivered_at',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function rider()
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function items()
    {
        return $this->hasMany(OrderDetails::class);
    }
}
