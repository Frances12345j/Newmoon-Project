import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
  Modal, StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useCart } from '../../../context/cartContext';
import { useAddress } from '../../../context/addressContext';
import api from '../../../lib/api';
import { Image } from 'react-native';

type PaymentMethod = 'cod' | 'gcash';

export default function CheckoutScreen() {
  const { items, branchId, subtotal, clearCart } = useCart();
  const { selectedAddress, openAddressModal } = useAddress();
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [submitting, setSubmitting] = useState(false);

  const [gcashModalVisible, setGcashModalVisible] = useState(false);
  const [gcashCheckoutUrl, setGcashCheckoutUrl] = useState('');
  const [gcashPolling, setGcashPolling] = useState(false);
  const [gcashWebViewLoading, setGcashWebViewLoading] = useState(true);
  const gcashSourceIdRef = useRef('');
  const gcashOrderIdRef = useRef('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  const getAddressText = () => {
    if (!selectedAddress) return '';
    return [selectedAddress.street, selectedAddress.barangay, selectedAddress.city, selectedAddress.province].filter(Boolean).join(', ');
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const handleGcashPayment = useCallback(async (orderId: number) => {
    try {
      const res = await api.post('/payment/gcash/create-source', { order_id: orderId });
      const { checkout_url, source_id } = res.data;

      if (!checkout_url) {
        Alert.alert('Error', 'Failed to get GCash checkout link.');
        return;
      }

      gcashSourceIdRef.current = source_id;
      gcashOrderIdRef.current = String(orderId);
      setGcashCheckoutUrl(checkout_url);
      setGcashModalVisible(true);
      setGcashWebViewLoading(true);

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get('/payment/gcash/check-status', {
            params: { source_id: gcashSourceIdRef.current },
          });
          const sourceStatus = statusRes.data.status;

          if (sourceStatus === 'chargeable' || sourceStatus === 'paid') {
            clearInterval(pollInterval);
            pollTimerRef.current = null;
            setGcashModalVisible(false);
            clearCart();
            router.replace(`/Customer/OrderDetail?id=${gcashOrderIdRef.current}`);
          } else if (sourceStatus === 'failed' || sourceStatus === 'cancelled') {
            clearInterval(pollInterval);
            pollTimerRef.current = null;
            setGcashModalVisible(false);
            Alert.alert('Payment Failed', 'GCash payment was not completed. You can still pay via Cash on Delivery or try again.');
          }
        } catch {
          // keep polling
        }
      }, 3000);

      pollTimerRef.current = pollInterval;

      setTimeout(() => {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setGcashModalVisible(false);
          clearCart();
          router.replace(`/Customer/OrderDetail?id=${gcashOrderIdRef.current}`);
        }
      }, 300000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to initiate GCash payment.';
      Alert.alert('GCash Error', msg);
    }
  }, [clearCart]);

  const placeOrder = async () => {
    const addrText = getAddressText();
    if (!addrText.trim()) {
      Alert.alert('Address Required', 'Please set a delivery address first.');
      return;
    }
    if (!branchId) {
      Alert.alert('Error', 'No branch selected. Go back and select a branch.');
      return;
    }

    setSubmitting(true);

    let deliveryLat: number | undefined = selectedAddress?.latitude ?? undefined;
    let deliveryLng: number | undefined = selectedAddress?.longitude ?? undefined;

    if (deliveryLat === undefined || deliveryLng === undefined) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          deliveryLat = loc.coords.latitude;
          deliveryLng = loc.coords.longitude;
        }
      } catch { }
    }

    try {
      const payload: Record<string, any> = {
        branch_id: branchId,
        items: items.map(i => ({
          product_id: i.productId,
          quantity: i.quantity,
          price: i.price,
        })),
        delivery_address: addrText,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      };
      if (deliveryLat !== undefined) {
        payload.delivery_latitude = deliveryLat;
        payload.delivery_longitude = deliveryLng;
      }

      const response = await api.post('/customer/orders', payload);
      const orderId = response.data.id;

      if (paymentMethod === 'gcash') {
        setSubmitting(false);
        await handleGcashPayment(orderId);
      } else {
        clearCart();
        router.replace(`/Customer/OrderDetail?id=${orderId}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to place order. Please try again.';
      Alert.alert('Order Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
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
          <Text className="text-xl font-bold text-gray-900 flex-1">Checkout</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <View className="flex-row items-center mb-2">
            <Ionicons name="location-outline" size={18} color="#F59E0B" />
            <Text className="text-gray-900 font-bold text-sm ml-2">Delivery Address</Text>
          </View>
          {selectedAddress ? (
            <TouchableOpacity onPress={openAddressModal} activeOpacity={0.7}>
              {selectedAddress.label && (
                <Text className="text-yellow-600 text-xs font-semibold">{selectedAddress.label}</Text>
              )}
              <Text className="text-gray-700 text-sm mt-0.5" numberOfLines={2}>
                {getAddressText()}
              </Text>
              {selectedAddress.latitude && selectedAddress.longitude && (
                <Text className="text-gray-400 text-xs mt-1">Coordinates set ✓</Text>
              )}
              <View className="flex-row items-center mt-2">
                <Ionicons name="create-outline" size={14} color="#F59E0B" />
                <Text className="text-yellow-600 text-xs font-medium ml-1">Change address</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openAddressModal} activeOpacity={0.7}>
              <Text className="text-gray-500 text-sm mt-1">No delivery address set</Text>
              <View className="flex-row items-center mt-2">
                <Ionicons name="add-circle-outline" size={14} color="#F59E0B" />
                <Text className="text-yellow-600 text-xs font-medium ml-1">Set delivery address</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-3">Order Summary</Text>
          {items.map((item) => (
            <View key={item.productId} className="flex-row justify-between items-center mb-2">
              <View className="flex-1">
                <Text className="text-sm text-gray-800" numberOfLines={1}>{item.name}</Text>
                <Text className="text-xs text-gray-500">x{item.quantity}</Text>
              </View>
              <Text className="text-sm text-gray-800 font-medium">
                ₱{(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View className="border-t border-gray-100 pt-3 mt-2">
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Subtotal</Text>
              <Text className="text-sm text-gray-800">₱{subtotal.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-sm text-gray-500">Delivery Fee</Text>
              <Text className="text-sm text-gray-800">₱{deliveryFee.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between pt-2 border-t border-gray-100 mt-1">
              <Text className="text-base font-bold text-gray-900">Total</Text>
              <Text className="text-base font-bold text-yellow-600">₱{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-3">Payment Method</Text>

          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-xl mb-2 border ${paymentMethod === 'cod' ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-gray-200'
              }`}
            onPress={() => setPaymentMethod('cod')}
            activeOpacity={0.7}
          >
            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${paymentMethod === 'cod' ? 'border-yellow-400' : 'border-gray-300'
              }`}>
              {paymentMethod === 'cod' && <View className="w-3 h-3 rounded-full bg-yellow-400" />}
            </View>
            <Ionicons name="cash-outline" size={22} color={paymentMethod === 'cod' ? '#F59E0B' : '#9CA3AF'} />
            <View className="ml-3">
              <Text className={`text-sm font-semibold ${paymentMethod === 'cod' ? 'text-gray-900' : 'text-gray-500'}`}>
                Cash on Delivery
              </Text>
              <Text className="text-xs text-gray-400">Pay when your order arrives</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row items-center p-3 rounded-xl border ${paymentMethod === 'gcash' ? 'bg-blue-50 border-blue-400' : 'bg-gray-50 border-gray-200'
              }`}
            onPress={() => setPaymentMethod('gcash')}
            activeOpacity={0.7}
          >
            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${paymentMethod === 'gcash' ? 'border-blue-500' : 'border-gray-300'
              }`}>
              {paymentMethod === 'gcash' && <View className="w-3 h-3 rounded-full bg-blue-500" />}
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', marginRight: 12, backgroundColor: '#007DFC', alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={require('../../../assets/images/GCash.jpeg')}
                style={{ width: 48, height: 48, borderRadius: 12 }}
                resizeMode="cover"
              />
            </View>
            <View className="ml-3">
              <Text className={`text-sm font-semibold ${paymentMethod === 'gcash' ? 'text-gray-900' : 'text-gray-500'}`}>
                GCash
              </Text>
              <Text className="text-xs text-gray-400">Pay securely with GCash via PayMongo</Text>
            </View>
          </TouchableOpacity>

          {paymentMethod === 'gcash' && (
            <View className="bg-blue-50 rounded-xl p-3 mt-3 border border-blue-200">
              <View className="flex-row items-start">
                <Ionicons name="information-circle-outline" size={16} color="#2563EB" style={{ marginTop: 1, marginRight: 6 }} />
                <Text className="text-blue-700 text-xs flex-1">
                  You will be redirected to the GCash checkout page after placing your order. Complete the payment to confirm your order.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm">
          <Text className="text-gray-900 font-bold text-sm mb-2">Order Notes (Optional)</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 text-sm border border-gray-200"
            placeholder="Special instructions..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View
        className="absolute left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3"
        style={{ bottom: 73, paddingBottom: 12 }}
      >
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${submitting ? 'bg-gray-300' : 'bg-yellow-400'}`}
          onPress={placeOrder}
          disabled={submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator color="#78350F" />
          ) : (
            <>
              <View className="flex-row items-center">
                <Text className="text-yellow-900 font-bold text-base mr-2">
                  {paymentMethod === 'cod' ? 'Place Order (COD)' : 'Pay with GCash'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#78350F" />
              </View>
              <Text className="text-yellow-800 text-xs mt-1">
                Total: ₱{total.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={gcashModalVisible}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Cancel Payment?',
            'Are you sure you want to cancel the GCash payment?',
            [
              { text: 'Continue Paying', style: 'cancel' },
              {
                text: 'Cancel',
                style: 'destructive',
                onPress: () => {
                  stopPolling();
                  setGcashModalVisible(false);
                  clearCart();
                  router.replace(`/Customer/OrderDetail?id=${gcashOrderIdRef.current}`);
                },
              },
            ]
          );
        }}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            <View className="flex-row items-center">
              <Image
                source={require('../../../assets/images/GCash.jpeg')}
                style={{ width: 32, height: 32, resizeMode: 'contain', marginRight: 8 }}
              />
              <Text className="text-base font-bold text-gray-900">GCash Payment</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Cancel Payment?',
                  'Are you sure you want to cancel?',
                  [
                    { text: 'Continue Paying', style: 'cancel' },
                    {
                      text: 'Cancel',
                      style: 'destructive',
                      onPress: () => {
                        stopPolling();
                        setGcashModalVisible(false);
                        clearCart();
                        router.replace(`/Customer/OrderDetail?id=${gcashOrderIdRef.current}`);
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          {gcashWebViewLoading && (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#0073E6" />
              <Text className="text-gray-500 mt-3 text-sm">Loading GCash checkout...</Text>
            </View>
          )}
          <WebView
            source={{ uri: gcashCheckoutUrl }}
            style={{ flex: 1 }}
            onLoadEnd={() => setGcashWebViewLoading(false)}
            onNavigationStateChange={(navState) => {
              const url = navState.url;
              if (url.includes('/payment/gcash/success')) {
                stopPolling();
                setGcashModalVisible(false);
                clearCart();
                router.replace(`/Customer/OrderDetail?id=${gcashOrderIdRef.current}`);
              } else if (url.includes('/payment/gcash/failed')) {
                stopPolling();
                setGcashModalVisible(false);
                Alert.alert('Payment Failed', 'GCash payment was not completed.');
              }
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}