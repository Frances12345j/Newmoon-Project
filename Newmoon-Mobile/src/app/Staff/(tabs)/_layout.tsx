import { Tabs } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

export default function StaffTabsLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: '#E53935',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E3F2FD',
                    height: 60,
                    paddingBottom: 5,
                    paddingTop: 5,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
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
                            name={focused ? 'list-alt' : 'list-alt'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="Attendance"
                options={{
                    title: 'Attendance',
                    tabBarIcon: ({ color, focused }) => (
                        <FontAwesome5
                            name={focused ? 'calendar-check' : 'calendar-alt'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="PointOfSales"
                options={{
                    title: 'POS',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialIcons
                            name={focused ? 'point-of-sale' : 'shopping-cart'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="SalaryAdvance"
                options={{
                    title: 'Cash Adv.',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialIcons
                            name={focused ? 'account-balance-wallet' : 'account-balance-wallet'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="StockRequest"
                options={{
                    title: 'Stock Req.',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialIcons
                            name={focused ? 'inventory' : 'inventory-2'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="PullOut"
                options={{
                    title: 'Pull Out',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialIcons
                            name={focused ? 'delete-outline' : 'delete'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="BackToSale"
                options={{
                    title: 'BTS',
                    tabBarIcon: ({ color, focused }) => (
                        <MaterialIcons
                            name={focused ? 'assignment-return' : 'assignment-return'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Tabs.Screen
                name="Profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? 'person-circle' : 'person-circle-outline'}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
