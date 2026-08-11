<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // ✅ ROLE CONSTANTS
    const ROLE_ADMIN = 'admin';
    const ROLE_STAFF = 'staff';
    const ROLE_CUSTOMER = 'customer';
    const ROLE_RIDER = 'delivery_rider';

    protected $fillable = [
        'username',
        'password',
        'firstname',
        'lastname',
        'middlename',
        'address',
        'role',
        'email',
        'phone',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'password' => 'hashed',
    ];

    // ✅ AUTO APPEND
    protected $appends = ['full_name', 'position'];

    /*
    |--------------------------------------------------------------------------
    | RELATIONSHIPS
    |--------------------------------------------------------------------------
    */

    public function branchAssignments()
    {
        return $this->hasMany(StaffAssignment::class, 'user_id');
    }

    public function faceTemplates()
    {
        return $this->hasMany(UserFaceTemplate::class);
    }

    public function activeFaceTemplate()
    {
        return $this->hasOne(UserFaceTemplate::class)->where('is_active', true);
    }

    public function addresses()
    {
        return $this->hasMany(Address::class);
    }

    /*
    |--------------------------------------------------------------------------
    | ACCESSORS
    |--------------------------------------------------------------------------
    */

    // ✅ FULL NAME
    public function getFullNameAttribute()
    {
        return trim("{$this->firstname} {$this->middlename} {$this->lastname}");
    }

    // ✅ CURRENT BRANCH ID
    public function getCurrentBranchIdAttribute()
    {
        $active = $this->branchAssignments()
            ->where('is_active', true)
            ->first();

        return $active ? $active->branch_id : null;
    }

    // ✅ CURRENT BRANCH
    public function getCurrentBranchAttribute()
    {
        $active = $this->branchAssignments()
            ->where('is_active', true)
            ->with('branch')
            ->first();

        return $active ? $active->branch : null;
    }

    // ✅ POSITION (FIXED)
    public function getPositionAttribute()
    {
        $active = $this->branchAssignments()
            ->where('is_active', true)
            ->first();

        if ($active && $active->position) {
            return $active->position;
        }

        return $this->role === self::ROLE_RIDER ? 'Rider' : 'Staff';
    }
}