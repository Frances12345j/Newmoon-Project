import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/authContext';
import { getDashboardPath } from '../lib/userType';
import { ActivityIndicator, View } from 'react-native';

export default function AuthRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, userType } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace(getDashboardPath(userType || 'staff'));
      } else {
        // User is not logged in, show Login screen
        router.replace('/Login');
      }
    }
  }, [isAuthenticated, isLoading, userType, router]);

  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-blue-600">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return <>{children}</>;
}
