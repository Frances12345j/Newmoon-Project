import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/Login');
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-blue-600">
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}
