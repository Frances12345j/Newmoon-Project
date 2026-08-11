import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { cacheProducts, getCachedProducts } from '../../../../lib/dataCache';
import { hasNetworkConnection } from '../../../../lib/network';
import { resolveStaffBranch, loadStaffUser } from '../../../../lib/staffContext';
import { COLORS, GRADIENT, CARD } from '../../../lib/staffTheme';

const { height: screenHeight } = Dimensions.get('window');

/** Portions sold in halves (½ bird, whole, 1½, …). */
const QTY_STEP = 0.5;

function snapQtyToHalfStep(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 2) / 2;
}

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

function formatQtyForDisplay(n: number): string {
  const s = snapQtyToHalfStep(Number(n));
  const r = Math.round(s * 100) / 100;
  return Number.isInteger(r) ? String(Math.round(r)) : String(r);
}

type StockStatus = 'Low Stock' | 'In Stock' | 'Out of Stock';

type StockBranch = {
  id: string;
  name?: string;
};

type StockProductStock = {
  id: string;
  branch_id: string | number;
  quantity: number;
  minimum_stock: number;
  branch?: StockBranch;
};

type StockDelivery = {
  id: string;
  branch_id: string | number;
  quantity: number;
  restocked_at?: string | null;
  received_at?: string | null;
  received_by?: string | number | null;
  marked_as_not_received?: boolean;
  not_received_at?: string | null;
  branch?: StockBranch;
};

type StockItem = {
  id: string;
  name: string;
  sku?: string;
  category: string;
  type: string;
  quantity: number;
  price: number;
  minStock: number;
  status: StockStatus;
  product_stocks?: StockProductStock[];
  ongoing_stocks?: StockDelivery[];
  image?: string;
  icon: string;
  description?: string;
  popular?: boolean;
  branchStock?: StockProductStock;
  pendingQty?: number;
  lastDeliveryAt?: string | null;
};

// ===== Robust extractor with logging =====
function extractProductsArray(responseData: any): any[] {
  console.log('[EXTRACT] Response data type:', typeof responseData);
  console.log('[EXTRACT] Response data keys:', responseData ? Object.keys(responseData) : 'null/undefined');

  if (Array.isArray(responseData)) {
    console.log('[EXTRACT] Response is direct array, length:', responseData.length);
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    // Laravel paginated: { data: [...], ... }
    if (Array.isArray(responseData.data)) {
      console.log('[EXTRACT] Using responseData.data, length:', responseData.data.length);
      return responseData.data;
    }
    // Some APIs wrap products in a 'products' key
    if (Array.isArray(responseData.products)) {
      console.log('[EXTRACT] Using responseData.products, length:', responseData.products.length);
      return responseData.products;
    }
    // Maybe the whole object is the product list? (unlikely)
    console.warn('[EXTRACT] Could not find an array in response, returning []');
    return [];
  }

  console.warn('[EXTRACT] Response data is not an object, returning []');
  return [];
}

function formatRestockDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

