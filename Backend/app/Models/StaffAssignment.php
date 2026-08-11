<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaffAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'branch_id',
        'position',
        'daily_rate',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'daily_rate' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }
}