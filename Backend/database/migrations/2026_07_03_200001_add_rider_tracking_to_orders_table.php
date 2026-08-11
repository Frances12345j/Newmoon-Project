<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('rider_id')->nullable()->constrained('users')->onDelete('set null');
            $table->decimal('rider_latitude', 10, 7)->nullable();
            $table->decimal('rider_longitude', 10, 7)->nullable();
            $table->timestamp('rider_location_updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['rider_id', 'rider_latitude', 'rider_longitude', 'rider_location_updated_at']);
        });
    }
};
