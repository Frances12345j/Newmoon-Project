import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../../lib/api';

interface OrderItem {
  id: number;
  quantity: number;
  price: number;
  total: number;
  product: { id: number; name: string };
}

interface Order {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  gcash_reference: string | null;
  created_at: string;
  branch: { id: number; name: string };
  items: OrderItem[];
}

const STATUS_FLOW: Record<string, { label: string; icon: string; color: string; step: number }> = {
  pending: { label: 'Order Placed', icon: 'receipt-outline', color: '#F59E0B', step: 0 },
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle-outline', color: '#3B82F6', step: 1 },
  preparing: { label: 'Preparing', icon: 'flame-outline', color: '#8B5CF6', step: 2 },
  ready: { label: 'Ready for Pickup', icon: 'checkmark-circle', color: '#10B981', step: 3 },
  picked_up: { label: 'Picked Up', icon: 'bicycle-outline', color: '#06B6D4', step: 4 },
  out_for_delivery: { label: 'Out for Delivery', icon: 'bicycle-outline', color: '#10B981', step: 5 },
  delivered: { label: 'Delivered', icon: 'checkmark-done', color: '#10B981', step: 6 },
  cancelled: { label: 'Cancelled', icon: 'close-circle', color: '#EF4444', step: -1 },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrder();
      const interval = setInterval(loadOrder, 10000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const loadOrder = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const response = await api.get(`/customer/orders/${id}`);
      setOrder(response.data);
    } catch (err) {
      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load order');
        router.back();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const cancelOrder = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await api.post(`/customer/orders/${id}/cancel`);
            await loadOrder();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  if (!order) return null;

  const statusInfo = STATUS_FLOW[order.status] || STATUS_FLOW.pending;
  const canCancel = ['pending', 'confirmed'].includes(order.status);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header - Fixed layout */}
      <View className="bg-white px-4 py-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="p-2 mr-2"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Order Details</Text>
            <Text className="text-xs text-gray-500">{order.order_number}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4 bg-gray-50" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadOrder(true)} tintColor="#F59E0B" colors={['#F59E0B']} />
        }
      >
        {/* Status */}
        <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 shadow-sm items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: statusInfo.color + '15' }}>
            <Ionicons name={statusInfo.icon as any} size={32} color={statusInfo.color} />
          </View>
          <Text className="text-gray-900 text-lg font-bold">{statusInfo.label}</Text>
          <Text className="text-gray-500 text-xs mt-1">
            {order.payment_method === 'gcash' ? 'Paid via GCash' : 'Cash on Delivery'}
          </Text>
          {order.gcash_reference && (
            <Text className="text-blue-500 text-xs mt-1">Ref: {order.gcash_reference}</Text>
          )}
        </View>

        {/* Status Steps */}
        <View className="bg-white rounded-2xl p-5 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-4">Order Progress</Text>
          {Object.entries(STATUS_FLOW).filter(([key]) => key !== 'cancelled').map(([key, info], idx, arr) => {
            const currentStep = statusInfo.step;
            const itemStep = info.step;
            const isActive = order.status === key;
            const isCompleted = currentStep > itemStep && currentStep >= 0;
            const isCurrent = isActive;
            const isLast = idx === arr.length - 1;

            return (
              <View key={key} className="flex-row" style={{ minHeight: isLast ? 36 : 56 }}>
                {/* Left: circle + connecting line */}
                <View className="items-center mr-3" style={{ width: 28 }}>
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: isCurrent ? 28 : 22,
                      height: isCurrent ? 28 : 22,
                      backgroundColor: isCompleted || isCurrent ? info.color : '#E5E7EB',
                      borderWidth: isCurrent ? 3 : 0,
                      borderColor: info.color + '55',
                    }}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={12} color="white" />
                    ) : (
                      <Ionicons name={info.icon as any} size={isCurrent ? 14 : 10} color={isCurrent ? 'white' : '#9CA3AF'} />
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={{
                        width: 2,
                        flex: 1,
                        backgroundColor: isCompleted ? info.color : '#E5E7EB',
                        marginTop: 4,
                        marginBottom: 4,
                      }}
                    />
                  )}
                </View>

                {/* Right: title + subtitle */}
                <View className="flex-1 pb-1" style={{ paddingTop: isCurrent ? 2 : 0 }}>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isCompleted || isCurrent ? '#1F2937' : '#9CA3AF' }}
                  >
                    {info.label}
                  </Text>
                  {isCurrent && (
                    <Text className="text-xs mt-0.5" style={{ color: info.color }}>
                      {isLast ? 'Completed' : 'Current Step'}
                    </Text>
                  )}
                  {!isCompleted && !isCurrent && (
                    <Text className="text-xs mt-0.5 text-gray-400">Pending</Text>
                  )}
                  {isCompleted && !isCurrent && (
                    <Text className="text-xs mt-0.5 text-gray-500">Done</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Delivery Info */}
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-2">Delivery Address</Text>
          <Text className="text-sm text-gray-700">{order.delivery_address}</Text>
          {order.notes && (
            <>
              <Text className="text-gray-900 font-bold text-sm mt-3 mb-1">Notes</Text>
              <Text className="text-sm text-gray-700">{order.notes}</Text>
            </>
          )}
          <Text className="text-gray-900 font-bold text-sm mt-3 mb-1">Branch</Text>
          <Text className="text-sm text-gray-700">{order.branch.name}</Text>
        </View>

        {/* Items */}
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-3">Items</Text>
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between items-center mb-2">
              <View className="flex-1">
                <Text className="text-sm text-gray-900" numberOfLines={1}>{item.product.name}</Text>
                <Text className="text-xs text-gray-500">x{item.quantity} @ ₱{Number(item.price).toFixed(2)}</Text>
              </View>
              <Text className="text-sm text-gray-900 font-medium">₱{Number(item.total).toFixed(2)}</Text>
            </View>
          ))}
          <View className="border-t border-gray-100 pt-3 mt-2">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Subtotal</Text>
              <Text className="text-sm text-gray-900">₱{Number(order.subtotal).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Delivery Fee</Text>
              <Text className="text-sm text-gray-900">₱{Number(order.delivery_fee).toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-gray-100 mt-1">
              <Text className="text-base font-bold text-gray-900">Total</Text>
              <Text className="text-base font-bold text-yellow-600">₱{Number(order.total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {canCancel && (
          <TouchableOpacity
            className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mb-4"
            onPress={cancelOrder}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            {cancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text className="text-red-500 font-semibold ml-2">Cancel Order</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
          <TouchableOpacity
            className="bg-yellow-400 rounded-xl py-3 items-center mb-4"
            onPress={() => router.push(`/Customer/RiderTracking?id=${order.id}`)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons name="locate" size={18} color="#78350F" />
              <Text className="text-yellow-900 font-bold ml-2">Track Your Order</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}