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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';
import { COLORS, GRADIENT, CARD } from '../../../lib/staffTheme';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  items: OrderItem[] | string;
  total: string | number;
  status: OrderStatus;
  branch_name?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; next?: OrderStatus[] }> = {
  pending:    { label: 'Pending',      color: COLORS.STATUS_PENDING_TEXT, bg: COLORS.STATUS_PENDING_BG, next: ['confirmed'] },
  confirmed:  { label: 'Confirmed',    color: COLORS.STATUS_INFO_TEXT,    bg: COLORS.STATUS_INFO_BG,    next: ['preparing'] },
  preparing:  { label: 'Preparing',    color: '#7C3AED',                  bg: '#EDE9FE',                next: ['ready'] },
  ready:      { label: 'Ready',        color: COLORS.STATUS_APPROVED_TEXT,bg: COLORS.STATUS_APPROVED_BG, next: [] },
  picked_up:  { label: 'Picked Up',    color: '#0891B2',                  bg: '#CFFAFE',                 next: [] },
  delivered:  { label: 'Delivered',    color: COLORS.STATUS_APPROVED_TEXT,bg: COLORS.STATUS_APPROVED_BG, next: [] },
  cancelled:  { label: 'Cancelled',    color: COLORS.STATUS_REJECTED_TEXT,bg: COLORS.STATUS_REJECTED_BG, next: [] },
};

const MANAGED_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

function getNextActions(status: OrderStatus): { label: string; nextStatus: OrderStatus; color: string }[] {
  const config = STATUS_CONFIG[status];
  if (!config?.next || config.next.length === 0) return [];
  return config.next.map((ns) => ({
    label: STATUS_CONFIG[ns].label,
    nextStatus: ns,
    color: STATUS_CONFIG[ns].color,
  }));
}

export default function StaffOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');

  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await api.get('/staff/orders?per_page=50');
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
    const interval = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusAction = async (order: Order, nextStatus: OrderStatus) => {
    try {
      await api.post(`/staff/orders/${order.id}/status`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update order status');
    }
  };

  const activeOrders = orders.filter((o) => MANAGED_STATUSES.includes(o.status));
  const completedOrders = orders.filter((o) => !MANAGED_STATUSES.includes(o.status));

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderOrderCard = (order: Order) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const actions = getNextActions(order.status);
    const isActive = MANAGED_STATUSES.includes(order.status);

    return (
      <View key={order.id} style={[CARD, { padding: 16, marginBottom: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ backgroundColor: COLORS.STATUS_INFO_BG, padding: 8, borderRadius: 12, marginRight: 8 }}>
              <MaterialIcons name="receipt" size={16} color={COLORS.STATUS_INFO_TEXT} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT_PRIMARY }}>{order.order_number}</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: config.bg }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: config.color }}>{config.label}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="person-outline" size={15} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.TEXT_PRIMARY }}>{order.customer_name}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="location-outline" size={15} color={COLORS.TEXT_MUTED} style={{ marginRight: 8, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Delivery Address</Text>
              <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }}>{order.customer_address}</Text>
            </View>
          </View>
        </View>

        {order.branch_name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="storefront-outline" size={13} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }}>{order.branch_name}</Text>
          </View>
        )}

        <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="fast-food-outline" size={14} color={COLORS.TEXT_SECONDARY} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12, color: COLORS.TEXT_PRIMARY, flex: 1 }} numberOfLines={2}>
              {typeof order.items === 'string'
                ? order.items
                : Array.isArray(order.items)
                  ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                  : 'Items'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={13} color={COLORS.TEXT_MUTED} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: COLORS.TEXT_SECONDARY }}>{formatTime(order.created_at)}</Text>
          </View>
          <View style={{ backgroundColor: COLORS.STATUS_APPROVED_BG, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.STATUS_APPROVED_TEXT }}>₱{Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {isActive && actions.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.nextStatus}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: action.color + '15', borderWidth: 1, borderColor: action.color + '30' }}
                onPress={() => handleStatusAction(order, action.nextStatus)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: action.color, textAlign: 'center' }}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
          <Text style={{ color: COLORS.TEXT_SECONDARY, marginTop: 12, fontSize: 14 }}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
      {/* Header */}
      <LinearGradient colors={GRADIENT.PRIMARY} style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF', flex: 1 }}>Orders</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{activeOrders.length} Active</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 4 }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedTab === 'active' ? '#FFFFFF' : 'transparent', alignItems: 'center' }}
            onPress={() => setSelectedTab('active')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: selectedTab === 'active' ? COLORS.PRIMARY_RED : 'rgba(255,255,255,0.7)' }}>
              Active ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedTab === 'completed' ? '#FFFFFF' : 'transparent', alignItems: 'center' }}
            onPress={() => setSelectedTab('completed')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: selectedTab === 'completed' ? COLORS.PRIMARY_RED : 'rgba(255,255,255,0.7)' }}>
              Completed ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} tintColor={COLORS.PRIMARY_RED} colors={[COLORS.PRIMARY_RED]} />
        }
      >
        {(selectedTab === 'active' ? activeOrders : completedOrders).length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="receipt-outline" size={36} color={COLORS.TEXT_MUTED} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 4 }}>
              {selectedTab === 'active' ? 'No Active Orders' : 'No Completed Orders'}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center' }}>
              {selectedTab === 'active' ? 'New orders from customers will appear here' : 'Completed orders will appear here'}
            </Text>
          </View>
        ) : (
          (selectedTab === 'active' ? activeOrders : completedOrders).map(renderOrderCard)
        )}
        <View style={{ height: 96 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
