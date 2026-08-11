<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockBatch extends Model
{
    protected $fillable = [
        'product_id',
        'branch_id',
        'quantity',
        'remaining',
        'received_at',
        'source_type',
        'source_id',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'remaining' => 'decimal:2',
        'received_at' => 'string',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }
}
