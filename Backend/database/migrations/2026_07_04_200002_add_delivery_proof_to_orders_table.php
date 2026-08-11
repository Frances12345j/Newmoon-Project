<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->text('delivery_notes')->nullable()->after('notes');
            $table->string('customer_confirmed')->nullable()->after('delivery_notes');
            $table->string('delivery_photo')->nullable()->after('customer_confirmed');
            $table->timestamp('delivered_at')->nullable()->after('rider_location_updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_notes', 'customer_confirmed', 'delivery_photo', 'delivered_at']);
        });
    }
};
