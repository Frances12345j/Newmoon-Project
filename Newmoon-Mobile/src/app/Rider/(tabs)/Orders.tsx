import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';
import * as Location from 'expo-location';
import { useAuth } from '../../../../context/authContext';
import ProofOfDelivery from '../ProofOfDelivery';
import MapView, { Marker } from 'react-native-maps';

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

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
  customer_latitude?: number;
  customer_longitude?: number;
  items: OrderItem[] | string;
  total: string | number;
  status: OrderStatus;
  branch_name?: string;
  branch_address?: string;
  branch_latitude?: number;
  branch_longitude?: number;
  created_at: string;
  distance?: string;
  duration?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string; next?: OrderStatus[] }> = {
  pending:           { label: 'Pending',        color: '#F59E0B', icon: 'pending',        next: ['accepted'] },
  accepted:          { label: 'Accepted',       color: '#3B82F6', icon: 'handshake',      next: ['picked_up'] },
  preparing:         { label: 'Preparing',      color: '#8B5CF6', icon: 'restaurant',     next: ['ready'] },
  ready:             { label: 'Ready',          color: '#10B981', icon: 'check-circle',   next: ['picked_up'] },
  picked_up:         { label: 'Picked Up',      color: '#06B6D4', icon: 'local-shipping', next: ['out_for_delivery'] },
  out_for_delivery:  { label: 'Out for Delivery', color: '#F97316', icon: 'directions-bike', next: ['delivered'] },
  delivered:         { label: 'Delivered',       color: '#22C55E', icon: 'checkmark-circle', next: [] },
  cancelled:         { label: 'Cancelled',       color: '#EF4444', icon: 'cancel',        next: [] },
};

const STATUS_FLOW: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered'];

