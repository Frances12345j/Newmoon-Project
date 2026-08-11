import { View, Text, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCart } from '../../../context/cartContext';
import api from '../../../lib/api';

export default function CartScreen() {
  const { items, branchName, itemCount, subtotal, updateQuantity, removeItem } = useCart();

  const deliveryFee = 50;
  const total = subtotal + deliveryFee;

  const handleCheckout = () => {
    router.push('/Customer/Checkout');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
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
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">My Order</Text>
            <Text className="text-xs text-gray-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} {branchName ? `· ${branchName}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6 bg-white">
          <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="cart-outline" size={48} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">Your cart is empty</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Browse the menu and add items you want to order
          </Text>
          <TouchableOpacity
            className="mt-6 bg-yellow-400 px-8 py-3 rounded-full"
            onPress={() => router.push('/Customer/Home')}
            activeOpacity={0.7}
          >
            <Text className="text-yellow-900 font-semibold">Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView 
            className="flex-1 px-4 pt-4 bg-white" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 180 }}
          >
            {/* Order Items - Simple List */}
            {items.map((item) => (
              <View key={item.productId} className="mb-6">
                <View className="flex-row items-center gap-3">
                  {item.image ? (
                    <Image
                      source={{ uri: `${(api.defaults?.baseURL ?? '').replace('/api', '')}/storage/${item.image}` }}
                      className="w-16 h-16 rounded-xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-16 h-16 rounded-xl bg-gray-100 items-center justify-center">
                      <Ionicons name="restaurant-outline" size={28} color="#9CA3AF" />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                    <Text className="text-sm text-gray-500 mt-0.5">₱{item.price.toFixed(2)}</Text>
                    <View className="flex-row items-center gap-3 mt-2">
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                        onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <Text className="text-gray-900 text-base font-semibold w-6 text-center">
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-yellow-400 items-center justify-center"
                        onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={16} color="#78350F" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold text-yellow-600">₱{(item.price * item.quantity).toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => removeItem(item.productId)}
                      activeOpacity={0.7}
                      className="mt-3"
                    >
                      <Text className="text-red-500 text-xs font-medium">Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {/* Total */}
            <View className="flex-row justify-between items-center pt-4 border-t border-gray-200 mb-4">
              <Text className="text-base font-semibold text-gray-900">Total</Text>
              <Text className="text-base font-bold text-yellow-600">₱{total.toFixed(2)}</Text>
            </View>

            {/* Proceed to Checkout */}
            <TouchableOpacity
              className="bg-yellow-400 py-4 rounded-xl items-center mb-4"
              onPress={handleCheckout}
              activeOpacity={0.7}
            >
              <Text className="text-yellow-900 font-bold text-base">Proceed to Checkout</Text>
              <Text className="text-yellow-800 text-sm mt-1">
                Total: ₱{total.toFixed(2)}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}