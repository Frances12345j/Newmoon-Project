import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../context/authContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const displayName = user?.firstname?.trim() || user?.username || 'Rider';
  const userInitial = displayName.charAt(0).toUpperCase();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
              router.replace('/Login');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <View className="bg-white px-4 pb-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900">Profile</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} disabled={loggingOut} className="p-1.5">
            {loggingOut ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="items-center pt-8 pb-6">
          <View className="w-20 h-20 rounded-full bg-[#E8F0FE] items-center justify-center mb-4 border-2 border-[#007AFF]/20">
            <Ionicons name="person" size={40} color="#007AFF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">
            {user?.firstname && user?.lastname ? `${user.firstname} ${user.lastname}` : 'Rider'}
          </Text>
          <Text className="text-gray-500 text-sm mt-1">Delivery Rider</Text>
        </View>

        <View className="mx-4 bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <View className="px-4 py-3.5 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={18} color="#007AFF" />
              <Text className="text-gray-500 text-xs ml-2 uppercase tracking-wider">Name</Text>
            </View>
            <Text className="text-gray-900 text-base mt-1 ml-5">
              {user?.firstname || 'N/A'} {user?.lastname || ''}
            </Text>
          </View>
          <View className="px-4 py-3.5 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="mail-outline" size={18} color="#007AFF" />
              <Text className="text-gray-500 text-xs ml-2 uppercase tracking-wider">Email</Text>
            </View>
            <Text className="text-gray-900 text-base mt-1 ml-5">
              {user?.email || <Text className="text-gray-400 italic">Not set</Text>}
            </Text>
          </View>
          <View className="px-4 py-3.5">
            <View className="flex-row items-center">
              <Ionicons name="call-outline" size={18} color="#007AFF" />
              <Text className="text-gray-500 text-xs ml-2 uppercase tracking-wider">Phone</Text>
            </View>
            <Text className="text-gray-900 text-base mt-1 ml-5">
              {user?.phone || <Text className="text-gray-400 italic">Not set</Text>}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
