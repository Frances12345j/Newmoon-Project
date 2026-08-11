import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { getUser } from '../../../../lib/userStorage';
import { getBranchIdFromUser } from '../../../../lib/staffContext';
import { COLORS, GRADIENT, CARD, getStatusColors } from '../../../lib/staffTheme';
import { LinearGradient } from 'expo-linear-gradient';

type BackToSaleType = {
  id: number;
  product_id: number;
  branch_id: number;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  returned_at: string;
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
  product_stocks?: { branch_id: number; quantity: number }[];
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const BackToSaleScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const branchIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    resolveBranchId().then((id) => { branchIdRef.current = id; });
  }, []);

  const getProductStock = (product: any): number => {
    if (!product?.product_stocks || !branchIdRef.current) return 0;
    const stock = product.product_stocks.find(
      (s: any) => String(s.branch_id) === branchIdRef.current
    );
    return stock ? Number(stock.quantity) || 0 : 0;
  };

  // Fetch back-to-sales
  const {
    data: backToSalesData,
    isLoading: backToSalesLoading,
    error: backToSalesError,
    refetch: refetchBackToSales,
  } = useQuery({
    queryKey: ['backToSales'],
    queryFn: async () => {
      const branchId = await resolveBranchId();
      branchIdRef.current = branchId;
      const params: Record<string, any> = {};
      if (branchId) params.branch_id = branchId;
      return api.get('/back-to-sales', { params });
    },
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

  // Submit mutation
const submitMutation = useMutation({
  mutationFn: async (data: { product_id: number; branch_id: number; quantity: number; notes: string | null }) => {
    const response = await api.post('/back-to-sales', data);
    return response.data;
  },
  onSuccess: () => {
    Alert.alert('Success', 'Product has been returned for sale');
    setShowRequestModal(false);
    setSelectedProduct(null);
    setRequestQuantity('');
    setRequestNotes('');
    queryClient.invalidateQueries({ queryKey: ['backToSales'] });
  },
  onError: (error: any) => {
    console.error('Back-to-Sale error:', error);
    console.error('Error response:', error?.response);
    console.error('Error data:', error?.response?.data);

    let message = 'Failed to submit return';

    if (error?.response?.data?.message) {
      message = error.response.data.message;
    } else if (error?.response?.data?.error) {
      message = error.response.data.error;
    } else if (error?.message) {
      message = error.message;
    }

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
      await refetchBackToSales();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchBackToSales]);

  const backToSales = Array.isArray(backToSalesData?.data?.data) ? backToSalesData.data.data : [];
  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.data || []);
  const loading = backToSalesLoading || productsLoading;

  // Compute stats from fetched data
  const totalRecords = backToSales.length;
  const pendingCount = backToSales.filter((r: BackToSaleType) => r.status === 'pending').length;
  const approvedQuantity = backToSales
    .filter((r: BackToSaleType) => r.status === 'approved')
    .reduce((sum: number, r: BackToSaleType) => sum + Number(r.quantity), 0);

  const resolveBranchId = async (): Promise<string | null> => {
    try {
      const user = await getUser();
      const fromUser = getBranchIdFromUser(user);
      if (fromUser) return fromUser;

      const meRes = await api.get('/me');
      const fromMe = getBranchIdFromUser(meRes.data);
      if (fromMe) return fromMe;

      const userId = user?.id || meRes.data?.id;
      if (userId) {
        const assignRes = await api.get('/staff-assignments', {
          params: { user_id: userId, is_active: true, paginate: false },
        });
        const list = assignRes.data?.data || assignRes.data || [];
        const first = Array.isArray(list) ? list[0] : null;
        if (first?.branch_id) return String(first.branch_id);
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleSubmitRequest = async () => {
    const quantity = parseFloat(requestQuantity);

    if (!selectedProduct) {
      Alert.alert('Validation Error', 'Please select a product');
      return;
    }

    const branchId = await resolveBranchId();
    if (!branchId) {
      Alert.alert('Error', 'Could not determine your branch. Please contact admin to assign you to a branch.');
      return;
    }

    if (!requestQuantity || isNaN(quantity) || quantity < 0.5) {
      Alert.alert('Validation Error', 'Please enter a valid quantity (minimum 0.5)');
      return;
    }

    if (quantity > 1000) {
      Alert.alert('Validation Error', 'Maximum return quantity is 1,000');
      return;
    }

    submitMutation.mutate({
      product_id: selectedProduct.id,
      branch_id: Number(branchId),
      quantity: quantity,
      notes: requestNotes.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Loading Back-to-Sales...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
      <ScrollView
        className="flex-1"
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
          <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Inventory Management
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>Back-to-Sales</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>Return unsold products to inventory</Text>
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
          <View className="flex-row gap-3">
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>Total Returns</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>{totalRecords}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>Pending</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>{pendingCount}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* New Return Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <TouchableOpacity
            onPress={() => setShowRequestModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.SHADOW, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
              <Icon name="assignment-return" size={24} color="white" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Return Product</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Back-to-Sales List */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View className="flex-row justify-between items-center mb-4">
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 20, fontWeight: '700' }}>Return History</Text>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>{backToSales.length} record(s)</Text>
          </View>

          {backToSales.length === 0 ? (
            <View style={{ ...CARD, padding: 32, alignItems: 'center' }}>
              <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, padding: 16, borderRadius: 9999, marginBottom: 16 }}>
                <Icon name="inventory-2" size={40} color={COLORS.TEXT_SECONDARY} />
              </View>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '500', fontSize: 18 }}>No Returns Yet</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                Tap the button above to return a product
              </Text>
            </View>
          ) : (
            backToSales.map((item: BackToSaleType) => {
              const statusColors = getStatusColors(item.status);
              return (
                <View key={item.id} style={{ ...CARD, padding: 16, marginBottom: 12 }}>
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
                        {item.product?.name || 'Unknown Product'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Quantity: {item.quantity}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Branch: {item.branch?.name || 'Unknown Branch'}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Returned: {formatDate(item.returned_at)}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: statusColors.bg, borderColor: statusColors.text + '33' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: statusColors.text }}>{item.status}</Text>
                    </View>
                  </View>

                  {item.notes ? (
                    <View style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>{item.notes}</Text>
                    </View>
                  ) : null}

                  {item.admin_notes ? (
                    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Admin Note:</Text>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12 }}>{item.admin_notes}</Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                    {item.status === 'approved' && item.approved_at ? (
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Approved: {formatDate(item.approved_at)}
                      </Text>
                    ) : null}
                    {item.status === 'rejected' && item.rejected_at ? (
                      <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Rejected: {formatDate(item.rejected_at)}
                      </Text>
                    ) : null}
                    {item.status === 'pending' ? (
                      <Text style={{ color: COLORS.STATUS_PENDING_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Awaiting approval
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Info Section */}
        <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 24 }}>
          <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.CARD_BORDER }}>
            <View className="flex-row items-center mb-2">
              <Icon name="info" size={20} color={COLORS.PRIMARY_RED} />
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Information</Text>
            </View>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, lineHeight: 20 }}>
              • Back-to-Sale returns unsold products in good condition{'\n'}
              • Products are returned to available stock using FIFO method{'\n'}
              • Minimum return quantity: 0.5{'\n'}
              • Returns require admin approval before stock is restored
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
            <View className="flex-row justify-between items-center mb-6">
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 20 }}>Return Product</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

                {/* Product Selection */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Product</Text>
              <TouchableOpacity
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, backgroundColor: COLORS.INPUT_BG, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                onPress={() => setShowProductPicker(true)}
              >
                <View className="flex-1">
                  <Text style={{ color: selectedProduct ? COLORS.TEXT_PRIMARY : COLORS.TEXT_MUTED }}>
                    {selectedProduct ? selectedProduct.name : 'Select a product'}
                  </Text>
                  {selectedProduct ? (
                    <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>
                      Available stock: {getProductStock(selectedProduct)}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                Quantity {selectedProduct ? `(Available: ${getProductStock(selectedProduct)})` : ''}
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, fontSize: 18, backgroundColor: COLORS.INPUT_BG }}
                placeholder={selectedProduct ? `Max ${getProductStock(selectedProduct)}` : 'Enter quantity'}
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="decimal-pad"
                value={requestQuantity}
                onChangeText={setRequestQuantity}
                editable={!submitMutation.isPending}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>
                {selectedProduct
                  ? `Remaining stock: ${getProductStock(selectedProduct)} | Min: 0.5`
                  : 'Min: 0.5 | Max: 1,000'}
              </Text>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Notes (Optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 12, padding: 16, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Additional details..."
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={requestNotes}
                onChangeText={setRequestNotes}
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
              <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' }}>
                {submitMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18 }}>Submit Return</Text>
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
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 20 }}>Select Product (Stock)</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {products.map((product: any) => {
                const stockQty = getProductStock(product);
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={{ borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    onPress={() => {
                      setSelectedProduct(product);
                      setRequestQuantity(stockQty > 0 ? String(stockQty) : '');
                      setShowProductPicker(false);
                    }}
                  >
                    <View className="flex-1">
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600', fontSize: 16 }}>{product.name}</Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>SKU: {product.sku}</Text>
                      <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>
                        Stock: <Text style={{ color: stockQty > 0 ? COLORS.STATUS_APPROVED_TEXT : COLORS.STATUS_REJECTED_TEXT }}>{stockQty}</Text>
                        {' | '}{product.category}
                      </Text>
                    </View>
                    <View className="items-end">
                      {selectedProduct?.id === product.id ? (
                        <Icon name="check-circle" size={24} color={COLORS.PRIMARY_RED} />
                      ) : null}
                      {stockQty > 0 ? (
                        <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, marginTop: 4, fontWeight: '500' }}>{stockQty} available</Text>
                      ) : null}
                      {stockQty === 0 ? (
                        <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, marginTop: 4 }}>Out of stock</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {products.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.TEXT_SECONDARY }}>No products available</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BackToSaleScreen;
