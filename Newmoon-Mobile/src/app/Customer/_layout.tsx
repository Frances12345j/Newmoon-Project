import React from 'react';
import { Stack } from 'expo-router';
import { CartProvider } from '../../../context/cartContext';
import GpsGate from '../../../components/GpsGate';
import { AddressProvider } from '../../../context/addressContext';

export default function CustomerLayout() {
  return (
    <CartProvider>
      <AddressProvider>
        <GpsGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="Cart" />
            <Stack.Screen name="Checkout" />
            <Stack.Screen name="OrderDetail" />
            <Stack.Screen name="RiderTracking" />
            <Stack.Screen name="Profile" />
          </Stack>
        </GpsGate>
      </AddressProvider>
    </CartProvider>
  );
}
