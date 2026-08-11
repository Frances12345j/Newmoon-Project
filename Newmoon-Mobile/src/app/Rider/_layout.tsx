import React from 'react';
import { Stack } from 'expo-router';
import GpsGate from '../../../components/GpsGate';

export default function RiderLayout() {
  return (
    <GpsGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ProofOfDelivery" />
        <Stack.Screen name="Profile" />
      </Stack>
    </GpsGate>
  );
}
