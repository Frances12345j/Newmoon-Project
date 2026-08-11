import "../../global.css";
import { Stack, useRouter } from "expo-router";
import { AuthProvider } from "../../context/authContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from "react";

const queryClient = new QueryClient();

export default function RootLayout() {
    const router = useRouter();
    const hasReset = useRef(false);

    useEffect(() => {
        if (!hasReset.current) {
            hasReset.current = true;
            router.replace('/Login');
        }
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            animation: 'none',
                        }}
                        initialRouteName="Login"
                    >
                        <Stack.Screen
                            name='index'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Login'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Staff'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Registration'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Customer'
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name='Rider'
                            options={{ headerShown: false }}
                        />
                    </Stack>
            </AuthProvider>
        </QueryClientProvider>
    )
}