export default function POSScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<(StockItem & { quantity: number })[]>([]);
  const [cash, setCash] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ongoingStocksModalVisible, setOngoingStocksModalVisible] = useState(false);
  const [ongoingStocks, setOngoingStocks] = useState<StockItem[]>([]);
  const [collapsedReceived, setCollapsedReceived] = useState(false);
  const [collapsedNotReceived, setCollapsedNotReceived] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [halfPortions, setHalfPortions] = useState<Record<string, boolean>>({});

  // Only "All" category now
  const categories = ['All'];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryScrollRef = useRef<ScrollView>(null);

  const COLLAPSE_KEY_RECEIVED = 'pos_ongoing_stocks_collapsed_received';
  const COLLAPSE_KEY_NOT_RECEIVED = 'pos_ongoing_stocks_collapsed_not_received';
  const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

  // --- Branch resolution ---
  const getBranchIdFromUser = (user: any): string | null => {
    if (!user) return null;
    if (user.branch_id) return String(user.branch_id);
    if (user.branchId) return String(user.branchId);
    if (user.branch?.id) return String(user.branch.id);
    if (user.branch?.branch_id) return String(user.branch.branch_id);

    const assignments = Array.isArray(user.branch_assignments) ? user.branch_assignments :
      Array.isArray(user.branchAssignments) ? user.branchAssignments : [];
    const activeAssignment = assignments.find((a: any) => a?.is_active) || assignments[0];
    if (activeAssignment) {
      return String(activeAssignment?.branch_id ||
        activeAssignment?.branch?.id ||
        activeAssignment?.branch?.branch_id ||
        activeAssignment?.id);
    }
    if (user.staff?.branch_id) return String(user.staff.branch_id);
    if (user.staff?.branch?.id) return String(user.staff.branch.id);
    return null;
  };

  const resolveBranchId = async (): Promise<string | null> => {
    if (branchId) return branchId;
    try {
      const { branchId: bid } = await resolveStaffBranch();
      if (bid) {
        setBranchId(bid);
        return bid;
      }
      return null;
    } catch (error) {
      console.error('[BRANCH] resolveBranchId error:', error);
      return null;
    }
  };

  // --- React Query for Products ---
  const productsQuery = useQuery<StockItem[]>({
    queryKey: ['products', branchId],
    queryFn: async () => {
      try {
        const connected = await hasNetworkConnection();
        let responseData: any;

        if (connected) {
          try {
            const response = await api.get('/products');
            responseData = response.data;
            await cacheProducts(responseData);
          } catch (error) {
            responseData = await getCachedProducts();
            if (!responseData) {
              console.warn('[productsQuery] No cached products available, returning empty array');
              return [];
            }
          }
        } else {
          responseData = await getCachedProducts();
          if (!responseData) {
            console.warn('[productsQuery] No cached products while offline, returning empty array');
            return [];
          }
        }

        const rawProducts = extractProductsArray(responseData);
        if (!Array.isArray(rawProducts)) {
          console.warn('[productsQuery] rawProducts is not an array, resetting to []');
          return [];
        }
        const branch = await resolveBranchId();
        const productsWithDetails: StockItem[] = rawProducts.map((item: any) => {
          const branchStock = (item.product_stocks || []).find((s: any) =>
            idsEqual(s.branch_id, branch)
          );
          const quantity = branchStock?.quantity || 0;
          const minimumStock = branchStock?.minimum_stock ?? 0;
          const status: StockStatus = quantity <= 0 ? 'Out of Stock' : 'In Stock';
          return {
            id: String(item.id),
            name: item.name,
            category: item.category || 'Product',
            type: 'Regular',
            quantity,
            price: Number(item.price || 0),
            minStock: minimumStock,
            status,
            image: item.image || null,
            icon: item.category === 'Liempo' ? 'lunch_dining' : 'fastfood',
            description: `Stock: ${quantity}`,
            popular: quantity > 20,
            branchStock: branchStock,
            ongoing_stocks: item.ongoing_stocks || [],
          };
        });
        const pendingExists = rawProducts.some((item: any) =>
          (item.ongoing_stocks || []).some(
            (d: any) => idsEqual(d.branch_id, branch) && !d.received_at && Number(d.quantity || 0) > 0
          )
        );
        queryClient.setQueryData(['pendingStock'], pendingExists);
        return productsWithDetails.filter((p: StockItem) => p.quantity > 0);
      } catch (error) {
        console.error('[productsQuery] Error:', error);
        return [];
      }
    },
    enabled: true,
    staleTime: 30000,
  });

  // --- Load ongoing stocks (manual) ---
  const loadOngoingStocks = async () => {
    try {
      const response = await api.get('/products');
      const raw = extractProductsArray(response.data);
      if (!Array.isArray(raw)) {
        console.warn('[loadOngoingStocks] raw is not an array');
        Alert.alert('Error', 'Could not load stocks');
        return;
      }
      const branch = await resolveBranchId();
      const productsWithDetails = raw.map((item: any) => {
        const branchStock = (item.product_stocks || []).find((s: any) =>
          idsEqual(s.branch_id, branch)
        );
        const quantity = branchStock?.quantity || 0;
        const minimumStock = branchStock?.minimum_stock ?? 0;
        const deliveriesForBranch = (item.ongoing_stocks || []).filter((d: any) =>
          idsEqual(d.branch_id, branch)
        );
        const pendingQty = deliveriesForBranch
          .filter((d: any) => !d.received_at)
          .reduce((sum: number, d: any) => sum + Number(d.quantity || 0), 0);
        const lastDeliveryAt =
          deliveriesForBranch
            .map((d: any) => d.restocked_at)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null;
        return {
          id: String(item.id),
          name: item.name,
          category: item.category || 'Product',
          type: 'Regular',
          quantity,
          price: Number(item.price || 0),
          minStock: minimumStock,
          status: quantity <= 0 ? 'Out of Stock' : quantity < minimumStock ? 'Low Stock' : 'In Stock' as StockStatus,
          icon: item.category === 'Liempo' ? 'lunch_dining' : 'fastfood',
          description: `Stock: ${quantity}`,
          popular: quantity > 20,
          branchStock,
          ongoing_stocks: deliveriesForBranch,
          pendingQty,
          lastDeliveryAt,
        } as StockItem;
      });
      const onlyBranchOngoing = productsWithDetails.filter((p: any) => (p.ongoing_stocks || []).length > 0);
      setOngoingStocks(onlyBranchOngoing);
      setOngoingStocksModalVisible(true);
    } catch (error) {
      console.error('Error loading ongoing stocks:', error);
      Alert.alert('Error', 'Failed to load stocks');
    }
  };

  // --- Mark as received / not received ---
  const markAsReceived = async (item: StockItem) => {
    try {
      const branch = await resolveBranchId();
      if (!branch) { Alert.alert('Error', 'No branch assigned'); return; }
      await api.post(`/products/${item.id}/toggle-received`, { branch_id: branch });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await loadOngoingStocks();
      Alert.alert('Success', 'Stock marked as received');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
    }
  };

  const markAsNotReceived = async (item: StockItem) => {
    try {
      const branch = await resolveBranchId();
      if (!branch) { Alert.alert('Error', 'No branch assigned'); return; }
      Alert.alert(
        'Mark as Not Received',
        `Report that ${item.name} has not arrived? This will notify the admin.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Not Received',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post(`/products/${item.id}/mark-not-received`, { branch_id: branch });
                setOngoingStocks(prev =>
                  prev.map(p => {
                    if (p.id !== item.id) return p;
                    return {
                      ...p,
                      ongoing_stocks: (p.ongoing_stocks || []).map(d => ({
                        ...d,
                        marked_as_not_received: !d.received_at ? true : d.marked_as_not_received,
                        not_received_at: !d.received_at ? new Date().toISOString() : d.not_received_at,
                      })),
                    };
                  })
                );
                queryClient.invalidateQueries({ queryKey: ['products'] });
                Alert.alert('Reported', 'Admin has been notified that the stock did not arrive.');
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.message || 'Failed to report');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update');
    }
  };

  // --- Collapse preferences ---
  useEffect(() => {
    const loadCollapsePrefs = async () => {
      try {
        const [r, nr] = await Promise.all([
          Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(COLLAPSE_KEY_RECEIVED)) : SecureStore.getItemAsync(COLLAPSE_KEY_RECEIVED),
          Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(COLLAPSE_KEY_NOT_RECEIVED)) : SecureStore.getItemAsync(COLLAPSE_KEY_NOT_RECEIVED),
        ]);
        if (r != null) setCollapsedReceived(r === '1');
        if (nr != null) setCollapsedNotReceived(nr === '1');
      } catch (e) { console.error(e); }
    };
    loadCollapsePrefs();
  }, []);

  const toggleCollapsedReceived = async () => {
    setCollapsedReceived((prev) => {
      const next = !prev;
      if (Platform.OS === 'web') localStorage.setItem(COLLAPSE_KEY_RECEIVED, next ? '1' : '0');
      else SecureStore.setItemAsync(COLLAPSE_KEY_RECEIVED, next ? '1' : '0').catch(e => console.error(e));
      return next;
    });
  };

  const toggleCollapsedNotReceived = async () => {
    setCollapsedNotReceived((prev) => {
      const next = !prev;
      if (Platform.OS === 'web') localStorage.setItem(COLLAPSE_KEY_NOT_RECEIVED, next ? '1' : '0');
      else SecureStore.setItemAsync(COLLAPSE_KEY_NOT_RECEIVED, next ? '1' : '0').catch(e => console.error(e));
      return next;
    });
  };

  // --- Branch resolution on mount ---
  useEffect(() => {
    resolveBranchId().then(() => {
      // Query will run automatically
    });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, []);



  // --- Cart operations ---
  const zoomIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 1.05,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const zoomOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const animateButton = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(callback);
  };

  const addOrIncrementCart = (product: StockItem, addQty: number) => {
    const delta = snapQtyToHalfStep(addQty);
    if (delta <= 0) return;

    if (product.quantity <= 0) {
      Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
      return;
    }

    animateButton();
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;
      const nextQty = snapQtyToHalfStep(currentQty + delta);

      if (nextQty <= 0) return prevCart;

      if (nextQty - Number(product.quantity) > 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(product.quantity)} ${product.name} available in stock.`
        );
        return prevCart;
      }

      setQtyInputs((prev) => ({
        ...prev,
        [product.id]: formatQtyForDisplay(nextQty),
      }));

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prevCart, { ...product, quantity: nextQty }];
    });

    console.log('[POS CART] addOrIncrementCart', product.id, product.name, 'delta', delta);
    setOrderModalVisible(true);
  };

  const addToCart = (product: StockItem) => addOrIncrementCart(product, 1);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prevCart => {
      const item = prevCart.find(item => item.id === id);
      if (!item) return prevCart;

      const product = productsQuery.data?.find(p => p.id === id);
      if (!product) return prevCart;

      const newQuantity = snapQtyToHalfStep(item.quantity + delta);

      setQtyInputs((prev) => ({
        ...prev,
        [id]: formatQtyForDisplay(Math.max(newQuantity, 0)),
      }));

      if (newQuantity > Number(product.quantity) + 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(product.quantity)} ${product.name} available in stock.`
        );
        return prevCart;
      }

      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== id);
      }

      return prevCart.map(item =>
        item.id === id
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
  };

  const setItemQuantity = (id: string, rawValue: string) => {
    let clean = rawValue.replace(/[^\d.]/g, '');
    const firstDot = clean.indexOf('.');
    if (firstDot !== -1) {
      clean =
        clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
    }

    setQtyInputs((prev) => ({ ...prev, [id]: clean }));

    if (clean === '' || clean === '.') return;

    const parsed = parseFloat(clean);
    if (Number.isNaN(parsed)) return;

    const nextQty = snapQtyToHalfStep(parsed);

    setCart(prevCart => {
      const item = prevCart.find(i => i.id === id);
      if (!item) return prevCart;

      const product = productsQuery.data?.find(p => p.id === id);
      const maxQty = Number(product?.quantity ?? item.quantity ?? 0);

      if (nextQty <= 0) {
        return prevCart.filter(i => i.id !== id);
      }

      if (nextQty - maxQty > 1e-6) {
        Alert.alert(
          'Insufficient Stock',
          `Only ${formatQtyForDisplay(maxQty)} ${item.name} available in stock.`
        );
        setQtyInputs((prev) => ({ ...prev, [id]: formatQtyForDisplay(maxQty) }));
        return prevCart.map(i => (i.id === id ? { ...i, quantity: maxQty } : i));
      }

      setQtyInputs((prev) => ({ ...prev, [id]: formatQtyForDisplay(nextQty) }));

      return prevCart.map(i => (i.id === id ? { ...i, quantity: nextQty } : i));
    });
  };

  const commitQtyInput = (id: string) => {
    setQtyInputs((prev) => {
      const raw = prev[id];
      if (raw === '') {
        const current = cart.find((c) => c.id === id);
        return { ...prev, [id]: current ? formatQtyForDisplay(current.quantity) : '1' };
      }
      return prev;
    });
  };

  const toggleHalfPortion = (id: string) => {
    setHalfPortions((prev) => {
      const isNowHalf = !prev[id];
      const targetQty = isNowHalf ? 0.5 : 1;
      console.log('[POS HALF] Toggle half portion for', id, '→', isNowHalf, 'qty', targetQty);

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id !== id) return item;
          setQtyInputs((q) => ({ ...q, [id]: formatQtyForDisplay(targetQty) }));
          return { ...item, quantity: targetQty };
        })
      );

      return { ...prev, [id]: isNowHalf };
    });
  };

  const removeFromCart = (id: string, name: string) => {
    Alert.alert(
      'Remove Item',
      `Remove ${name} from cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCart((prevCart) => prevCart.filter((item) => item.id !== id));
            setHalfPortions((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          },
        }
      ]
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart before checking out');
      return;
    }
    if (!cash || Number(cash) < total) {
      Alert.alert('Insufficient Cash', `Please enter at least ₱${total}`);
      return;
    }

    const orderItems = cart.map(item =>
      `${item.name} ×${formatQtyForDisplay(item.quantity)} = ₱${roundMoney(
        item.price * item.quantity
      )}`
    ).join('\n');

    console.log('[POS CHECKOUT] Cart items:', cart);
    console.log('[POS CHECKOUT] Order items string:', orderItems);
    console.log('[POS CHECKOUT] Subtotal:', subtotal);
    console.log('[POS CHECKOUT] Senior discount:', seniorDiscount, 'Discount amount:', discountAmount);
    console.log('[POS CHECKOUT] Total:', total);
    console.log('[POS CHECKOUT] Cash:', cash);
    console.log('[POS CHECKOUT] Change:', change);
    console.log('[POS CHECKOUT] Customer name:', customerName);

    try {
      let user = await loadStaffUser();

      console.log('[POS CHECKOUT] Initial user data:', user);

      if (!user?.id) {
        const connected = await hasNetworkConnection();
        if (connected) {
          try {
            const meResponse = await api.get('/me');
            user = meResponse.data;
            console.log('[POS CHECKOUT] Fetched user from /me:', user);
          } catch (error) {
            console.error('Unable to refresh authenticated user:', error);
          }
        }
      }

      const { user: resolvedUser, branchId: resolvedBranch } = await resolveStaffBranch(user);
      user = resolvedUser ?? user;
      let branch = resolvedBranch;

      console.log('[POS CHECKOUT] Branch ID:', branch);
      console.log('[POS CHECKOUT] Final user ID:', user?.id);

      if (!user?.id || !branch) {
        console.log('[POS CHECKOUT] Missing context - User ID:', user?.id, 'Branch ID:', branch);
        Alert.alert(
          'Missing User Context',
          'Unable to determine staff or branch. Log in online once so your branch is saved on this device.'
        );
        return;
      }

      const salePayload = {
        branch_id: branch,
        user_id: user.id,
        customer_name: customerName || null,
        senior_discount: seniorDiscount,
        cash_collected: Number(cash),
        payment_method: 'cash',
        items: cart.map((item) => ({
          product_id: Number(item.id),
          quantity: snapQtyToHalfStep(item.quantity),
        })),
      };

      await api.post('/sales', salePayload);

      const orderSummary = orderItems || 'No items details available';
      const alertMessage = `${orderSummary}\n\n━━━━━━━━━━━━━━━━\nTotal: ₱${total}\nCash: ₱${cash}\nChange: ₱${change}`;

      console.log('[POS CHECKOUT] Alert message:', alertMessage);

      Alert.alert(
        'Order Complete!',
        alertMessage,
        [{ text: 'New Order' }]
      );
      setCart([]);
      setCash('');
      setCustomerName('');
      setSeniorDiscount(false);
      setHalfPortions({});
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (error: any) {
      Alert.alert('Checkout Failed', error?.response?.data?.message || 'Failed to save sale to backend.');
    }
  };

  const handleCancelOrder = () => {
    if (cart.length === 0) return;
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes', style: 'destructive', onPress: () => {
            setCart([]);
            setCash('');
            setCustomerName('');
            setSeniorDiscount(false);
            setHalfPortions({});
          }
        }
      ]
    );
  };

  const quickAddAmounts = [50, 100, 200, 500, 1000];

  const renderCartItem = ({ item }: { item: typeof cart[0] }) => {
    const isHalf = !!halfPortions[item.id];
    const lineTotal = roundMoney(item.price * item.quantity);

    return (
      <View style={{ borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER, paddingVertical: 8 }}>
        <View className="flex-row items-center">
          <View style={{ backgroundColor: COLORS.ACCENT_WARM, padding: 8, borderRadius: 999, marginRight: 8 }}>
            <Icon name={item.icon} size={14} color={COLORS.PRIMARY_RED} />
          </View>

          <View className="flex-1 mr-2">
            <Text style={{ fontWeight: '600', fontSize: 14, color: COLORS.TEXT_PRIMARY }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 11 }} numberOfLines={1}>
              ₱{item.price} × {formatQtyForDisplay(item.quantity)} ={' '}
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: 'bold' }}>₱{lineTotal}</Text>
            </Text>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => updateQuantity(item.id, -QTY_STEP)}
              className="bg-orange-100 w-7 h-7 rounded-full items-center justify-center"
            >
              <Icon name="remove" size={14} color="#F97316" />
            </TouchableOpacity>
            <View style={{ backgroundColor: COLORS.INPUT_BG, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, marginHorizontal: 4, minWidth: 40, alignItems: 'center' }}>
              <TextInput
                style={{ fontWeight: 'bold', fontSize: 14, color: COLORS.TEXT_PRIMARY, textAlign: 'center', width: 40, paddingVertical: 0 }}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                value={qtyInputs[item.id] ?? formatQtyForDisplay(item.quantity)}
                onChangeText={(v) => {
                  setHalfPortions((prev) => ({ ...prev, [item.id]: false }));
                  setItemQuantity(item.id, v);
                }}
                onBlur={() => commitQtyInput(item.id)}
              />
            </View>
            <TouchableOpacity
              onPress={() => updateQuantity(item.id, QTY_STEP)}
              className="bg-green-100 w-7 h-7 rounded-full items-center justify-center"
            >
              <Icon name="add" size={14} color="#10B981" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => removeFromCart(item.id, item.name)}
            style={{ backgroundColor: COLORS.STATUS_REJECTED_BG, padding: 6, borderRadius: 8, marginLeft: 8 }}
          >
            <Icon name="delete" size={14} color={COLORS.STATUS_REJECTED_TEXT} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => toggleHalfPortion(item.id)}
          activeOpacity={0.75}
          className={`self-start mt-1.5 ml-9 flex-row items-center px-2 py-1 rounded-lg border ${isHalf ? 'bg-amber-100 border-amber-300' : 'bg-gray-100 border-gray-300'
            }`}
        >
          <View
            className={`w-3.5 h-3.5 rounded-sm items-center justify-center mr-1.5 border ${isHalf ? 'bg-amber-500 border-amber-500' : 'bg-gray-300 border-gray-400'
              }`}
          >
            {isHalf && <Icon name="check" size={10} color="white" />}
          </View>
          <Text className={`font-bold text-[11px] ${isHalf ? 'text-amber-700' : 'text-gray-600'}`}>
            ½ Portion
          </Text>
          {isHalf && (
            <View className="ml-1.5 bg-amber-200 px-1.5 py-0.5 rounded-full">
              <Text className="text-amber-800 text-[9px] font-bold">½ price</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // --- Computed values ---
  const products = productsQuery.data || [];
  const filtered = selectedCategory === 'All' ? products : products.filter(p => p.category === selectedCategory);
  const hasPending = queryClient.getQueryData(['pendingStock']) || false;
  const subtotal = cart.reduce((sum, item) => sum + roundMoney(item.price * item.quantity), 0);
  const discountAmount = seniorDiscount ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = Math.max(subtotal - discountAmount, 0);
  const change = cash ? Math.max(Number(cash) - total, 0) : 0;

  // --- Loading / error states ---
  if (productsQuery.isLoading && !productsQuery.data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ fontSize: 18, color: COLORS.TEXT_SECONDARY, marginTop: 16 }}>Loading POS System...</Text>
      </View>
    );
  }
  if (productsQuery.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 18, color: COLORS.PRIMARY_RED }}>Failed to load products</Text>
        <TouchableOpacity onPress={() => productsQuery.refetch()} style={{ marginTop: 16 }}>
          <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Retry</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // --- JSX ---
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1">
        <ScrollView
          style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await productsQuery.refetch();
                setRefreshing(false);
              }}
              colors={[COLORS.PRIMARY_RED]}
              tintColor={COLORS.PRIMARY_RED}
            />
          }
        >
          <StatusBar style="dark" />

          <Animated.View className="flex-1" style={{ opacity: fadeAnim }}>
            {/* HEADER */}
            <LinearGradient colors={GRADIENT.HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 48, paddingBottom: 40, paddingHorizontal: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
              <View style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ position: 'absolute', bottom: 10, left: -30, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' }} />
              <View style={{ position: 'absolute', top: 30, left: '60%', width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <View className="flex-row items-center justify-center mb-2">
                <Icon name="restaurant" size={32} color="white" />
                <Text className="text-3xl font-bold text-white ml-2">
                  New Moon Lechon
                </Text>
              </View>
              <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' }}>
                Point of Sales System
              </Text>
            </LinearGradient>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              className="flex-1"
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, minHeight: screenHeight, paddingBottom: Math.max(120, insets.bottom + 100) }}
                keyboardShouldPersistTaps="handled"
              >
                <View className="p-5">
                  {/* Ongoing Stocks Button */}
                  <TouchableOpacity
                    onPress={loadOngoingStocks}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 }}>
                      <View className="flex-row items-center justify-center relative">
                        <Icon name="inventory" size={20} color="white" />
                        <Text className="text-white font-bold text-base ml-2">Ongoing Stocks</Text>
                        {hasPending && (
                        <View
                          style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: '#EF4444',
                            borderWidth: 2,
                            borderColor: 'rgba(255,255,255,0.9)',
                          }}
                        />
                      )}
                    </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Category Filter - Only "All" category */}
                  <View className="mb-6">
                    <ScrollView
                      ref={categoryScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="flex-row"
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category}
                          onPress={() => setSelectedCategory(category)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 12,
                            marginRight: 12,
                            borderWidth: 1,
                            backgroundColor: selectedCategory === category ? COLORS.PRIMARY_RED : COLORS.CARD_BG,
                            borderColor: selectedCategory === category ? COLORS.PRIMARY_RED : COLORS.CARD_BORDER,
                            shadowColor: selectedCategory === category ? COLORS.PRIMARY_RED : '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: selectedCategory === category ? 0.2 : 0.06,
                            shadowRadius: 3,
                            elevation: selectedCategory === category ? 3 : 1,
                          }}
                        >
                          <Text style={{ fontWeight: '600', fontSize: 14, color: selectedCategory === category ? '#FFFFFF' : COLORS.TEXT_PRIMARY }}>
                            All Items
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Menu Grid */}
                  <View style={[CARD, { padding: 20, marginBottom: 16 }]}>
                    <View className="flex-row items-center justify-between mb-5">
                      <View className="flex-row items-center">
                        <Icon name="restaurant-menu" size={24} color={COLORS.PRIMARY_RED} />
                        <Text style={{ fontWeight: 'bold', fontSize: 20, marginLeft: 8, color: COLORS.TEXT_PRIMARY }}>Menu</Text>
                      </View>
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14 }}>{filtered.length} items</Text>
                    </View>
                    <FlatList
                      data={filtered}
                      keyExtractor={(item) => item.id}
                      numColumns={2}
                      scrollEnabled={false}
                      columnWrapperStyle={{ justifyContent: 'space-between', gap: 12 }}
                      contentContainerStyle={{ paddingBottom: 8 }}
                      renderItem={({ item }) => (
                        <View className="w-[48%] mb-4">
                          <TouchableOpacity
                            onPress={() => addToCart(item)}
                            style={{
                              padding: 16,
                              borderRadius: 16,
                              alignItems: 'center',
                              borderWidth: 1,
                              backgroundColor: item.quantity <= 0 ? COLORS.CARD_BG : COLORS.CARD_BG,
                              borderColor: item.quantity <= 0 ? COLORS.CARD_BORDER : COLORS.CARD_BORDER,
                              opacity: item.quantity <= 0 ? 0.5 : 1,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.05,
                              shadowRadius: 4,
                              elevation: 2,
                            }}
                            activeOpacity={item.quantity <= 0 ? 1 : 0.7}
                            disabled={item.quantity <= 0}
                          >
                            {item.image ? (
                              <Image
                                source={{ uri: api.defaults?.baseURL ? `${api.defaults.baseURL.replace('/api', '')}/storage/${item.image}` : '' }}
                                className="w-full aspect-square rounded-lg mb-3"
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={{ backgroundColor: COLORS.ACCENT_WARM, padding: 16, borderRadius: 999, marginBottom: 12 }}>
                                <Icon name={item.icon} size={28} color={COLORS.PRIMARY_RED} />
                              </View>
                            )}
                            {/* Stock badge - always visible */}
                            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: COLORS.CARD_BORDER }}>
                              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 10, fontWeight: 'bold' }}>
                                Stock: {formatQtyForDisplay(item.quantity)}
                              </Text>
                            </View>
                            {item.popular && item.quantity > 0 && (
                              <View className="absolute top-2 right-2 bg-orange-500 px-2 py-1 rounded-full flex-row items-center">
                                <Icon name="local-fire-department" size={10} color="white" />
                                <Text className="text-white text-[10px] font-bold ml-1">BESTSELLER</Text>
                              </View>
                            )}
                            {item.quantity <= 0 && (
                              <View className="absolute top-2 right-2 bg-red-500 px-2 py-1 rounded-full">
                                <Text className="text-white text-[10px] font-bold">OUT OF STOCK</Text>
                              </View>
                            )}
                            <Text style={{ fontWeight: 'bold', textAlign: 'center', fontSize: 16, color: COLORS.TEXT_PRIMARY, marginBottom: 4 }} numberOfLines={2}>{item.name}</Text>
                            <View style={{ backgroundColor: COLORS.STATUS_APPROVED_BG, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                              <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontWeight: 'bold', fontSize: 18 }}>₱{item.price}</Text>
                            </View>
                            {item.quantity <= 10 && item.quantity > 0 && (
                              <View className="flex-row items-center mt-2">
                                <Icon name="warning" size={12} color="#F59E0B" />
                                <Text className="text-orange-500 text-xs ml-1">
                                  Only {formatQtyForDisplay(item.quantity)} left!
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          {item.quantity > 0 && (
                            <TouchableOpacity
                              onPress={() => addOrIncrementCart(item, QTY_STEP)}
                              className="mt-2 bg-amber-50 border border-amber-200 py-2 rounded-xl items-center"
                              activeOpacity={0.7}
                            >
                              <Text className="text-amber-900 font-bold text-sm">+ ½</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    />
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </ScrollView>

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <View style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: Math.max(insets.bottom + 90, 16) // Increased from 70 to 90 for more space
          }}>
            <TouchableOpacity
              onPress={() => setOrderModalVisible(true)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }}>
                <View className="flex-row items-center justify-between px-5">
                  <View className="flex-row items-center">
                    <View className="bg-white/20 p-2 rounded-xl mr-3">
                      <Icon name="shopping-cart" size={18} color="white" />
                    </View>
                    <View>
                      <Text className="text-white font-bold text-base">View Order</Text>
                      <Text className="text-white/80 text-xs">{cart.length} item(s)</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-white font-bold text-lg mr-2">₱{total}</Text>
                    <Icon name="chevron-right" size={24} color="white" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Summary Modal */}
        <Modal
          visible={orderModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setOrderModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/50 justify-end">
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className="bg-white rounded-t-3xl h-[96%]">
                  {/* Header */}
                  <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View className="flex-row items-center">
                      <Icon name="receipt-long" size={22} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">Order Summary</Text>
                    </View>
                    <TouchableOpacity onPress={() => setOrderModalVisible(false)}>
                      <Icon name="close" size={26} color="white" />
                    </TouchableOpacity>
                  </LinearGradient>

                  <View className="flex-1">
                    {cart.length > 0 && (
                      <View className="px-4 pt-3 pb-2 flex-row justify-between items-center">
                        <View className="bg-red-100 px-3 py-1 rounded-full">
                          <Text className="text-red-600 text-xs font-semibold">
                            {cart.length} {cart.length === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={handleCancelOrder} className="bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          <View className="flex-row items-center">
                            <Icon name="delete-sweep" size={16} color="#DC2626" />
                            <Text className="text-red-600 font-bold text-xs ml-1">Clear</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}

                    <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
                      {cart.length === 0 ? (
                        <View className="py-14 items-center">
                          <View className="bg-gray-100 p-4 rounded-full mb-4">
                            <Icon name="shopping-cart" size={40} color="#9CA3AF" />
                          </View>
                          <Text className="text-gray-500 text-center font-medium">Your cart is empty</Text>
                          <Text className="text-gray-400 text-xs text-center mt-1">Tap on items to add</Text>
                        </View>
                      ) : (
                        <>
                          <View className="flex-row items-center mb-2 gap-2">
                            <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl">
                              <View className="px-2">
                                <Icon name="person" size={16} color="#6B7280" />
                              </View>
                              <TextInput
                                className="flex-1 py-2 pr-2 text-sm text-gray-800"
                                placeholder="Customer name"
                                placeholderTextColor="#9CA3AF"
                                value={customerName}
                                onChangeText={setCustomerName}
                              />
                            </View>
                            <TouchableOpacity
                              onPress={() => setSeniorDiscount((p) => !p)}
                              activeOpacity={0.85}
                              className={`flex-row items-center px-2.5 py-2 rounded-xl border ${seniorDiscount ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                              <View
                                className={`w-4 h-4 rounded-sm items-center justify-center mr-1.5 border ${seniorDiscount ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'
                                  }`}
                              >
                                {seniorDiscount && <Icon name="check" size={11} color="white" />}
                              </View>
                              <Text className={`text-[11px] font-bold ${seniorDiscount ? 'text-green-700' : 'text-gray-600'}`}>
                                Senior 20%
                              </Text>
                              {seniorDiscount && (
                                <Text className="text-green-700 text-[11px] font-bold ml-1">-₱{discountAmount}</Text>
                              )}
                            </TouchableOpacity>
                          </View>

                          <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 16, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.DIVIDER }}>
                            {cart.map((item) => (
                              <View key={item.id}>
                                {renderCartItem({ item })}
                              </View>
                            ))}
                          </View>
                          <View style={{ height: 8 }} />
                        </>
                      )}
                    </ScrollView>

                    {cart.length > 0 && (
                      <View className="px-3 pt-2 border-t border-gray-200" style={{ paddingBottom: Math.max(10, insets.bottom + 8) }}>
                        <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text className="text-white/90 text-[10px] font-semibold uppercase tracking-wider">Total</Text>
                            <Text className="text-white font-bold text-xl">₱{total}</Text>
                          </View>
                          {seniorDiscount ? (
                            <Text className="text-white/90 text-[11px]">-₱{discountAmount} of ₱{subtotal}</Text>
                          ) : null}
                        </LinearGradient>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" nestedScrollEnabled={true}>
                          <View className="flex-row">
                            {quickAddAmounts.map((amount) => (
                              <TouchableOpacity
                                key={amount}
                                onPress={() => setCash(amount.toString())}
                                className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg mr-2"
                              >
                                <Text className="text-red-600 font-bold text-xs">₱{amount}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>

                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                          <View className="flex-row items-center bg-white border-2 rounded-xl" style={{ borderColor: COLORS.INPUT_BORDER }}>
                            <View className="bg-red-600 px-2.5 py-2 rounded-l-xl">
                              <Icon name="attach-money" size={16} color="white" />
                            </View>
                            <TextInput
                              className="flex-1 px-3 py-2 text-sm text-gray-800"
                              placeholder="Cash amount"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              value={cash.toString()}
                              onChangeText={(value) => setCash(value)}
                              onFocus={zoomIn}
                              onBlur={zoomOut}
                            />
                            {cash && Number(cash) >= total && (
                              <View className="bg-green-500 px-3 py-2 rounded-r-xl">
                                <Text className="text-white font-bold text-xs">Change ₱{change}</Text>
                              </View>
                            )}
                          </View>
                        </Animated.View>

                        {cash && Number(cash) < total && Number(cash) > 0 && (
                          <View className="bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg mt-2 flex-row items-center justify-center">
                            <Icon name="error-outline" size={14} color="#DC2626" />
                            <Text className="text-red-600 text-xs ml-1.5 font-medium">
                              Need ₱{total - Number(cash)} more
                            </Text>
                          </View>
                        )}

                        <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
                          <TouchableOpacity
                            onPress={handleCheckout}
                            activeOpacity={0.85}
                          >
                            <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 12, marginTop: 8, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5, flexDirection: 'row', justifyContent: 'center' }}>
                              <Icon name="check-circle" size={18} color="white" />
                              <Text className="text-white font-bold text-sm ml-2">Complete Order</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>
                      </View>
                    )}
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Ongoing Stocks Modal */}
        <Modal
          visible={ongoingStocksModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setOngoingStocksModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setOngoingStocksModalVisible(false)}>
            <View className="flex-1 bg-black/50 justify-end">
              <TouchableWithoutFeedback>
                <View style={{ backgroundColor: COLORS.CARD_BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' }}>
                  {/* Header */}
                  <LinearGradient colors={GRADIENT.PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View className="flex-row items-center">
                      <Icon name="inventory" size={22} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">Ongoing Stocks</Text>
                    </View>
                    <TouchableOpacity onPress={() => setOngoingStocksModalVisible(false)}>
                      <Icon name="close" size={26} color="white" />
                    </TouchableOpacity>
                  </LinearGradient>

                  <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
                    {ongoingStocks.length === 0 ? (
                      <View className="py-14 items-center">
                        <View style={{ backgroundColor: COLORS.ACCENT_WARM, padding: 16, borderRadius: 999, marginBottom: 16 }}>
                          <Icon name="inventory" size={40} color={COLORS.PRIMARY_RED} />
                        </View>
                        <Text style={{ color: COLORS.TEXT_SECONDARY, textAlign: 'center', fontWeight: '500', fontSize: 17 }}>No ongoing stocks</Text>
                        <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, textAlign: 'center', marginTop: 4 }}>All deliveries have been received</Text>
                      </View>
                    ) : (
                      <>
                        {/* Received Section */}
                        {(() => {
                          const allReceivedDeliveries: { delivery: StockDelivery; product: StockItem }[] = [];
                          ongoingStocks.forEach(product => {
                            (product.ongoing_stocks || []).forEach(d => {
                              if (d.received_at) {
                                allReceivedDeliveries.push({ delivery: d, product });
                              }
                            });
                          });

                          return allReceivedDeliveries.length > 0 ? (
                            <View className="mb-4">
                              <TouchableOpacity
                                onPress={toggleCollapsedReceived}
                                className="flex-row justify-between items-center bg-green-50 px-3 py-2 rounded-xl mb-2"
                              >
                                <View className="flex-row items-center">
                                  <Icon name="check-circle" size={18} color="#10B981" />
                                  <Text className="text-green-700 font-bold text-sm ml-2">Received</Text>
                                  <Text className="text-green-600 text-xs ml-2 bg-green-100 px-2 py-0.5 rounded-full">
                                    {allReceivedDeliveries.length}
                                  </Text>
                                </View>
                                <Icon
                                  name={collapsedReceived ? "chevron-right" : "expand-more"}
                                  size={20}
                                  color="#10B981"
                                />
                              </TouchableOpacity>

                                  {!collapsedReceived && (
                                    <View className="ml-2">
                                      {allReceivedDeliveries.map(({ delivery, product }) => (
                                        <View key={delivery.id} style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.STATUS_APPROVED_BG }}>
                                          <View className="flex-row justify-between items-start">
                                            <View className="flex-1">
                                              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: 'bold', fontSize: 14 }}>{product.name}</Text>
                                              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>
                                                Restocked {formatRestockDate(delivery.restocked_at)}
                                              </Text>
                                            </View>
                                            <View style={{ backgroundColor: COLORS.STATUS_APPROVED_BG, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                              <Text style={{ color: COLORS.STATUS_APPROVED_TEXT, fontSize: 12, fontWeight: 'bold' }}>
                                                {delivery.quantity} pcs
                                              </Text>
                                            </View>
                                          </View>
                                          <View className="flex-row justify-between items-center mt-1">
                                            <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>
                                              Received {formatRestockDate(delivery.received_at)}
                                            </Text>
                                            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 10 }}>Stock: {product.quantity}</Text>
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                            </View>
                          ) : null;
                        })()}

                        {/* Flatten deliveries for individual rendering */}
                        {(() => {
                          const allPendingDeliveries: { delivery: StockDelivery; product: StockItem }[] = [];
                          const allNotReceivedDeliveries: { delivery: StockDelivery; product: StockItem }[] = [];

                          ongoingStocks.forEach(product => {
                            (product.ongoing_stocks || []).forEach(d => {
                              if (!d.received_at && !d.marked_as_not_received) {
                                allPendingDeliveries.push({ delivery: d, product });
                              }
                              if (d.marked_as_not_received) {
                                allNotReceivedDeliveries.push({ delivery: d, product });
                              }
                            });
                          });

                          return (
                            <>
                              {/* Pending Section */}
                              {allPendingDeliveries.length > 0 && (
                                <View className="mb-4">
                                  <TouchableOpacity
                                    onPress={toggleCollapsedNotReceived}
                                    className="flex-row justify-between items-center bg-blue-50 px-3 py-2 rounded-xl mb-2"
                                  >
                                    <View className="flex-row items-center">
                                      <Icon name="pending" size={18} color="#3B82F6" />
                                      <Text className="text-blue-700 font-bold text-sm ml-2">Pending</Text>
                                      <Text className="text-blue-600 text-xs ml-2 bg-blue-100 px-2 py-0.5 rounded-full">
                                        {allPendingDeliveries.length}
                                      </Text>
                                    </View>
                                    <Icon
                                      name={collapsedNotReceived ? "chevron-right" : "expand-more"}
                                      size={20}
                                      color="#3B82F6"
                                    />
                                  </TouchableOpacity>

                                  {!collapsedNotReceived && (
                                    <View className="ml-2">
                                      {allPendingDeliveries.map(({ delivery, product }) => (
                                        <View key={delivery.id} style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.STATUS_INFO_BG }}>
                                          <View className="flex-row justify-between items-start">
                                            <View className="flex-1">
                                              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: 'bold', fontSize: 14 }}>{product.name}</Text>
                                              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>
                                                Restocked {formatRestockDate(delivery.restocked_at)}
                                              </Text>
                                            </View>
                                            <View style={{ backgroundColor: COLORS.STATUS_INFO_BG, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                              <Text style={{ color: COLORS.STATUS_INFO_TEXT, fontSize: 12, fontWeight: 'bold' }}>
                                                {delivery.quantity} pcs
                                              </Text>
                                            </View>
                                          </View>
                                          <View className="flex-row justify-end mt-2 gap-2">
                                            <TouchableOpacity
                                              onPress={() => markAsReceived(product)}
                                              className="bg-green-500 px-3 py-1.5 rounded-lg"
                                            >
                                              <View className="flex-row items-center">
                                                <Icon name="check" size={14} color="white" />
                                                <Text className="text-white font-bold text-xs ml-1">Receive</Text>
                                              </View>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              onPress={() => markAsNotReceived(product)}
                                              className="bg-red-500 px-3 py-1.5 rounded-lg"
                                            >
                                              <View className="flex-row items-center">
                                                <Icon name="close" size={14} color="white" />
                                                <Text className="text-white font-bold text-xs ml-1">Not Received</Text>
                                              </View>
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              )}

                              {/* Not Received Section */}
                              {allNotReceivedDeliveries.length > 0 && (
                                <View className="mb-4">
                                  <TouchableOpacity
                                    onPress={toggleCollapsedNotReceived}
                                    className="flex-row justify-between items-center bg-red-50 px-3 py-2 rounded-xl mb-2"
                                  >
                                    <View className="flex-row items-center">
                                      <Icon name="cancel" size={18} color="#EF4444" />
                                      <Text className="text-red-700 font-bold text-sm ml-2">Not Received</Text>
                                      <Text className="text-red-600 text-xs ml-2 bg-red-100 px-2 py-0.5 rounded-full">
                                        {allNotReceivedDeliveries.length}
                                      </Text>
                                    </View>
                                    <Icon
                                      name={collapsedNotReceived ? "chevron-right" : "expand-more"}
                                      size={20}
                                      color="#EF4444"
                                    />
                                  </TouchableOpacity>

                                  {!collapsedNotReceived && (
                                    <View className="ml-2">
                                      {allNotReceivedDeliveries.map(({ delivery, product }) => (
                                        <View key={delivery.id} style={{ backgroundColor: COLORS.INPUT_BG, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.STATUS_REJECTED_BG }}>
                                          <View className="flex-row justify-between items-start">
                                            <View className="flex-1">
                                              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: 'bold', fontSize: 14 }}>{product.name}</Text>
                                              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>
                                                Restocked {formatRestockDate(delivery.restocked_at)}
                                              </Text>
                                            </View>
                                            <View style={{ backgroundColor: COLORS.STATUS_REJECTED_BG, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                                              <Text style={{ color: COLORS.STATUS_REJECTED_TEXT, fontSize: 12, fontWeight: 'bold' }}>
                                                {delivery.quantity} pcs
                                              </Text>
                                            </View>
                                          </View>
                                          <View className="flex-row justify-between items-center mt-1">
                                            {delivery.not_received_at && (
                                              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 10 }}>
                                                Reported: {new Date(delivery.not_received_at).toLocaleDateString()}
                                              </Text>
                                            )}
                                          </View>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}