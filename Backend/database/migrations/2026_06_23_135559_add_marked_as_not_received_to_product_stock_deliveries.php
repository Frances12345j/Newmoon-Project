<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_stock_deliveries', function (Blueprint $table) {
            $table->boolean('marked_as_not_received')->default(false)->after('received_by');
        });
    }

    public function down(): void
    {
        Schema::table('product_stock_deliveries', function (Blueprint $table) {
            $table->dropColumn('marked_as_not_received');
        });
    }
};