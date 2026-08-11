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
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../lib/api';
import { COLORS, GRADIENT, CARD, getStatusColors } from '../../../lib/staffTheme';

type CashAdvance = {
  id: number;
  amount: number;
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
};

type Statistics = {
  total_requested: number;
  pending: number;
  approved: number;
  rejected: number;
  total_amount_approved: number;
};

const formatCurrency = (amount: number) => {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const CashAdvanceScreen = () => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { 
    data: advancesData, 
    isLoading: advancesLoading, 
    error: advancesError,
    refetch: refetchAdvances,
  } = useQuery({
    queryKey: ['cashAdvances'],
    queryFn: () => api.get('/cash-advances'),
  });

  const { 
    data: statistics, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['cashAdvanceStatistics'],
    queryFn: () => api.get('/cash-advances/statistics'),
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { amount: number; reason: string | null }) => {
      const response = await api.post('/cash-advances', data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert('Success', 'Your cash advance request has been submitted');
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestReason('');
      queryClient.invalidateQueries({ queryKey: ['cashAdvances'] });
      queryClient.invalidateQueries({ queryKey: ['cashAdvanceStatistics'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to submit request';
      Alert.alert('Error', message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchAdvances(),
        refetchStats(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchAdvances, refetchStats]);

  const advances = advancesData?.data?.data || [];
  const loading = advancesLoading || statsLoading;

  const handleSubmitRequest = async () => {
    const amount = parseFloat(requestAmount);
    
    if (!requestAmount || isNaN(amount) || amount < 100) {
      Alert.alert('Validation Error', 'Please enter a valid amount (minimum ₱100)');
      return;
    }

    if (amount > 10000) {
      Alert.alert('Validation Error', 'Maximum advance amount is ₱10,000');
      return;
    }

    submitMutation.mutate({
      amount: amount,
      reason: requestReason.trim() || null,
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Loading Cash Advances...</Text>
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
        <LinearGradient colors={GRADIENT.HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 48, paddingBottom: 40, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          {/* Decorative circles */}
          <View style={{ position: 'absolute', top: -30, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', top: 20, right: 60, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)' }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Cash Management
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800' }}>Cash Advance</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>Request and track your advances</Text>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 50 }}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Icon name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Statistics Cards */}
          {statistics?.data && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Total Approved</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>
                  {formatCurrency(statistics.data.total_amount_approved)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Pending</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{statistics.data.pending}</Text>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Request Button */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <TouchableOpacity onPress={() => setShowRequestModal(true)}>
            <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add-circle" size={24} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, marginLeft: 8 }}>Request Cash Advance</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Advances List */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 20, fontWeight: '700' }}>Your Requests</Text>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>{advances.length} request(s)</Text>
          </View>

          {advances.length === 0 ? (
            <View style={{ ...CARD, padding: 32, alignItems: 'center' }}>
              <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, padding: 16, borderRadius: 50, marginBottom: 16 }}>
                <Icon name="receipt-long" size={40} color={COLORS.TEXT_MUTED} />
              </View>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600', fontSize: 18 }}>No Requests Yet</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                Tap the button above to request a cash advance
              </Text>
            </View>
          ) : (
            advances.map((advance: CashAdvance) => {
              const statusColors = getStatusColors(advance.status);
              return (
                <View key={advance.id} style={{ ...CARD, padding: 16, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 18, marginBottom: 4 }}>
                        {formatCurrency(advance.amount)}
                      </Text>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>
                        Requested: {formatDate(advance.requested_at)}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: statusColors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <Text style={{ color: statusColors.text, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{advance.status}</Text>
                    </View>
                  </View>

                  {advance.reason && (
                    <View style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>{advance.reason}</Text>
                    </View>
                  )}

                  {advance.admin_notes && (
                    <View style={{ backgroundColor: '#DCFCE7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Admin Note:</Text>
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12 }}>{advance.admin_notes}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                    {advance.status === 'approved' && advance.approved_at && (
                      <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Approved: {formatDate(advance.approved_at)}
                      </Text>
                    )}
                    {advance.status === 'rejected' && advance.rejected_at && (
                      <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, fontWeight: '500' }}>
                        Rejected: {formatDate(advance.rejected_at)}
                      </Text>
                    )}
                    {advance.status === 'pending' && (
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
          <View style={{ backgroundColor: COLORS.ACCENT_LIGHT, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.CARD_BORDER }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Icon name="info" size={20} color={COLORS.PRIMARY_RED} />
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>Information</Text>
            </View>
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, lineHeight: 20 }}>
              • Minimum advance amount: ₱100{'\n'}
              • Maximum advance amount: ₱10,000{'\n'}
              • Advances are deducted from your monthly salary{'\n'}
              • Approval is subject to admin discretion
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
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', fontSize: 20 }}>Request Cash Advance</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Icon name="close" size={24} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Amount (₱)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 16, padding: 16, color: COLORS.TEXT_PRIMARY, fontSize: 18, backgroundColor: COLORS.INPUT_BG }}
                placeholder="Enter amount"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="decimal-pad"
                value={requestAmount}
                onChangeText={setRequestAmount}
                editable={!submitMutation.isPending}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Min: ₱100 | Max: ₱10,000</Text>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Reason (Optional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: COLORS.INPUT_BORDER, borderRadius: 16, padding: 16, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.INPUT_BG, textAlignVertical: 'top' }}
                placeholder="Why do you need this advance?"
                placeholderTextColor={COLORS.TEXT_MUTED}
                multiline
                numberOfLines={3}
                value={requestReason}
                onChangeText={setRequestReason}
                editable={!submitMutation.isPending}
                maxLength={500}
              />
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Max 500 characters</Text>
            </View>

            <TouchableOpacity
              onPress={handleSubmitRequest}
              disabled={submitMutation.isPending}
              style={{ borderRadius: 16, overflow: 'hidden', opacity: submitMutation.isPending ? 0.7 : 1 }}
            >
              <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 16, alignItems: 'center', borderRadius: 16 }}>
                {submitMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Submit Request</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 12, padding: 16, alignItems: 'center' }}
              onPress={() => setShowRequestModal(false)}
              disabled={submitMutation.isPending}
            >
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CashAdvanceScreen;
