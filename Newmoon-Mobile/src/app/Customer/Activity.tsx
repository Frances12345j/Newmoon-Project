import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../../lib/api';

interface RecentOrder {
  id: number;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  branch: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  preparing: '#8B5CF6',
  ready: '#10B981',
  out_for_delivery: '#10B981',
  delivered: '#059669',
  cancelled: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function ActivityScreen() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await api.get('/customer/orders?per_page=5');
      const data = Array.isArray(response.data?.data) ? response.data.data.slice(0, 5) : [];
      setOrders(data);
    } catch (err) {
      console.log('Failed to load recent orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOrders();
  }, [loadOrders]));

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View className="px-6 pt-12 pb-6" style={{ backgroundColor: '#FBBF24' }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-yellow-900/80 text-xs font-semibold tracking-wide uppercase mb-1">
              Recent Activity
            </Text>
            <Text className="text-yellow-900 text-2xl font-bold">Order History</Text>
          </View>
          <TouchableOpacity
            className="bg-white/30 p-2.5 rounded-full"
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#78350F" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center bg-gray-50">
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 bg-gray-50">
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="time-outline" size={40} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">No activity yet</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Your orders and updates will appear here
          </Text>
          <TouchableOpacity
            className="mt-6 bg-yellow-400 px-8 py-3 rounded-full"
            onPress={() => router.push('/Customer/Home')}
          >
            <Text className="text-yellow-900 font-semibold">Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4 bg-gray-50"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
        >
          {orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
              activeOpacity={0.7}
              onPress={() => router.push(`/Customer/OrderDetail?id=${order.id}`)}
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-bold text-gray-900">{order.order_number}</Text>
                <View className="px-3 py-0.5 rounded-full" style={{ backgroundColor: (STATUS_COLORS[order.status] || '#9CA3AF') + '20' }}>
                  <Text className="text-xs font-semibold" style={{ color: STATUS_COLORS[order.status] || '#9CA3AF' }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-gray-500 mb-2">{order.branch.name}</Text>
              <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                <Text className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
                <Text className="text-sm font-bold text-yellow-600">₱{Number(order.total).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}