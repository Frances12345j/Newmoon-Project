import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';

export default function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/rider/orders?per_page=100');
        const orders = res.data?.data ?? [];
        const delivered = orders.filter((o: any) => o.status === 'delivered');
        setDeliveryCount(delivered.length);
        setTotalEarnings(delivered.reduce((sum: number, o: any) => sum + (o.total || 0), 0));
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Earnings</Text>
        </View>
      </View>
      <View className="flex-1 items-center justify-center px-6 bg-gray-50">
        {loading ? (
          <ActivityIndicator size="large" color="#F59E0B" />
        ) : (
          <View className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm items-center w-full">
            <View className="bg-yellow-50 p-4 rounded-full mb-4 border border-yellow-200">
              <Ionicons name="wallet-outline" size={40} color="#F59E0B" />
            </View>
            <Text className="text-gray-900 text-2xl font-bold mb-1">
              ₱{totalEarnings.toLocaleString()}
            </Text>
            <Text className="text-gray-500 text-sm">Total Earnings</Text>
            <View className="w-full h-px bg-gray-200 my-6" />
            <View className="flex-row justify-between w-full">
              <View className="items-center">
                <Text className="text-gray-900 text-lg font-bold">{deliveryCount}</Text>
                <Text className="text-gray-400 text-xs">Deliveries</Text>
              </View>
              <View className="items-center">
                <Text className="text-gray-900 text-lg font-bold">{deliveryCount}</Text>
                <Text className="text-gray-400 text-xs">Total Orders</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}