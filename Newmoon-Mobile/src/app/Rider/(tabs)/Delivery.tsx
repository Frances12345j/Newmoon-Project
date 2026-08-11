import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';
import ProofOfDelivery from '../ProofOfDelivery';

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  status: string;
  total: string | number;
  created_at: string;
  branch_name?: string;
  distance?: string;
  duration?: string;
}

export default function DeliveryScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'completed'>('pending');
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await api.get('/rider/orders?per_page=50');
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setOrders(data);
    } catch {
      if (!isRefresh) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(), 20000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const pendingProof = orders.filter((o) => o.status === 'out_for_delivery');
  const proofCompleted = orders.filter((o) => o.status === 'delivered');

  const handleProofSubmit = () => {
    setShowProofModal(false);
    setProofOrder(null);
    fetchOrders();
  };

  const handleProofCancel = () => {
    setShowProofModal(false);
    setProofOrder(null);
  };

  const formatCurrency = (amount: number | string) =>
    `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderPendingCard = (order: Order) => (
    <TouchableOpacity
      key={order.id}
      className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
      activeOpacity={0.7}
      onPress={() => {
        setProofOrder(order);
        setShowProofModal(true);
      }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center flex-1">
          <View className="bg-orange-50 p-2 rounded-xl mr-2 border border-orange-200">
            <MaterialIcons name="directions-bike" size={16} color="#F97316" />
          </View>
          <Text className="text-sm font-bold text-gray-900">{order.order_number}</Text>
        </View>
        <View className="bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
          <Text className="text-xs font-medium text-orange-600">Proof Needed</Text>
        </View>
      </View>

      <View className="mb-2">
        <View className="flex-row items-center mb-1">
          <Ionicons name="person-outline" size={15} color="#9CA3AF" style={{ marginRight: 8 }} />
          <Text className="text-base font-semibold text-gray-900">{order.customer_name}</Text>
        </View>
        <View className="flex-row items-start">
          <Ionicons name="location-outline" size={15} color="#9CA3AF" style={{ marginRight: 8, marginTop: 1 }} />
          <Text className="text-xs text-gray-500 flex-1">{order.customer_address}</Text>
        </View>
      </View>

      {order.branch_name && (
        <View className="flex-row items-center mb-2">
          <Ionicons name="storefront-outline" size={13} color="#6B7280" style={{ marginRight: 8 }} />
          <Text className="text-xs text-gray-500">{order.branch_name}</Text>
        </View>
      )}

      <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={13} color="#6B7280" style={{ marginRight: 6 }} />
          <Text className="text-xs text-gray-500">{formatTime(order.created_at)}</Text>
        </View>
        <View className="bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
          <Text className="text-sm font-bold text-yellow-600">{formatCurrency(order.total)}</Text>
        </View>
      </View>

      <View className="mt-3 pt-3 border-t border-gray-100">
        <TouchableOpacity
          className="bg-yellow-400 py-3 rounded-xl items-center flex-row justify-center"
          onPress={() => {
            setProofOrder(order);
            setShowProofModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={18} color="#78350F" style={{ marginRight: 8 }} />
          <Text className="text-yellow-900 font-bold text-sm">Take Proof of Delivery</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderCompletedCard = (order: Order) => (
    <View key={order.id} className="bg-white rounded-xl p-4 mb-2 border border-gray-100 shadow-sm flex-row items-center">
      <View className="bg-green-50 p-2 rounded-lg mr-3 border border-green-200">
        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 text-sm font-semibold">{order.order_number}</Text>
        <Text className="text-gray-500 text-xs">{order.customer_name}</Text>
      </View>
      <Text className="text-green-600 text-xs font-bold">{formatCurrency(order.total)}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text className="text-gray-500 mt-3 text-sm">Loading deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="bg-yellow-50 p-2 rounded-xl mr-3 border border-yellow-200">
            <MaterialIcons name="verified" size={22} color="#F59E0B" />
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-900">Delivery Proof</Text>
            <Text className="text-gray-500 text-xs mt-0.5">
              {pendingProof.length} pending confirmation
            </Text>
          </View>
        </View>

        <View className="flex-row mt-3 bg-gray-100 rounded-xl p-1">
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-lg items-center ${selectedTab === 'pending' ? 'bg-yellow-400' : ''}`}
            onPress={() => setSelectedTab('pending')}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-semibold ${selectedTab === 'pending' ? 'text-yellow-900' : 'text-gray-500'}`}>
              Pending ({pendingProof.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2.5 rounded-lg items-center ${selectedTab === 'completed' ? 'bg-yellow-400' : ''}`}
            onPress={() => setSelectedTab('completed')}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-semibold ${selectedTab === 'completed' ? 'text-yellow-900' : 'text-gray-500'}`}>
              Completed ({proofCompleted.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <ScrollView
        className="flex-1 px-4 pt-4 bg-gray-50"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} tintColor="#F59E0B" colors={['#F59E0B']} />
        }
      >
        {selectedTab === 'pending' ? (
          pendingProof.length === 0 ? (
            <View className="items-center justify-center py-20">
              <View className="bg-gray-100 w-20 h-20 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkmark-circle-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-gray-900 text-lg font-bold mb-1">All Clear!</Text>
              <Text className="text-gray-500 text-sm text-center">
                No deliveries pending proof of confirmation
              </Text>
            </View>
          ) : (
            pendingProof.map(renderPendingCard)
          )
        ) : (
          proofCompleted.length === 0 ? (
            <View className="items-center justify-center py-20">
              <View className="bg-gray-100 w-20 h-20 rounded-full items-center justify-center mb-4">
                <Ionicons name="time-outline" size={36} color="#9CA3AF" />
              </View>
              <Text className="text-gray-900 text-lg font-bold mb-1">No Completions Yet</Text>
              <Text className="text-gray-500 text-sm text-center">
                Completed deliveries with proof will appear here
              </Text>
            </View>
          ) : (
            proofCompleted.map(renderCompletedCard)
          )
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Proof of Delivery Modal */}
      <ProofOfDelivery
        visible={showProofModal}
        orderId={proofOrder?.id ?? 0}
        orderNumber={proofOrder?.order_number ?? ''}
        customerName={proofOrder?.customer_name ?? ''}
        onSubmit={handleProofSubmit}
        onCancel={handleProofCancel}
      />
    </SafeAreaView>
  );
}