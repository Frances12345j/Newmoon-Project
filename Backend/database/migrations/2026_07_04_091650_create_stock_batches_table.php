<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('branch_id')->constrained()->onDelete('cascade');
            $table->decimal('quantity', 10, 2);
            $table->decimal('remaining', 10, 2);
            $table->timestamp('received_at');
            $table->string('source_type')->default('delivery');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'branch_id', 'received_at']);
        });

        // Seed batches from existing product_stocks (migrate current stock as one batch per row)
        $stocks = DB::table('product_stocks')->get();
        foreach ($stocks as $stock) {
            $qty = (float) $stock->quantity;
            if ($qty <= 0) continue;

            $receivedAt = $stock->restocked_at
                ?? $stock->updated_at
                ?? now()->subDays(1);

            DB::table('stock_batches')->insert([
                'product_id'  => $stock->product_id,
                'branch_id'   => $stock->branch_id,
                'quantity'    => $qty,
                'remaining'   => $qty,
                'received_at' => $receivedAt,
                'source_type' => 'legacy',
                'source_id'   => null,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // Seed per-delivery batches from existing received deliveries
        $deliveries = DB::table('product_stock_deliveries')
            ->whereNotNull('received_at')
            ->get();
        foreach ($deliveries as $delivery) {
            $qty = (float) $delivery->quantity;
            if ($qty <= 0) continue;

            DB::table('stock_batches')->insert([
                'product_id'  => $delivery->product_id,
                'branch_id'   => $delivery->branch_id,
                'quantity'    => $qty,
                'remaining'   => $qty,
                'received_at' => $delivery->received_at,
                'source_type' => 'delivery',
                'source_id'   => $delivery->id,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_batches');
    }
};
