import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/authContext';
import { useCart } from '../../../../context/cartContext';
import { useAddress } from '../../../../context/addressContext';
import {
  CustomerBranch,
  getSelectedBranch,
  saveSelectedBranch,
} from '../../../../lib/customerBranchStorage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AddressModal from '../AddressModal';

type ProductStock = {
  branch_id: number | string;
  quantity: number;
};

type MenuProduct = {
  id: number;
  name: string;
  price: number | string;
  description?: string | null;
  image?: string | null;
  product_stocks?: ProductStock[];
  stocks?: ProductStock[];
};

function formatPrice(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₱0.00';
  return `₱${amount.toFixed(2)}`;
}

async function fetchAllBranches(): Promise<CustomerBranch[]> {
  const branches: CustomerBranch[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/branches', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    branches.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return branches;
}

async function fetchAllProducts(): Promise<MenuProduct[]> {
  const products: MenuProduct[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/products', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    products.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return products;
}

function getBranchStock(product: MenuProduct, branchId: number): ProductStock | undefined {
  const stocks = product.product_stocks ?? product.stocks ?? [];
  return stocks.find((stock) => String(stock.branch_id) === String(branchId));
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<CustomerBranch | null>(null);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addressModalVisible, openAddressModal, closeAddressModal, selectedAddress, setSelectedAddress } = useAddress();
  const { items: cartItems, itemCount, subtotal, addItem } = useCart();

  const displayName = user?.firstname?.trim() || user?.username || 'Customer';
  const userInitial = displayName.charAt(0).toUpperCase();

  const branchProducts = useMemo(() => {
    if (!selectedBranch) return [];
    return products.filter((product) => {
      const stock = getBranchStock(product, selectedBranch.id);
      return stock && Number(stock.quantity) > 0;
    });
  }, [products, selectedBranch]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return branchProducts;
    const query = searchQuery.toLowerCase().trim();
    return branchProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
    );
  }, [branchProducts, searchQuery]);

  const loadData = useCallback(async () => {
    const [branchList, productList, savedBranch] = await Promise.all([
      fetchAllBranches(),
      fetchAllProducts(),
      getSelectedBranch(),
    ]);

    setBranches(branchList);
    setProducts(productList);

    const savedStillValid = savedBranch && branchList.some((branch) => branch.id === savedBranch.id);
    const nextBranch = savedStillValid ? savedBranch : branchList[0] ?? null;
    setSelectedBranch(nextBranch);
    if (nextBranch) {
      await saveSelectedBranch(nextBranch);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        Alert.alert('Error', 'Unable to load branches. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch {
      Alert.alert('Error', 'Unable to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectBranch = async (branch: CustomerBranch) => {
    setSelectedBranch(branch);
    await saveSelectedBranch(branch);
    setBranchModalVisible(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
            router.replace('/Login');
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const renderBranchItem = ({ item }: { item: CustomerBranch }) => {
    const isSelected = selectedBranch?.id === item.id;
    return (
      <TouchableOpacity
        className={`flex-row items-center px-5 py-4 ${
          isSelected ? 'bg-yellow-50' : ''
        }`}
        onPress={() => handleSelectBranch(item)}
      >
        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3">
          <Icon name="store" size={24} color="#F59E0B" />
        </View>
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
          {item.address && (
            <Text className="text-sm text-gray-500 mt-1">{item.address}</Text>
          )}
          {item.phone && (
            <Text className="text-xs text-gray-400 mt-0.5">{item.phone}</Text>
          )}
        </View>
        {isSelected ? (
          <Icon name="check-circle" size={24} color="#f0c239" />
        ) : (
          <Icon name="chevron-right" size={20} color="#9CA3AF" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 text-base mt-4">Loading your menu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#FBBF24" />
      
      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#f49110']}
            tintColor="#F59E0B"
          />
        }
      >
        {/* Header - Yellow (matches photo) */}
        <View className="bg-[#fbbf24] pt-12 pb-6 px-6 rounded-b-3xl">
          {/* Welcome Section */}
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-1">
              <Text className="text-yellow-900/80 text-xs font-medium tracking-wider uppercase">
                Good Morning
              </Text>
              <Text className="text-yellow-900 text-3xl font-bold mt-0.5">
                {displayName} 👋
              </Text>
              <Text className="text-yellow-900/70 text-sm mt-1">
                Rise And Shine! It's Chicken Time! 🍗
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity 
                className="w-12 h-12 rounded-full bg-white items-center justify-center"
                onPress={() => router.push('/Customer/Profile' as unknown as any)}
              >
                <Text className="text-yellow-900 font-bold text-xl">
                  {userInitial}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-white items-center justify-center"
                onPress={() => router.push('/Customer/Cart' as unknown as any)}
              >
                <Ionicons name="cart-outline" size={24} color="#78350F" />
                {itemCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
                    <Text className="text-white text-[10px] font-bold">{itemCount > 99 ? '99+' : itemCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="w-12 h-12 rounded-full bg-white items-center justify-center"
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <ActivityIndicator size="small" color="#78350F" />
                ) : (
                  <Ionicons name="log-out-outline" size={24} color="#78350F" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View className="bg-white rounded-xl px-4 py-1 flex-row items-center mt-2" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <Ionicons name="search-outline" size={22} color="#6B7280" />
            <TextInput
              className="flex-1 ml-2 text-base text-gray-800 py-3"
              placeholder="Search for lechon manok, liempo, drinks.."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Address Selector */}
        <TouchableOpacity
          className="flex-row items-center bg-white mx-6 -mt-3 px-4 py-3 rounded-xl border border-gray-100"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
          onPress={openAddressModal}
          activeOpacity={0.7}
        >
          <View className="w-10 h-10 rounded-full bg-yellow-50 items-center justify-center mr-3">
            <Ionicons name="location-outline" size={20} color="#F59E0B" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">DELIVERY ADDRESS</Text>
            <Text className="text-gray-800 text-sm font-semibold mt-0.5" numberOfLines={1}>
              {selectedAddress
                ? [selectedAddress.street, selectedAddress.barangay, selectedAddress.city, selectedAddress.province].filter(Boolean).join(', ')
                : selectedBranch ? selectedBranch.name : 'Set delivery address'}
            </Text>
          </View>
          <Text className="text-yellow-600 text-sm font-semibold">Change</Text>
        </TouchableOpacity>

        {/* Branch Selector */}
        <TouchableOpacity
          className="flex-row items-center bg-white mx-6 mt-3 px-4 py-3 rounded-xl border border-gray-100"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
          onPress={() => setBranchModalVisible(true)}
          activeOpacity={0.7}
        >
          <View className="w-10 h-10 rounded-full bg-yellow-50 items-center justify-center mr-3">
            <Ionicons name="storefront-outline" size={20} color="#F59E0B" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">BRANCH</Text>
            <Text className="text-gray-800 text-sm font-semibold mt-0.5" numberOfLines={1}>
              {selectedBranch ? selectedBranch.name : 'Select a branch'}
            </Text>
          </View>
          <Text className="text-yellow-600 text-sm font-semibold">Change</Text>
        </TouchableOpacity>

        {!selectedBranch ? (
          <View className="items-center px-8 py-16">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="storefront-outline" size={48} color="#9CA3AF" />
            </View>
            <Text className="text-xl font-bold text-gray-800">
              No Branch Selected
            </Text>
            <Text className="text-base text-gray-500 text-center mt-2">
              Tap the branch selector above to choose a branch
            </Text>
          </View>
        ) : (
          <>
            {/* Featured Dish */}
            <View className="mx-6 mt-4">
              <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                <ImageBackground
                  source={require('../../../../assets/images/logooos.jpg')}
                  className="w-full h-48"
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
                    className="flex-1 justify-between p-5"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="bg-red-500 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold">30% OFF</Text>
                      </View>
                      <View className="flex-row gap-1">
                        <TouchableOpacity className="w-8 h-8 bg-white/20 rounded-full items-center justify-center">
                          <Ionicons name="heart-outline" size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity className="w-8 h-8 bg-white/20 rounded-full items-center justify-center">
                          <Ionicons name="share-outline" size={18} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View>
                      <Text className="text-white text-2xl font-bold">
                        NewMoon Lechon Manok
                      </Text>
                      <Text className="text-white/80 text-sm mt-1">
                        Experience our delicious Chicken
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <Text className="text-white text-xl font-bold">250</Text>
                        <Text className="text-white/60 text-sm line-through ml-2">$300</Text>
                        <View className="bg-white/20 px-3 py-1 rounded-full ml-3">
                          <Text className="text-white text-xs">Best Seller</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </View>
            </View>

            {/* Recommended Section */}
            <View className="mt-6 px-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">Recommended</Text>
                <TouchableOpacity>
                  <Text className="text-yellow-600 font-semibold">View All</Text>
                </TouchableOpacity>
              </View>

              {/* Menu Items - Grid Style */}
              {filteredProducts.length === 0 ? (
                <View className="bg-white rounded-xl p-8 items-center border border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                  <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
                  <Text className="text-gray-800 text-base font-medium mt-3 text-center">
                    {searchQuery.trim() ? 'No items match your search' : 'No items available'}
                  </Text>
                  {searchQuery.trim() && (
                    <Text className="text-gray-500 text-sm text-center mt-1">
                      Try adjusting your search terms
                    </Text>
                  )}
                </View>
              ) : (
                <View className="flex-row flex-wrap justify-between">
                  {filteredProducts.map((item, index) => {
                    const stock = getBranchStock(item, selectedBranch.id);
                    const quantity = stock ? Number(stock.quantity) : 0;
                    const isBestSeller = index < 2;

                    return (
                      <View
                        key={item.id}
                        className="bg-white rounded-xl mb-4 border border-gray-100 overflow-hidden"
                        style={{ width: '48%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                      >
                        {isBestSeller && (
                          <View className="bg-red-500 px-3 py-0.5 self-start rounded-br-lg">
                            <Text className="text-white text-[10px] font-bold tracking-wider">
                              BEST SELLER
                            </Text>
                          </View>
                        )}
                        
                        <View className="p-3">
                          {item.image ? (
                            <Image
                              source={{ uri: `${(api.defaults?.baseURL ?? '').replace('/api', '')}/storage/${item.image}` }}
                              className="w-full h-28 rounded-lg"
                              resizeMode="cover"
                            />
                          ) : (
                            <View className="w-full h-28 bg-gray-100 rounded-lg items-center justify-center">
                              <Ionicons name="restaurant-outline" size={32} color="#9CA3AF" />
                            </View>
                          )}
                          
                          <Text className="text-sm font-bold text-gray-800 mt-2" numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.description && (
                            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                              {item.description}
                            </Text>
                          )}
                          
                          <View className="flex-row items-center justify-between mt-2">
                            <Text className="text-base font-bold text-yellow-600">
                              {formatPrice(item.price)}
                            </Text>
                            
                            <TouchableOpacity
                              className={`w-7 h-7 rounded-full items-center justify-center ${
                                quantity > 0 ? 'bg-yellow-400' : 'bg-gray-200'
                              }`}
                              disabled={quantity <= 0}
                              onPress={() => addItem(
                                item.id,
                                item.name,
                                Number(item.price),
                                selectedBranch!.id,
                                selectedBranch!.name,
                                item.image
                              )}
                            >
                              <Ionicons 
                                name="add" 
                                size={18} 
                                color={quantity > 0 ? "#78350F" : "#9CA3AF"} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

          </>
        )}
      </ScrollView>

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[80%]">
            <View className="flex-row justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <View>
                <Text className="text-xl font-bold text-gray-800">
                  Select Branch
                </Text>
                <Text className="text-sm text-gray-500">
                  Choose where to order from
                </Text>
              </View>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                onPress={() => setBranchModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {branches.length === 0 ? (
              <View className="p-8 items-center">
                <Ionicons name="storefront-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 text-base mt-3">
                  No active branches found
                </Text>
              </View>
            ) : (
              <FlatList
                data={branches}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderBranchItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Address Modal */}
      <AddressModal
        visible={addressModalVisible}
        onClose={closeAddressModal}
        onSelect={(addr) => {
          setSelectedAddress(addr);
          closeAddressModal();
        }}
        selectedAddress={selectedAddress}
      />

    </SafeAreaView>
  );
}