<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_targets', function (Blueprint $table) {
            $table->dropColumn('month');
        });
    }

    public function down(): void
    {
        Schema::table('sales_targets', function (Blueprint $table) {
            $table->string('month')->nullable()->index()->after('user_id');
        });
    }
};
