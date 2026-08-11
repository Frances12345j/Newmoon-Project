<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_stock_deliveries', function (Blueprint $table) {
            $table->timestamp('not_received_at')->nullable()->after('marked_as_not_received');
        });
    }

    public function down(): void
    {
        Schema::table('product_stock_deliveries', function (Blueprint $table) {
            $table->dropColumn('not_received_at');
        });
    }
};
