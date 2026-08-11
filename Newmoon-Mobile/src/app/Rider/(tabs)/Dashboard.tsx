import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../../context/authContext';
import * as Location from 'expo-location';
import api from '../../../../lib/api';

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  status: string;
  total: string | number;
  created_at: string;
  distance?: string;
}

export default function RiderDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ today_deliveries: 0, today_earnings: 0, active_orders: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [gpsActive, setGpsActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 30000, distanceInterval: 50 },
        () => setGpsActive(true),
      );
      setGpsActive(true);
      return () => sub.remove();
    })();
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const ordersRes = await api.get('/rider/orders?per_page=50').catch(() => ({ data: { data: [] } }));
      const orders = Array.isArray(ordersRes.data?.data) ? ordersRes.data.data : [];
      setRecentOrders(orders.slice(0, 5));
      setStats({
        today_deliveries: orders.filter((o: Order) => o.status === 'delivered').length,
        today_earnings: orders.filter((o: Order) => o.status === 'delivered').reduce((sum: number, o: Order) => sum + Number(o.total || 0), 0),
        active_orders: orders.filter((o: Order) => !['delivered', 'cancelled'].includes(o.status)).length,
      });
    } catch {
      setStats({ today_deliveries: 0, today_earnings: 0, active_orders: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await signOut();
          router.replace('/Login');
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      delivered: '#22C55E', pending: '#F59E0B', accepted: '#3B82F6',
      preparing: '#8B5CF6', ready: '#10B981', picked_up: '#06B6D4',
      out_for_delivery: '#F97316', cancelled: '#EF4444',
    };
    return map[status] || '#9CA3AF';
  };

  const activeCount = recentOrders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;

  const displayName = user?.firstname?.trim() || user?.username || 'Rider';
  const userInitial = displayName.charAt(0).toUpperCase();

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 mt-3 text-sm">Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#F59E0B" colors={['#F59E0B']} />
        }
      >
        {/* Header - Yellow */}
        <View className="bg-[#fbbf24] pt-12 pb-6 px-6 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text className="text-yellow-900/80 text-xs font-medium tracking-wider uppercase">
                Welcome Back
              </Text>
              <Text className="text-yellow-900 text-3xl font-bold mt-0.5">
                {displayName} 👋
              </Text>
              <Text className="text-yellow-900/70 text-sm mt-1">
                New Moon Lechon Rider Portal
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-white items-center justify-center"
                onPress={() => router.push('/Rider/Profile' as unknown as any)}
              >
                <Text className="text-yellow-900 font-bold text-xl">
                  {userInitial}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-white items-center justify-center"
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color="#78350F" />
              </TouchableOpacity>
            </View>
          </View>

          {/* GPS + Active Status */}
          <View className="flex-row gap-3 mb-4">
            <Animated.View
              className="flex-row items-center bg-white/40 px-4 py-2.5 rounded-xl"
              style={{ opacity: pulseAnim }}
            >
              <View className={`w-2.5 h-2.5 rounded-full ${gpsActive ? 'bg-green-500' : 'bg-gray-400'} mr-2.5`} />
              <Text className="text-yellow-900 text-xs font-bold tracking-wide uppercase">
                {gpsActive ? 'GPS Active' : 'GPS Off'}
              </Text>
            </Animated.View>
            <View className="flex-row items-center bg-white/40 px-4 py-2.5 rounded-xl">
              <MaterialIcons name="directions-bike" size={16} color="#78350F" style={{ marginRight: 6 }} />
              <Text className="text-yellow-900 text-xs font-bold">{activeCount} Active</Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white rounded-2xl p-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-yellow-50 p-2 rounded-lg mr-2">
                  <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
                </View>
                <Text className="text-gray-500 text-xs uppercase tracking-wider font-medium">Delivered</Text>
              </View>
              <Text className="text-gray-900 text-3xl font-bold">{stats.today_deliveries}</Text>
              <Text className="text-gray-400 text-xs mt-1">Today</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-blue-50 p-2 rounded-lg mr-2">
                  <Ionicons name="bicycle" size={16} color="#3B82F6" />
                </View>
                <Text className="text-gray-500 text-xs uppercase tracking-wider font-medium">Active</Text>
              </View>
              <Text className="text-gray-900 text-3xl font-bold">{stats.active_orders}</Text>
              <Text className="text-gray-400 text-xs mt-1">Orders</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-orange-50 p-2 rounded-lg mr-2">
                  <Ionicons name="wallet-outline" size={16} color="#F97316" />
                </View>
                <Text className="text-gray-500 text-xs uppercase tracking-wider font-medium">Earnings</Text>
              </View>
              <Text className="text-gray-900 text-3xl font-bold">{formatCurrency(stats.today_earnings)}</Text>
              <Text className="text-gray-400 text-xs mt-1">Today</Text>
            </View>
          </View>
        </View>

        {/* Active Orders */}
        {activeCount > 0 && (
          <View className="px-6 mt-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-900 text-base font-bold">Active Orders</Text>
              <TouchableOpacity onPress={() => router.push('/Rider/Orders')}>
                <Text className="text-yellow-600 text-xs font-semibold">View All</Text>
              </TouchableOpacity>
            </View>
            {recentOrders
              .filter((o) => !['delivered', 'cancelled'].includes(o.status))
              .slice(0, 3)
              .map((order) => (
                <TouchableOpacity
                  key={order.id}
                  className="bg-white rounded-xl p-4 mb-2 border border-gray-100 shadow-sm"
                  onPress={() => router.push('/Rider/Orders')}
                  activeOpacity={0.7}
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-gray-900 font-bold text-sm">{order.order_number}</Text>
                    <View className="px-2.5 py-0.5 rounded-full" style={{ backgroundColor: getStatusColor(order.status) + '20' }}>
                      <Text className="text-xs font-medium" style={{ color: getStatusColor(order.status) }}>{order.status.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-600 text-sm">{order.customer_name}</Text>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="location-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
                    <Text className="text-gray-400 text-xs flex-1" numberOfLines={1}>{order.customer_address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* Recent Deliveries */}
        <View className="px-6 mt-6 mb-8">
          <Text className="text-gray-900 text-base font-bold mb-3">Recent Deliveries</Text>
          {recentOrders.filter((o) => ['delivered'].includes(o.status)).length === 0 ? (
            <View className="bg-white rounded-xl p-6 border border-gray-100 items-center shadow-sm">
              <Ionicons name="time-outline" size={32} color="#D1D5DB" />
              <Text className="text-gray-400 text-sm mt-2">No deliveries yet today</Text>
            </View>
          ) : (
            recentOrders
              .filter((o) => ['delivered'].includes(o.status))
              .slice(0, 5)
              .map((order) => (
                <View key={order.id} className="bg-white rounded-xl p-3.5 mb-2 border border-gray-100 shadow-sm flex-row items-center">
                  <View className="bg-green-50 p-2 rounded-lg mr-3">
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 text-sm font-semibold">{order.order_number}</Text>
                    <Text className="text-gray-500 text-xs">{order.customer_name}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-green-600 text-xs font-bold">
                      {formatCurrency(Number(order.total))}
                    </Text>
                    <Text className="text-gray-400 text-xs">{formatTime(order.created_at)}</Text>
                  </View>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
