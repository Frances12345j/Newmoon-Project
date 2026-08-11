import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    Modal,
    Pressable,
    FlatList,
    SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/authContext';
import { hasNetworkConnection, isAuthError, isNetworkError } from '../../../../lib/network';
import { getCachedProducts } from '../../../../lib/dataCache';
import { getUser as getStoredUserFromStorage } from '../../../../lib/userStorage';
import { resolveStaffBranch } from '../../../../lib/staffContext';
import { COLORS, GRADIENT } from '../../../lib/staffTheme';

type StockStatus = 'Low Stock' | 'In Stock' | 'Out of Stock';

type StockItem = {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  price: number;
  minStock: number;
  status: StockStatus;
  product_stocks?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean; branch?: { id: string; name?: string } }[];
  icon?: string;
  description?: string;
  popular?: boolean;
  received?: boolean;
  branchStock?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean };
};

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value: any) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

const getSaleDate = (sale: any) => {
  const rawDate = sale?.sale_date || sale?.created_at || '';
  if (typeof rawDate !== 'string') return '';
  const match = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const sumSalesTotal = (sales: any[] = []) => {
  if (!Array.isArray(sales)) return 0;
  return sales.reduce((sum, sale) => sum + Number(sale?.total || 0), 0);
};

const formatStockQty = (qty: number): { whole: string; hasHalf: boolean } => {
  const n = Math.round(Number(qty) * 2) / 2;
  const whole = Math.floor(n);
  const hasHalf = Math.abs(n - whole - 0.5) < 0.001;
  return { whole: String(whole), hasHalf };
};

const getStoredUser = async () => {
  const stored = await getStoredUserFromStorage();
  if (stored) return stored;
  const connected = await hasNetworkConnection();
  if (!connected) return null;
  try {
    const response = await api.get('me');
    return response.data || null;
  } catch (error) {
    if (!isAuthError(error) && !isNetworkError(error)) {
      console.error('Unable to load dashboard user:', error);
    }
    return null;
  }
};

const loadCachedStockForBranch = async (branchId: string | number | null): Promise<StockItem[]> => {
  const cached = await getCachedProducts<any>();
  if (!cached) return [];
  const productsData = Array.isArray(cached) ? cached : cached?.data ?? [];
  return productsData
    .map((item: any) => {
      const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
      const quantity = Number(branchStock?.quantity ?? 0) || 0;
      const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
      const lowStockThreshold = Math.max(minStock, 15);
      const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
      return {
        id: String(item.id),
        name: item.name,
        category: item.category || 'Product',
        type: 'Regular',
        quantity,
        price: Number(item.price || 0),
        minStock,
        status,
        branchStock,
        product_stocks: item.product_stocks,
      };
    })
    .filter((row: StockItem) => {
      if (!branchId) return true;
      return row.branchStock != null;
    });
};

const StatCard = React.memo(({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) => {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm" style={{ marginHorizontal: 4 }}>
      <View className="w-9 h-9 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: color }}>
        <Icon name={icon} size={18} color="white" />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-1" numberOfLines={1}>{value}</Text>
      <Text className="text-xs font-semibold text-gray-500 leading-4" numberOfLines={2}>{title}</Text>
    </View>
  );
});

const SaleRow = React.memo(({ sale }: { sale: any }) => {
  const cash = Number(sale?.cash_collected || 0);
  const change = Number(sale?.change_given ?? sale?.changeGiven ?? 0);
  const total = Number(sale?.total || 0);
  const invoice = sale?.invoice_number || `INV-${sale?.id || '-'}`;
  const hasSenior = Boolean(sale?.senior_discount);
  const discountAmount = Number(sale?.discount_amount || 0);
  const customer = sale?.customer_name || '-';

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-gray-900">{invoice}</Text>
          <Text className="text-xs text-gray-500 mt-1">{formatDateTime(sale?.created_at || sale?.sale_date)}</Text>
          <Text className="text-xs text-gray-500 mt-1">Customer: {customer}</Text>
        </View>
        <View className="items-end">
          <Text className="text-lg font-extrabold text-red-600">₱{total.toLocaleString()}</Text>
          {hasSenior && (
            <Text className="text-xs font-bold text-green-600">Senior: -₱{discountAmount.toLocaleString()}</Text>
          )}
        </View>
      </View>
      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-100">
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cash</Text>
          <Text className="text-sm font-bold text-gray-900">₱{cash.toLocaleString()}</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Change</Text>
          <Text className="text-sm font-bold text-gray-900">₱{change.toLocaleString()}</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Payment</Text>
          <Text className="text-sm font-bold text-gray-900">{String(sale?.payment_method || 'cash').toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
});

const StockRow = React.memo(({ item }: { item: StockItem }) => {
  const isLow = item.status === 'Low Stock';
  const isOut = item.status === 'Out of Stock';
  const { whole, hasHalf } = formatStockQty(item.quantity);

  return (
    <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-gray-900" numberOfLines={2}>{item.name}</Text>
          <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{item.category} • {item.type}</Text>
        </View>
        <View className={`px-2 py-1 rounded-md ${isOut ? 'bg-red-50' : isLow ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <Text className={`text-xs font-bold ${isOut ? 'text-red-700' : isLow ? 'text-yellow-700' : 'text-green-700'}`} numberOfLines={1}>
            {item.status}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Quantity</Text>
          <View className="items-center">
            <Text className="text-lg font-bold text-gray-900">{hasHalf ? `${whole}.5` : whole}</Text>
            {hasHalf && (
              <View className="bg-yellow-50 px-2 py-0.5 rounded-lg mt-1 border border-yellow-200">
                <Text className="text-[10px] font-bold text-yellow-700">{whole} ½ stock</Text>
              </View>
            )}
          </View>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Price</Text>
          <Text className="text-base font-bold text-red-600" numberOfLines={1}>₱{item.price}</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Min. Stock</Text>
          <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{item.minStock}</Text>
        </View>
      </View>
    </View>
  );
});

const DashboardScreen = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grossSales, setGrossSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todaySalesList, setTodaySalesList] = useState<any[]>([]);
  const [salesTodayModalVisible, setSalesTodayModalVisible] = useState(false);
  const [salesTodayPage, setSalesTodayPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [user, setUser] = useState<any>(null);
  const [quotaProductsSold, setQuotaProductsSold] = useState(0);
  const [monthlyProductsSold, setMonthlyProductsSold] = useState(0);
  const [quotaIncentive, setQuotaIncentive] = useState(0);
  const [productTarget, setProductTarget] = useState(40);
  const [monthlyTarget, setMonthlyTarget] = useState(0);

  const SALES_TODAY_PAGE_SIZE = 4;

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('logout'); } catch {}
          await signOut();
          router.replace('/Login');
        },
      },
    ]);
  }, [router, signOut]);

  const loadDashboardData = useCallback(async () => {
    try {
      const connected = await hasNetworkConnection();
      if (!connected) {
        const { branchId } = await resolveStaffBranch();
        const cachedStock = await loadCachedStockForBranch(branchId);
        setStockData(cachedStock);
        setGrossSales(0);
        setTodaySales(0);
        setTodaySalesList([]);
        setSalesTodayPage(1);
        return;
      }

      const today = formatLocalDate();
      const now = new Date();
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const monthEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const nextMonthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      
      const { branchId } = await resolveStaffBranch();
      const branchParams = branchId ? { branch_id: branchId } : {};

      const [productsRes, summaryRes, monthlySalesRes] = await Promise.all([
        api.get('products'),
        api.get('sales', { params: { ...branchParams, date: today } }),
        api.get('sales', { params: { ...branchParams, start_date: monthStart, end_date: nextMonthStart } }),
      ]);

      const productsData = Array.isArray(productsRes?.data) ? productsRes.data : (productsRes?.data?.data || []);
      const mappedStock: StockItem[] = productsData
        .map((item: any) => {
          const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
          const quantity = Number(branchStock?.quantity ?? 0) || 0;
          const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
          const lowStockThreshold = Math.max(minStock, 15);
          const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
          return {
            id: String(item.id),
            name: item.name,
            category: item.category || 'Product',
            type: 'Regular',
            quantity,
            price: Number(item.price || 0),
            minStock,
            status,
            branchStock,
            product_stocks: item.product_stocks,
          };
        })
        .filter((row: StockItem) => (!branchId ? true : row.branchStock != null));

      setStockData(mappedStock);

      const summaryData = Array.isArray(summaryRes?.data) ? summaryRes.data : (summaryRes?.data?.data || []);
      setTodaySalesList(summaryData);
      setTodaySales(sumSalesTotal(summaryData));
      setSalesTodayPage(1);

      const monthlyData = Array.isArray(monthlySalesRes?.data) ? monthlySalesRes.data : (monthlySalesRes?.data?.data || []);
      const monthSalesTotal = sumSalesTotal(
        monthlyData.filter((sale: any) => {
          const saleDate = getSaleDate(sale);
          return saleDate >= monthStart && saleDate <= monthEnd;
        })
      );
      setGrossSales(monthSalesTotal);

      const storedUser = await getStoredUserFromStorage();
      try {
        const incentivesRes = await api.get('sales/product-incentives', {
          params: { month: now.getMonth() + 1, year: now.getFullYear() },
        });
        const incentivesData = incentivesRes?.data || {};
        const userIncentive = Object.values(incentivesData).find(
          (entry: any) => entry?.user_id === storedUser?.id
        ) as any;
        setQuotaProductsSold(userIncentive?.daily_products_sold ?? 0);
        setMonthlyProductsSold(userIncentive?.total_products_sold ?? 0);
        setQuotaIncentive(userIncentive?.incentive_amount ?? 0);
      } catch {
        setQuotaProductsSold(0);
        setQuotaIncentive(0);
      }

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const targetRes = await api.get('sales-targets', { params: { month: currentMonth } });
        const allTargets = targetRes?.data?.data || [];
        const matchedTarget = allTargets.find((t: any) => idsEqual(t.branch_id, branchId)) || allTargets[0];
        if (matchedTarget) {
          const monthly = Number(matchedTarget.target_products) || 0;
          setMonthlyTarget(monthly);
          setProductTarget(40);
        }
      } catch {
        setMonthlyTarget(0);
      }
    } catch (error: any) {
      if (isAuthError(error)) {
        try { await api.post('logout'); } catch {}
        await signOut();
        router.replace('/Login');
        return;
      }
      if (isNetworkError(error)) {
        const { branchId } = await resolveStaffBranch();
        const cachedStock = await loadCachedStockForBranch(branchId);
        setStockData(cachedStock);
      }
    } finally {
      setLoading(false);
    }
  }, [signOut, router]);

  const loadUserData = useCallback(async () => {
    const userData = await getStoredUser();
    setUser(userData);
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadUserData();
  }, [loadDashboardData, loadUserData]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  const totalStock = useMemo(() => stockData.reduce((sum, item) => sum + Number(item.quantity), 0), [stockData]);
  const lowStockCount = useMemo(() => stockData.filter(item => item.status === 'Low Stock').length, [stockData]);
  const totalValue = useMemo(() => stockData.reduce((sum, item) => sum + (item.quantity * item.price), 0), [stockData]);
  
  const alertsList = useMemo(
    () => stockData.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock'),
    [stockData]
  );

  const filteredStock = useMemo(() => {
    if (filterCategory === 'LOW') return stockData.filter(i => i.status === 'Low Stock');
    if (filterCategory === 'OUT') return stockData.filter(i => i.status === 'Out of Stock');
    return stockData;
  }, [stockData, filterCategory]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(todaySalesList.length / SALES_TODAY_PAGE_SIZE)),
    [todaySalesList.length]
  );

  const pagedSales = useMemo(() => {
    const start = (salesTodayPage - 1) * SALES_TODAY_PAGE_SIZE;
    return todaySalesList.slice(start, start + SALES_TODAY_PAGE_SIZE);
  }, [todaySalesList, salesTodayPage]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#DC2626" />
        <Text className="mt-4 text-gray-900 font-semibold text-base">Loading New Moon Staff Portal...</Text>
      </SafeAreaView>
    );
  }

  const { whole: totalWhole, hasHalf: totalHasHalf } = formatStockQty(totalStock);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#DC2626']}
            tintColor="#DC2626"
          />
        }
      >
        {/* HERO HEADER */}
        <LinearGradient
          colors={GRADIENT.HEADER}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="pt-12 pb-9 px-6 rounded-b-3xl"
        >
          <View className="absolute -top-8 -right-5 w-28 h-28 rounded-full bg-white/10" />
          <View className="absolute top-8 right-16 w-14 h-14 rounded-full bg-white/5" />

          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-1">
              <Text className="text-white/80 text-xs font-bold tracking-wider mb-1">WELCOME BACK</Text>
              <Text className="text-white text-2xl font-extrabold">
                {user?.firstname && user?.lastname ? `${user.firstname} ${user.lastname}` : 'Staff Member'}
              </Text>
              <View className="flex-row items-center mt-1">
                <Icon name="storefront" size={13} color="rgba(255,255,255,0.9)" />
                <Text className="text-white/85 text-xs font-medium ml-1">New Moon Lechon House</Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity className="bg-white/20 p-2.5 rounded-full">
                <Icon name="notifications-none" size={22} color="white" />
                <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-500" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} className="bg-white/20 p-2.5 rounded-full">
                <Icon name="logout" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { setSalesTodayPage(1); setSalesTodayModalVisible(true); }}
          >
            <View className="bg-white/15 rounded-2xl p-5 border border-white/20">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-4">
                  <Text className="text-white/85 text-xs font-bold tracking-wider mb-2">TOTAL SALES TODAY</Text>
                  <Text className="text-white text-4xl font-extrabold mb-1">₱{todaySales.toLocaleString()}</Text>
                  <Text className="text-white/60 text-xs">Tap to view checkouts →</Text>
                </View>
                <View className="bg-white/25 px-3 py-2 rounded-xl flex-row items-center">
                  <Icon name="receipt-long" size={16} color="white" />
                  <Text className="text-white font-extrabold text-sm ml-1">{todaySalesList.length}</Text>
                </View>
              </View>

              <View className="flex-row justify-around items-center pt-4 mt-4 border-t border-white/15">
                <View className="items-center">
                  <Text className="text-white/75 text-xs font-medium">This Month</Text>
                  <Text className="text-white font-bold text-lg">₱{grossSales.toLocaleString()}</Text>
                </View>
                <View className="w-px h-8 bg-white/20" />
                <View className="items-center">
                  <Text className="text-white/75 text-xs font-medium">Sales Target</Text>
                  <Text className="text-white font-bold text-lg">{monthlyTarget > 0 ? `${monthlyTarget} pcs` : 'Not set'}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </LinearGradient>

        {/* QUOTA / INCENTIVE CARD */}
        <View className="px-6 mt-6">
          <View className="bg-white rounded-2xl p-5 shadow-sm">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xs font-bold text-gray-500 tracking-wider">PRODUCT QUOTA</Text>
              <Text className="text-sm font-semibold text-gray-900">₱100 per 40 products</Text>
            </View>

            <View className="flex-row items-center mb-2">
              <View className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <View className={`h-full rounded-full ${quotaProductsSold >= productTarget ? 'bg-green-500' : 'bg-yellow-500'}`}
                  style={{ width: `${Math.min((quotaProductsSold / productTarget) * 100, 100)}%` }}
                />
              </View>
              <Text className="text-sm font-extrabold text-gray-900 ml-3">{quotaProductsSold}/{productTarget}</Text>
            </View>

            <Text className="text-xs text-gray-500 mb-3">
              {quotaProductsSold >= productTarget
                ? '🎉 Daily target reached! Outstanding job!'
                : `${productTarget - quotaProductsSold} products remaining to earn incentive`}
            </Text>

            <View className={`flex-row items-center rounded-xl p-3 ${quotaIncentive > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <Icon name="emoji-events" size={20} color={quotaIncentive > 0 ? '#16A34A' : '#9CA3AF'} />
              <View className="ml-3">
                <Text className="text-xs text-gray-500">Monthly Incentive Bonus</Text>
                <Text className={`text-sm font-extrabold ${quotaIncentive > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {quotaIncentive > 0 ? `₱${quotaIncentive.toLocaleString()}` : '₱0'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* INVENTORY OVERVIEW STATS GRID */}
        <View className="px-6 mt-6">
          <Text className="text-xl font-extrabold text-gray-900 mb-4">Inventory Overview</Text>
          <View className="flex-row justify-between">
            <StatCard
              title="Total Items"
              value={stockData.length}
              icon="restaurant-menu"
              color="#DC2626"
            />
            <StatCard
              title={totalHasHalf ? `${totalWhole} ½ Stock` : 'Total Stock'}
              value={totalHasHalf ? `${totalWhole}.5` : totalWhole}
              icon="kitchen"
              color="#1E3A8A"
            />
            <StatCard
              title="Low Stock"
              value={lowStockCount}
              icon="warning"
              color="#F59E0B"
            />
          </View>
        </View>

        {/* TOTAL INVENTORY VALUE BANNER */}
        <View className="px-6 mt-4 mb-2">
          <LinearGradient
            colors={['#1E3A8A', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-2xl p-5 flex-row items-center shadow-lg"
          >
            <View className="flex-1">
              <Text className="text-white/80 text-xs font-bold tracking-wide">TOTAL INVENTORY VALUE</Text>
              <Text className="text-white text-2xl font-extrabold my-1">₱{totalValue.toLocaleString()}</Text>
              <Text className="text-white/60 text-xs">Across all branch products</Text>
            </View>
            <View className="bg-white/20 p-4 rounded-2xl">
              <Icon name="account-balance-wallet" size={24} color="white" />
            </View>
          </LinearGradient>
        </View>

        {/* CURRENT STOCK LEVELS LIST */}
        <View className="px-6 mt-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-extrabold text-gray-900">Stock Levels</Text>
            <Text className="text-sm text-gray-500 font-semibold">{filteredStock.length} items</Text>
          </View>

          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={() => setFilterCategory('ALL')}
              className={`px-4 py-1.5 rounded-full ${filterCategory === 'ALL' ? 'bg-red-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-xs font-semibold ${filterCategory === 'ALL' ? 'text-white' : 'text-gray-500'}`}>
                All ({stockData.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterCategory('LOW')}
              className={`px-4 py-1.5 rounded-full ${filterCategory === 'LOW' ? 'bg-red-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-xs font-semibold ${filterCategory === 'LOW' ? 'text-white' : 'text-gray-500'}`}>
                Low ({lowStockCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterCategory('OUT')}
              className={`px-4 py-1.5 rounded-full ${filterCategory === 'OUT' ? 'bg-red-600' : 'bg-gray-100'}`}
            >
              <Text className={`text-xs font-semibold ${filterCategory === 'OUT' ? 'text-white' : 'text-gray-500'}`}>
                Out ({stockData.filter(i => i.status === 'Out of Stock').length})
              </Text>
            </TouchableOpacity>
          </View>

          {filteredStock.map((item) => (
            <StockRow key={item.id} item={item} />
          ))}
        </View>

        {/* STOCK ALERTS SECTION */}
        {alertsList.length > 0 && (
          <View className="px-6 mt-4">
            <Text className="text-xl font-extrabold text-gray-900 mb-3">Stock Alerts</Text>
            {alertsList.map((item) => {
              const isOut = item.status === 'Out of Stock';
              return (
                <View
                  key={`alert-${item.id}`}
                  className={`rounded-xl p-4 mb-3 border ${isOut ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <View className="flex-row items-center mb-1.5">
                    <Icon
                      name={isOut ? 'error-outline' : 'warning'}
                      size={18}
                      color={isOut ? '#DC2626' : '#F59E0B'}
                    />
                    <Text className={`font-extrabold text-sm ml-2 ${isOut ? 'text-red-700' : 'text-yellow-700'}`}>
                      {isOut ? 'Out of Stock Alert' : 'Low Stock Warning'}
                    </Text>
                  </View>
                  <Text className="font-bold text-sm text-gray-900">{item.name}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {isOut
                      ? 'No stock remaining. Please restock immediately from the main kitchen.'
                      : `Only ${item.quantity} units remaining (Minimum threshold: ${item.minStock}).`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* FOOTER */}
        <View className="bg-white py-4 px-6 border-t border-gray-100 mt-6 mb-4">
          <View className="flex-row justify-center items-center mb-2">
            <Icon name="store" size={14} color="#9CA3AF" />
            <Text className="text-center text-gray-500 text-xs font-medium ml-2">
              New Moon Lechon House • Staff Portal
            </Text>
          </View>
          <Text className="text-center text-gray-400 text-xs">
            Updated: {new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </ScrollView>

      {/* SALES TODAY MODAL */}
      <Modal
        visible={salesTodayModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSalesTodayModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <Pressable className="absolute inset-0" onPress={() => setSalesTodayModalVisible(false)} />
          <View className="bg-white rounded-t-3xl h-[92%]">
            <LinearGradient colors={GRADIENT.PRIMARY} className="px-5 py-4 rounded-t-3xl flex-row justify-between items-center">
              <View>
                <Text className="text-white font-extrabold text-lg">Sales Today</Text>
                <Text className="text-white/80 text-xs">{todaySalesList.length} total checkout(s)</Text>
              </View>
              <TouchableOpacity onPress={() => setSalesTodayModalVisible(false)} className="p-1.5">
                <Icon name="close" size={24} color="white" />
              </TouchableOpacity>
            </LinearGradient>

            <View className="flex-1 px-5">
              {todaySalesList.length === 0 ? (
                <View className="py-16 items-center">
                  <View className="bg-yellow-50 p-4 rounded-full mb-4">
                    <Icon name="receipt" size={32} color="#9CA3AF" />
                  </View>
                  <Text className="text-gray-900 font-bold text-base">No sales recorded today</Text>
                  <Text className="text-gray-500 text-xs text-center mt-1">Transactions completed via POS will display here in real-time.</Text>
                </View>
              ) : (
                <FlatList
                  data={pagedSales}
                  keyExtractor={(item) => String(item?.id || item?.invoice_number)}
                  renderItem={({ item }) => <SaleRow sale={item} />}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
                  ListHeaderComponent={
                    <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                      <View className="flex-row justify-between items-center">
                        <View>
                          <Text className="text-[11px] font-semibold text-gray-400 uppercase">Daily Gross Total</Text>
                          <Text className="text-2xl font-extrabold text-gray-900">₱{todaySales.toLocaleString()}</Text>
                        </View>
                        <View className="bg-yellow-50 px-3 py-1.5 rounded-xl">
                          <Text className="text-xs font-bold text-red-600">{formatLocalDate()}</Text>
                        </View>
                      </View>
                    </View>
                  }
                />
              )}
            </View>

            {todaySalesList.length > SALES_TODAY_PAGE_SIZE && (
              <View className="px-5 py-3.5 border-t border-gray-100 flex-row items-center justify-between">
                <TouchableOpacity
                  onPress={() => setSalesTodayPage((p) => Math.max(1, p - 1))}
                  disabled={salesTodayPage <= 1}
                  className={`px-4 py-2 rounded-xl border border-gray-200 flex-row items-center ${salesTodayPage <= 1 ? 'opacity-40' : ''}`}
                >
                  <Icon name="chevron-left" size={20} color="#1F2937" />
                  <Text className="font-bold ml-1 text-gray-900">Prev</Text>
                </TouchableOpacity>

                <Text className="text-sm font-bold text-gray-500">Page {salesTodayPage} of {totalPages}</Text>

                <TouchableOpacity
                  onPress={() => setSalesTodayPage((p) => Math.min(totalPages, p + 1))}
                  disabled={salesTodayPage >= totalPages}
                  className={`px-4 py-2 rounded-xl border border-gray-200 flex-row items-center ${salesTodayPage >= totalPages ? 'opacity-40' : ''}`}
                >
                  <Text className="font-bold mr-1 text-gray-900">Next</Text>
                  <Icon name="chevron-right" size={20} color="#1F2937" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DashboardScreen;