function getNextActions(status: OrderStatus): { label: string; nextStatus: OrderStatus; color: string }[] {
  const config = STATUS_CONFIG[status];
  if (!config?.next || config.next.length === 0) return [];
  return config.next.map((ns) => ({
    label: STATUS_CONFIG[ns].label,
    nextStatus: ns,
    color: STATUS_CONFIG[ns].color,
  }));
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for active orders
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // GPS tracking
  useEffect(() => {
    let watchSub: { remove: () => void } | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
        (loc) => setRiderLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
      );
    })();
    return () => watchSub?.remove();
  }, []);

  // Send location to backend
  useEffect(() => {
    if (!riderLocation) return;
    const interval = setInterval(async () => {
      try {
        const activeOrders = orders.filter((o) =>
          ['accepted', 'picked_up', 'out_for_delivery'].includes(o.status)
        );
        for (const order of activeOrders) {
          await api.post(`/rider/orders/${order.id}/location`, {
            latitude: riderLocation.lat,
            longitude: riderLocation.lng,
          }).catch(() => {});
        }
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [riderLocation, orders]);

  // Fetch orders with polling
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
    const interval = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

  const handleStatusAction = async (order: Order, nextStatus: OrderStatus) => {
    if (nextStatus === 'delivered') {
      setProofOrder(order);
      setShowActionModal(false);
      setShowProofModal(true);
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/rider/orders/${order.id}/status`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
      setShowActionModal(false);
      setActionOrder(null);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update order status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProofSubmit = () => {
    setShowProofModal(false);
    setProofOrder(null);
    setActionOrder(null);
    fetchOrders();
  };

  const handleProofCancel = () => {
    setShowProofModal(false);
    setProofOrder(null);
  };

  const openNavigation = (lat?: number, lng?: number, label?: string) => {
    if (!lat || !lng) {
      Alert.alert('Location Unavailable', 'No location data for this order');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigate', `${label || 'Destination'}\n${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });
  };

  const getProgress = (status: OrderStatus): number => {
    const idx = STATUS_FLOW.indexOf(status);
    return idx >= 0 ? (idx / (STATUS_FLOW.length - 1)) * 100 : 0;
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderOrderCard = (order: Order) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const actions = getNextActions(order.status);
    const progress = getProgress(order.status);
    const isActive = !['delivered', 'cancelled'].includes(order.status);

    return (
      <TouchableOpacity
        key={order.id}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
        activeOpacity={0.7}
        onPress={() => {
          setActionOrder(order);
          setShowActionModal(true);
        }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1">
            <View className="bg-yellow-50 p-2 rounded-xl mr-2 border border-yellow-200">
              <MaterialIcons name="receipt" size={16} color="#F59E0B" />
            </View>
            <Text className="text-sm font-bold text-gray-900">{order.order_number}</Text>
          </View>
          <View className="px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: config.color + '15' }}>
            <MaterialIcons name={config.icon as any} size={12} color={config.color} style={{ marginRight: 4 }} />
            <Text className="text-xs font-medium" style={{ color: config.color }}>{config.label}</Text>
          </View>
        </View>

        {/* Progress bar */}
        {isActive && (
          <View className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <View
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: config.color,
                borderRadius: 4,
              }}
            />
          </View>
        )}

        {/* Customer + Address */}
        <View className="mb-2">
          <View className="flex-row items-center mb-1">
            <Ionicons name="person-outline" size={15} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text className="text-base font-semibold text-gray-900">{order.customer_name}</Text>
          </View>
          <View className="flex-row items-start">
            <Ionicons name="location-outline" size={15} color="#9CA3AF" style={{ marginRight: 8, marginTop: 1 }} />
            <View className="flex-1">
              <Text className="text-xs text-gray-400 font-medium">Delivery Address</Text>
              <Text className="text-xs text-gray-600">{order.customer_address}</Text>
            </View>
          </View>
        </View>

        {/* Branch */}
        {order.branch_name && (
          <View className="flex-row items-center mb-2">
            <Ionicons name="storefront-outline" size={13} color="#6B7280" style={{ marginRight: 8 }} />
            <Text className="text-xs text-gray-500">{order.branch_name}</Text>
          </View>
        )}

        {/* Items */}
        <View className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
          <View className="flex-row items-center">
            <Ionicons name="fast-food-outline" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
            <Text className="text-xs text-gray-700 flex-1" numberOfLines={2}>
              {typeof order.items === 'string'
                ? order.items
                : Array.isArray(order.items)
                  ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                  : 'Items'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={13} color="#6B7280" style={{ marginRight: 6 }} />
            <Text className="text-xs text-gray-500">{formatTime(order.created_at)}</Text>
            {order.distance && (
              <>
                <Text className="text-gray-300 mx-1">|</Text>
                <Ionicons name="navigate-outline" size={12} color="#6B7280" style={{ marginRight: 4 }} />
                <Text className="text-xs text-gray-500">{order.distance}</Text>
              </>
            )}
          </View>
          <View className="flex-row items-center bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
            <Text className="text-sm font-bold text-yellow-600">
              ₱{Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {isActive && actions.length > 0 && (
          <View className="flex-row gap-2 mt-3 pt-3 border-t border-gray-100">
            {actions.map((action) => (
              <TouchableOpacity
                key={action.nextStatus}
                className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center"
                style={{ backgroundColor: action.color + '15' }}
                onPress={() => handleStatusAction(order, action.nextStatus)}
                activeOpacity={0.7}
              >
                <Text className="text-xs font-bold" style={{ color: action.color }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="py-2.5 px-3 rounded-xl items-center justify-center"
              style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}
              onPress={() => router.push('/Rider/Maps')}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate" size={16} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Delivered timestamp */}
        {order.status === 'delivered' && (
          <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
            <Ionicons name="checkmark-circle" size={14} color="#22C55E" style={{ marginRight: 6 }} />
            <Text className="text-xs text-gray-500">Delivered</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text className="text-gray-500 mt-3 text-sm">Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1">Orders</Text>
          <View className="bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-xl flex-row items-center">
            {riderLocation && <View className="w-2 h-2 rounded-full bg-yellow-400 mr-2" style={{ opacity: 0.8 }} />}
            <Text className="text-yellow-600 text-xs font-medium">
              {activeOrders.length} Active
            </Text>
          </View>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView
        className="flex-1 px-4 pt-4 bg-gray-50"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true)}
            tintColor="#F59E0B"
            colors={['#F59E0B']}
          />
        }
      >
        {activeOrders.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="bg-gray-100 w-20 h-20 rounded-full items-center justify-center mb-4">
              <Ionicons name="cart-outline" size={36} color="#9CA3AF" />
            </View>
            <Text className="text-gray-900 text-lg font-bold mb-1">No Active Orders</Text>
            <Text className="text-gray-500 text-sm text-center">New orders will appear here automatically</Text>
          </View>
        ) : (
          activeOrders.map(renderOrderCard)
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowActionModal(false); setActionOrder(null); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => { setShowActionModal(false); setActionOrder(null); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
          >
            {actionOrder && (
              <>
                <View className="items-center mb-4">
                  <View className="w-12 h-1 bg-gray-200 rounded-full mb-4" />
                  <Text className="text-lg font-bold text-gray-900 text-center">{actionOrder.order_number}</Text>
                  <Text className="text-gray-500 text-sm mt-1">{actionOrder.customer_name}</Text>
                </View>

                <View className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Current Status</Text>
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: STATUS_CONFIG[actionOrder.status]?.color + '20' }}>
                      <Text className="text-xs font-bold" style={{ color: STATUS_CONFIG[actionOrder.status]?.color }}>
                        {STATUS_CONFIG[actionOrder.status]?.label}
                      </Text>
                    </View>
                  </View>

                  {/* Flow steps */}
                  <View className="flex-row items-center justify-between py-2">
                    {STATUS_FLOW.filter((s) => s !== 'cancelled').map((step, idx) => {
                      const currentIdx = STATUS_FLOW.indexOf(actionOrder.status);
                      const stepIdx = STATUS_FLOW.indexOf(step);
                      const isComplete = stepIdx <= currentIdx;
                      const isCurrent = step === actionOrder.status;
                      return (
                        <View key={step} className="items-center" style={{ flex: 1 }}>
                          <View
                            className={`w-8 h-8 rounded-full items-center justify-center ${
                              isCurrent ? 'bg-yellow-400' : isComplete ? 'bg-yellow-100' : 'bg-gray-200'
                            }`}
                          >
                            <Ionicons
                              name={isCurrent ? 'ellipse' : isComplete ? 'checkmark' : 'ellipse-outline'}
                              size={isCurrent ? 8 : 14}
                              color={isComplete ? '#F59E0B' : '#9CA3AF'}
                            />
                          </View>
                          {idx < STATUS_FLOW.length - 2 && (
                            <View
                              style={{
                                position: 'absolute',
                                top: 14,
                                left: '55%',
                                right: '-55%',
                                height: 2,
                                backgroundColor: isComplete ? '#F59E0B' : '#E5E7EB',
                              }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Navigation */}
                {(actionOrder.customer_latitude || actionOrder.branch_latitude) && (
                  <TouchableOpacity
                    className="bg-gray-50 rounded-xl py-3 items-center flex-row justify-center mb-4 border border-gray-100"
                    onPress={() => router.push('/Rider/Maps')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="map-outline" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                    <Text className="text-yellow-600 text-sm font-bold">View on Map</Text>
                  </TouchableOpacity>
                )}

                {/* Map: show route from branch to customer when on delivery */}
                {actionOrder.branch_latitude != null && actionOrder.branch_longitude != null && actionOrder.customer_latitude != null && actionOrder.customer_longitude != null && (
                  <View className="h-44 rounded-xl overflow-hidden mb-4 border border-gray-100">
                    <MapView
                      style={{ flex: 1 }}
                      initialRegion={{
                        latitude: (actionOrder.branch_latitude + actionOrder.customer_latitude) / 2,
                        longitude: (actionOrder.branch_longitude + actionOrder.customer_longitude) / 2,
                        latitudeDelta: Math.abs(actionOrder.branch_latitude - actionOrder.customer_latitude) * 2 + 0.02,
                        longitudeDelta: Math.abs(actionOrder.branch_longitude - actionOrder.customer_longitude) * 2 + 0.02,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: actionOrder.branch_latitude, longitude: actionOrder.branch_longitude }}
                        title={actionOrder.branch_name || 'Branch'}
                        pinColor="#F59E0B"
                      />
                      <Marker
                        coordinate={{ latitude: actionOrder.customer_latitude, longitude: actionOrder.customer_longitude }}
                        title={actionOrder.customer_name}
                        pinColor="#8B5CF6"
                      />
                    </MapView>
                  </View>
                )}

                {/* Actions */}
                {getNextActions(actionOrder.status).length > 0 && (
                  <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3 ml-1">Update Status</Text>
                )}
                {getNextActions(actionOrder.status).map((action) => (
                  <TouchableOpacity
                    key={action.nextStatus}
                    className="py-4 rounded-xl items-center mb-2"
                    style={{ backgroundColor: action.color + '15' }}
                    onPress={() => handleStatusAction(actionOrder!, action.nextStatus)}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color={action.color} size="small" />
                    ) : (
                      <Text className="font-bold text-base" style={{ color: action.color }}>
                        {action.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  className="py-3 rounded-xl items-center mt-1"
                  onPress={() => { setShowActionModal(false); setActionOrder(null); }}
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-400 text-sm font-semibold">Close</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Proof of Delivery — always mounted, Modal handles visibility */}
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