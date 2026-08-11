// app/rider/History.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';

interface DeliveryHistory {
    id: string;
    orderNumber: string;
    customerName: string;
    customerAddress: string;
    items: string;
    totalAmount: number;
    status: 'delivered' | 'cancelled';
    date: string;
    time: string;
    earnings: number;
}

const TERMINAL_STATUSES = ['delivered', 'cancelled'];

export default function HistoryScreen() {
    const [history, setHistory] = useState<DeliveryHistory[]>([]);
    const [filteredHistory, setFilteredHistory] = useState<DeliveryHistory[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

    const loadHistory = useCallback(async () => {
        try {
            const res = await api.get('/rider/orders?per_page=100');
            const orders = res.data?.data ?? [];
            const mapped: DeliveryHistory[] = orders
                .filter((o: any) => TERMINAL_STATUSES.includes(o.status))
                .map((o: any) => ({
                    id: String(o.id),
                    orderNumber: o.order_number ?? `#${o.id}`,
                    customerName: o.customer_name ?? 'Customer',
                    customerAddress: o.customer_address ?? '',
                    items: (o.items ?? []).map((i: any) => `${i.name} (x${i.quantity})`).join(', '),
                    totalAmount: o.total ?? 0,
                    status: o.status as 'delivered' | 'cancelled',
                    date: o.created_at ?? '',
                    time: o.created_at ? new Date(o.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
                    earnings: o.status === 'delivered' ? (o.delivery_fee ?? 0) : 0,
                }));
            setHistory(mapped);
        } catch {
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        filterHistory();
    }, [selectedFilter, searchQuery, selectedPeriod, history]);

    const filterHistory = () => {
        let filtered = history;

        if (selectedFilter !== 'all') {
            filtered = filtered.filter(item => item.status === selectedFilter);
        }

        if (selectedPeriod !== 'all') {
            const today = new Date();
            let filterDate: Date;

            if (selectedPeriod === 'today') {
                filterDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            } else if (selectedPeriod === 'week') {
                filterDate = new Date(today);
                filterDate.setDate(today.getDate() - 7);
            } else {
                filterDate = new Date(today);
                filterDate.setMonth(today.getMonth() - 1);
            }

            filtered = filtered.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= filterDate;
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item =>
                item.orderNumber.toLowerCase().includes(query) ||
                item.customerName.toLowerCase().includes(query)
            );
        }

        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setFilteredHistory(filtered);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            delivered: '#10B981',
            cancelled: '#EF4444',
        };
        return colors[status] || '#9CA3AF';
    };

    const getStatusIcon = (status: string) => {
        const icons: Record<string, string> = {
            delivered: 'checkmark-circle',
            cancelled: 'close-circle',
        };
        return icons[status] || 'ellipse';
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            delivered: 'Delivered',
            cancelled: 'Cancelled',
        };
        return labels[status] || status;
    };

    const formatCurrency = (amount: number) => {
        return `₱${amount.toLocaleString()}`;
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getTotalEarnings = () => {
        return history
            .filter(item => item.status === 'delivered')
            .reduce((sum, item) => sum + item.earnings, 0);
    };

    const getDeliveryCount = () => {
        return history.filter(item => item.status === 'delivered').length;
    };

    const renderHistoryCard = (item: DeliveryHistory) => (
        <TouchableOpacity
            key={item.id}
            className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
            onPress={() => {}}
        >
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-bold text-gray-900">{item.orderNumber}</Text>
                <View
                    className="px-3 py-1 rounded-full flex-row items-center"
                    style={{ backgroundColor: getStatusColor(item.status) + '20' }}
                >
                    <Ionicons
                        name={getStatusIcon(item.status) as any}
                        size={12}
                        color={getStatusColor(item.status)}
                    />
                    <Text
                        className="text-xs font-medium ml-1"
                        style={{ color: getStatusColor(item.status) }}
                    >
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>

            <Text className="text-base font-semibold text-gray-900">{item.customerName}</Text>
            <View className="flex-row items-center mt-1">
                <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                <Text className="text-xs text-gray-500 ml-1 flex-1" numberOfLines={1}>
                    {item.customerAddress}
                </Text>
            </View>

            <Text className="text-xs text-gray-500 mt-2" numberOfLines={1}>
                {item.items}
            </Text>

            <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-gray-100">
                <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                    <Text className="text-xs text-gray-500 ml-1">
                        {formatDate(item.date)}
                    </Text>
                    <View className="w-0.5 h-3 bg-gray-300 mx-2" />
                    <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                    <Text className="text-xs text-gray-500 ml-1">{item.time}</Text>
                </View>
                {item.status === 'delivered' && (
                    <View className="bg-yellow-50 px-2 py-1 rounded-full border border-yellow-200">
                        <Text className="text-xs font-bold text-yellow-600">
                            +{formatCurrency(item.earnings)}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    // Filter options
    const filters = [
        { id: 'all', label: 'All' },
        { id: 'delivered', label: 'Delivered' },
        { id: 'cancelled', label: 'Cancelled' },
    ];

    const periodFilters = [
        { id: 'all', label: 'All Time' },
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'This Week' },
        { id: 'month', label: 'This Month' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white px-4 border-b border-gray-100">
                {/* Spacer to push everything down by 20 */}
                <View style={{ height: 25 }} />
                <View className="flex-row items-center justify-between pt-2 pb-4">
                    <View className="flex-row items-center flex-1">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4 p-2 active:opacity-70"
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={24} color="#1F2937" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-2xl font-bold text-gray-900">History</Text>
                            <Text className="text-sm text-gray-500 mt-1">
                                {filteredHistory.length} delivery{filteredHistory.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        className="bg-gray-100 p-3 rounded-xl active:opacity-70"
                        activeOpacity={0.7}
                        onPress={onRefresh}
                    >
                        <Ionicons name="refresh" size={20} color="#F59E0B" />
                    </TouchableOpacity>
                </View>

                {/* Stats Summary */}
                <View className="flex-row justify-between gap-2">
                    <View className="bg-gray-50 rounded-xl px-4 py-3 flex-1 border border-gray-100">
                        <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">Deliveries</Text>
                        <Text className="text-gray-900 text-xl font-bold mt-1">{getDeliveryCount()}</Text>
                    </View>
                    <View className="bg-gray-50 rounded-xl px-4 py-3 flex-1 border border-gray-100">
                        <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">Earnings</Text>
                        <Text className="text-yellow-600 text-xl font-bold mt-1">{formatCurrency(getTotalEarnings())}</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mt-4">
                    <Ionicons name="search" size={18} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-3 text-sm text-gray-900"
                        placeholder="Search by order # or customer..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Period Filters */}
            <View className="bg-white px-4 py-2 border-b border-gray-100">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row space-x-2">
                        {periodFilters.map((filter) => (
                            <TouchableOpacity
                                key={filter.id}
                                className={`px-4 py-2 rounded-full ${selectedPeriod === filter.id
                                        ? 'bg-yellow-400'
                                        : 'bg-gray-100'
                                    }`}
                                onPress={() => setSelectedPeriod(filter.id)}
                            >
                                <Text className={`text-sm font-medium ${selectedPeriod === filter.id
                                        ? 'text-yellow-900'
                                        : 'text-gray-600'
                                    }`}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Status Filters */}
            <View className="bg-white px-4 py-2 border-b border-gray-100">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row space-x-2">
                        {filters.map((filter) => (
                            <TouchableOpacity
                                key={filter.id}
                                className={`px-4 py-2 rounded-full ${selectedFilter === filter.id
                                        ? 'bg-yellow-400'
                                        : 'bg-gray-100'
                                    }`}
                                onPress={() => setSelectedFilter(filter.id)}
                            >
                                <Text className={`text-sm font-medium ${selectedFilter === filter.id
                                        ? 'text-yellow-900'
                                        : 'text-gray-600'
                                    }`}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* History List */}
            <ScrollView
                className="flex-1 px-4 pt-4 bg-gray-50"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#F59E0B"
                        colors={['#F59E0B']}
                    />
                }
            >
                {loading ? (
                    <View className="items-center justify-center py-12">
                        <ActivityIndicator size="large" color="#F59E0B" />
                    </View>
                ) : filteredHistory.length === 0 ? (
                    <View className="items-center justify-center py-12">
                        <Ionicons name="time-outline" size={64} color="#D1D5DB" />
                        <Text className="text-lg font-semibold text-gray-700 mt-4">
                            No History Found
                        </Text>
                        <Text className="text-sm text-gray-500 text-center mt-1">
                            {searchQuery
                                ? 'Try adjusting your search'
                                : 'No deliveries in this period'}
                        </Text>
                    </View>
                ) : (
                    filteredHistory.map(renderHistoryCard)
                )}
                <View className="h-4" />
            </ScrollView>
        </SafeAreaView>
    );
}