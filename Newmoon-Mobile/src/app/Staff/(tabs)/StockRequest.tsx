import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { cacheProducts, getCachedProducts } from '../../../../lib/dataCache';
import { hasNetworkConnection } from '../../../../lib/network';
import { COLORS, GRADIENT, CARD, getStatusColors } from '../../../lib/staffTheme';
import { LinearGradient } from 'expo-linear-gradient';

type StockRequest = {
  id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  user: {
    id: number;
    firstname: string;
    lastname: string;
  };
  product: {
    id: number;
    name: string;
    sku: string;
  };
  branch: {
    id: number;
    name: string;
  };
};

type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
};

type Branch = {
  id: number;
  name: string;
};

type Statistics = {
  total_requested: number;
  pending: number;
  approved: number;
  rejected: number;
  total_quantity_approved: number;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-800';
    case 'approved':
      return 'bg-green-900/30 text-green-400 border-green-800';
    case 'rejected':
      return 'bg-red-900/30 text-red-400 border-red-800';
    default:
      return 'bg-gray-800 text-gray-400 border-gray-700';
  }
};

const StockRequestScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch stock requests
  const { 
    data: requestsData, 
    isLoading: requestsLoading, 
    error: requestsError,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['stockRequests'],
    queryFn: () => api.get('/supply-requests'),
  });

  // Fetch products
  const { 
    data: productsData, 
    isLoading: productsLoading,
  } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const connected = await hasNetworkConnection();
      let responseData: any;

      if (connected) {
        try {
          const response = await api.get('/products');
          responseData = response.data;
          const productsArray = Array.isArray(responseData) ? responseData : (responseData?.data || []);
          await cacheProducts(productsArray);
        } catch (error) {
          responseData = await getCachedProducts<Product[]>();
          if (!responseData || responseData.length === 0) {
            console.warn('[StockRequest] No cached products available, returning empty array');
            return { data: [] };
          }
        }
      } else {
        responseData = await getCachedProducts<Product[]>();
        if (!responseData || responseData.length === 0) {
          console.warn('[StockRequest] No cached products while offline, returning empty array');
          return { data: [] };
        }
      }

      return { data: responseData };
    },
  });

  // Fetch statistics
  const { 
    data: statistics, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['supplyRequestStatistics'],
    queryFn: () => api.get('/supply-requests/statistics'),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { product_id: number; quantity: number; reason: string | null }) => {
      const response = await api.post('/supply-requests', data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Your supply request has been submitted');
      setShowRequestModal(false);
      setSelectedProduct(null);
      setRequestQuantity('');
      setRequestReason('');
      queryClient.invalidateQueries({ queryKey: ['supplyRequests'] });
      queryClient.invalidateQueries({ queryKey: ['supplyRequestStatistics'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to submit request';
      Alert.alert('Error', message);
    },
  });

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchRequests(),
        refetchStats(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchRequests, refetchStats]);

  const requests = requestsData?.data?.data || [];
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.data || []);
  const loading = requestsLoading || statsLoading || productsLoading;

  const handleSubmitRequest = async () => {
    const quantity = parseInt(requestQuantity);
    
    if (!selectedProduct) {
      Alert.alert('Validation Error', 'Please select a product');
      return;
    }

    if (!requestQuantity || isNaN(quantity) || quantity < 1) {
      Alert.alert('Validation Error', 'Please enter a valid quantity (minimum 1)');
      return;
    }

    if (quantity > 1000) {
      Alert.alert('Validation Error', 'Maximum request quantity is 1,000');
      return;
    }

    submitMutation.mutate({
      product_id: selectedProduct.id,
      quantity: quantity,
      reason: requestReason.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Loading Stock Requests...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.PRIMARY_RED]}
            tintColor={COLORS.PRIMARY_RED}
            title="Pull to refresh..."
            titleColor={COLORS.TEXT_MUTED}
          />
        }
      >
        {/* Header */}
        <LinearGradient colors={GRADIENT.HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 48, paddingBottom: 32, paddingHorizontal: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Inventory Management
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700' }}>Stock Requests</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>Request and track your stock requests</Text>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 9999 }}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Icon name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Statistics Cards */}
          {statistics?.data && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>Total Approved</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{statistics.data.total_quantity_approved}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>Pending</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{statistics.data.pending}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Request Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <TouchableOpacity
            onPress={() => setShowRequestModal(true)}
          >
            <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add-circle" size={24} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Request Stock</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Requests List */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 20, fontWeight: '700' }}>Your Requests</Text>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>{requests.length} request(s)</Text>
          </View>

          {requests.length === 0 ? (
            <View style={{ ...CARD, padding: 32, alignItems: 'center' }}>
              <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                <Icon name="inventory-2" size={40} color={COLORS.TEXT_SECONDARY} />
              </View>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '500', fontSize: 18 }}>No Requests Yet</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                Tap the button above to request stock
              </Text>
            </View>
          ) : (
            requests.map((request: StockRequest) => {
              const statusColors = getStatusColors(request.status);
              return (
                <View key={request.id} style={{ ...CARD, padding: 16, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
                        {request.product?.name || 'Unknown Product'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Quantity: {request.quantity}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Branch: {request.branch?.name || 'Unknown Branch'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Requested: {formatDate(request.requested_at)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: statusColors.bg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: statusColors.text + '30' }}>
                      <Text style={{ color: statusColors.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{request.status}</Text>
                    </View>
                  </View>

                  {request.reason && (
                    <View style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>{request.reason}</Text>
                    </View>
                  )}

                  {request.admin_notes && (
                    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Admin Note:</Text>
                      <Text style={{ color: '#15803D', fontSize: 12 }}>{request.admin_notes}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                    {request.status === 'approved' && request.approved_at && (
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Approved: {formatDate(request.approved_at)}
                      </Text>
                    )}
                    {request.status === 'rejected' && request.rejected_at && (
                      <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Rejected: {formatDate(request.rejected_at)}
                      </Text>
                    )}
                    {request.status === 'pending' && (
                      <Text style={{ color: COLORS.STATUS_PENDING_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Awaiting approval
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Info Section */}
        <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 24 }}>
          <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.CARD_BORDER }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Icon name="info" size={20} color={COLORS.PRIMARY_NAVY} />
              <Text style={{ color: COLORS.PRIMARY_NAVY, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Information</Text>
            </View>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, lineHeight: 20 }}>
              {'• Minimum request quantity: 1\n'}
              {'• Maximum request quantity: 1,000\n'}
              {'• Approved requests will create pending deliveries\n'}
              {'• Approval is subject to admin discretion'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => setShowRequestModal(false)}
          />
          <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 20 }}>Request Stock</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            {/* Product Selection */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Product</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, backgroundColor: COLORS.INPUT_BG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => setShowProductPicker(true)}
              >
                <Text style={{ color: selectedProduct ? COLORS.TEXT_PRIMARY : COLORS.TEXT_MUTED }}>
                  {selectedProduct ? selectedProduct.name : 'Select a product'}
                </Text>
                <Icon name="chevron-right" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Quantity</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, fontSize: 18, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Enter quantity"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="number-pad"
                value={requestQuantity}
                onChangeText={setRequestQuantity}
                editable={!submitMutation.isPending}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Min: 1 | Max: 1,000</Text>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Reason (Optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Why do you need this stock?"
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={requestReason}
                onChangeText={setRequestReason}
                editable={!submitMutation.isPending}
                maxLength={500}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Max 500 characters</Text>
            </View>

            <TouchableOpacity
              style={{ borderRadius: 12, padding: 16, alignItems: 'center', opacity: submitMutation.isPending ? 0.7 : 1 }}
              onPress={handleSubmitRequest}
              disabled={submitMutation.isPending}
            >
              <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 12, padding: 16, width: '100%', alignItems: 'center' }}>
                {submitMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Submit Request</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 12, borderRadius: 12, padding: 16, alignItems: 'center' }}
              onPress={() => setShowRequestModal(false)}
              disabled={submitMutation.isPending}
            >
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal
        visible={showProductPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => setShowProductPicker(false)}
          />
          <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%', borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 20 }}>Select Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {products.map((product: Product) => (
                <TouchableOpacity
                  key={product.id}
                  style={{ borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => {
                    setSelectedProduct(product);
                    setShowProductPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600', fontSize: 16 }}>{product.name}</Text>
                    <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>SKU: {product.sku}</Text>
                    <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12 }}>{product.category}</Text>
                  </View>
                  {selectedProduct?.id === product.id && (
                    <Icon name="check-circle" size={24} color={COLORS.PRIMARY_RED} />
                  )}
                </TouchableOpacity>
              ))}
              {products.length === 0 && (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.TEXT_SECONDARY }}>No products available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default StockRequestScreen;
