import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#FCA5A5',
          tabBarStyle: {
            backgroundColor: '#EF4444',
            borderTopWidth: 0,
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            overflow: 'hidden',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            marginTop: 2,
          },
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="Dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons
                name="list-alt"
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="History"
          options={{
            title: 'History',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Maps"
          options={{
            title: 'Map',
            tabBarIcon: ({ color, focused }) => (
              <FontAwesome5
                name="map"
                size={22}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Earnings"
          options={{
            title: 'Earnings',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons
                name="account-balance-wallet"
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="Delivery"
          options={{
            title: 'Delivery',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons
                name="verified"
                size={24}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
