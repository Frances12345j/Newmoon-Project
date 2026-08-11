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
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { COLORS, GRADIENT, CARD, getStatusColors } from '../../../lib/staffTheme';

type PullOut = {
  id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  pulled_out_at: string;
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
  total_pulled_out: number;
  total_quantity: number;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const PullOutScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch pull-outs
  const { 
    data: pullOutsData, 
    isLoading: pullOutsLoading, 
    error: pullOutsError,
    refetch: refetchPullOuts,
  } = useQuery({
    queryKey: ['pullOuts'],
    queryFn: () => api.get('/pull-outs'),
  });

  // Fetch products
  const { 
    data: productsData, 
    isLoading: productsLoading,
  } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.get('/products');
      return { data: response.data?.data ?? [] };
    },
  });

  // Fetch statistics
  const { 
    data: statistics, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['pullOutStatistics'],
    queryFn: () => api.get('/pull-outs/statistics'),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { product_id: number; quantity: number; notes: string | null }) => {
      const response = await api.post('/pull-outs', data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Product has been pulled out from inventory');
      setShowRequestModal(false);
      setSelectedProduct(null);
      setRequestQuantity('');
      setRequestNotes('');
      queryClient.invalidateQueries({ queryKey: ['pullOuts'] });
      queryClient.invalidateQueries({ queryKey: ['pullOutStatistics'] });
    },
    onError: (error: any) => {
      console.error('Pull-out error:', error);
      console.error('Error response:', error?.response);
      console.error('Error data:', error?.response?.data);
      
      let message = 'Failed to pull out product';
      
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (error?.response?.data?.error) {
        message = error.response.data.error;
      } else if (error?.message) {
        message = error.message;
      }
      
      // Add validation errors if present
      if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages = Object.values(errors).flat();
        if (errorMessages.length > 0) {
          message = errorMessages.join(', ');
        }
      }
      
      Alert.alert('Error', message);
    },
  });

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPullOuts(),
        refetchStats(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchPullOuts, refetchStats]);

  const pullOuts = Array.isArray(pullOutsData?.data?.data) ? pullOutsData.data.data : [];
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.data || []);
  const loading = pullOutsLoading || statsLoading || productsLoading;

  const handleSubmitRequest = async () => {
    const quantity = parseFloat(requestQuantity);
    
    if (!selectedProduct) {
      Alert.alert('Validation Error', 'Please select a product');
      return;
    }

    if (!requestQuantity || isNaN(quantity) || quantity < 0.01) {
      Alert.alert('Validation Error', 'Please enter a valid quantity (minimum 0.01)');
      return;
    }

    if (quantity > 1000) {
      Alert.alert('Validation Error', 'Maximum pull-out quantity is 1,000');
      return;
    }

    submitMutation.mutate({
      product_id: selectedProduct.id,
      quantity: quantity,
      notes: requestNotes.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Loading Pull-Outs...</Text>
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
        {/* Header - FoodMeal gradient */}
        <LinearGradient colors={GRADIENT.HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 48, paddingBottom: 32, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          {/* Decorative circles */}
          <View style={{ position: 'absolute', top: -20, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <View style={{ position: 'absolute', bottom: 10, left: -40, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <View style={{ position: 'absolute', top: 60, right: 100, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.07)' }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Inventory Management
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700' }}>Pull-Outs</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>Remove unsuitable products from inventory</Text>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 50 }}
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
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Pulled Out</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>{statistics.data.total_quantity}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Records</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>{statistics.data.total_pulled_out}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Pull Out Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <TouchableOpacity
            style={{ borderRadius: 14, overflow: 'hidden', elevation: 4, shadowColor: COLORS.PRIMARY_RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            onPress={() => setShowRequestModal(true)}
          >
            <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="delete-outline" size={24} color="white" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Pull Out Product</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Pull-Outs List */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 20, fontWeight: '700' }}>Pull-Out History</Text>
            <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 13 }}>{pullOuts.length} record(s)</Text>
          </View>

          {pullOuts.length === 0 ? (
            <View style={[CARD, { padding: 32, alignItems: 'center' }]}>
              <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, padding: 16, borderRadius: 50, marginBottom: 16 }}>
                <Icon name="inventory-2" size={40} color={COLORS.TEXT_MUTED} />
              </View>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600', fontSize: 18 }}>No Pull-Outs Yet</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                Tap the button above to pull out a product
              </Text>
            </View>
          ) : (
            pullOuts.map((pullOut: PullOut) => {
              const statusColors = getStatusColors(pullOut.status);
              return (
                <View key={pullOut.id} style={[CARD, { padding: 16, marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
                        {pullOut.product?.name || 'Unknown Product'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Quantity: {pullOut.quantity}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Branch: {pullOut.branch?.name || 'Unknown Branch'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Pulled Out: {formatDate(pullOut.pulled_out_at)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: statusColors.bg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ color: statusColors.text, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{pullOut.status}</Text>
                    </View>
                  </View>

                  {pullOut.notes && (
                    <View style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>{pullOut.notes}</Text>
                    </View>
                  )}

                  {pullOut.admin_notes && (
                    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>Admin Note:</Text>
                      <Text style={{ color: '#15803D', fontSize: 12 }}>{pullOut.admin_notes}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                    {pullOut.status === 'approved' && pullOut.approved_at && (
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Approved: {formatDate(pullOut.approved_at)}
                      </Text>
                    )}
                    {pullOut.status === 'rejected' && pullOut.rejected_at && (
                      <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Rejected: {formatDate(pullOut.rejected_at)}
                      </Text>
                    )}
                    {pullOut.status === 'pending' && (
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
              <Icon name="info" size={20} color={COLORS.STATUS_INFO_TEXT} />
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Information</Text>
            </View>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 13, lineHeight: 20 }}>
              • Pull-outs are for products no longer suitable for sale{'\n'}
              • Common reasons: expired, damaged, defective{'\n'}
              • Stock is reduced upon admin approval{'\n'}
              • All pull-outs are recorded for tracking purposes
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Request Modal - FoodMeal light theme */}
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
          <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderTopColor: COLORS.CARD_BORDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 22 }}>Pull Out Product</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {/* Product Selection */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Product</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, backgroundColor: COLORS.INPUT_BG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => setShowProductPicker(true)}
              >
                <Text style={{ color: selectedProduct ? COLORS.TEXT_PRIMARY : COLORS.TEXT_MUTED }}>
                  {selectedProduct ? selectedProduct.name : 'Select a product'}
                </Text>
                <Icon name="chevron-right" size={24} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Quantity</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, fontSize: 18, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Enter quantity"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="decimal-pad"
                value={requestQuantity}
                onChangeText={setRequestQuantity}
                editable={!submitMutation.isPending}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Min: 0.01 | Max: 1,000</Text>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Notes (Optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Additional details about the pull-out..."
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={requestNotes}
                onChangeText={setRequestNotes}
                editable={!submitMutation.isPending}
                maxLength={1000}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Max 1000 characters</Text>
            </View>

            <TouchableOpacity
              style={{ borderRadius: 12, overflow: 'hidden', opacity: submitMutation.isPending ? 0.7 : 1 }}
              onPress={handleSubmitRequest}
              disabled={submitMutation.isPending}
            >
              <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                {submitMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>Pull Out Product</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 12, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              onPress={() => setShowRequestModal(false)}
              disabled={submitMutation.isPending}
            >
              <Text style={{ color: COLORS.TEXT_MUTED, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal - light theme */}
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
          <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%', borderTopWidth: 1, borderTopColor: COLORS.CARD_BORDER }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 22 }}>Select Product</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_MUTED} />
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
                    <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 13 }}>SKU: {product.sku}</Text>
                    <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12 }}>{product.category}</Text>
                  </View>
                  {selectedProduct?.id === product.id && (
                    <Icon name="check-circle" size={24} color={COLORS.PRIMARY_RED} />
                  )}
                </TouchableOpacity>
              ))}
              {products.length === 0 && (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.TEXT_MUTED }}>No products available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PullOutScreen;
