import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="chatbubble-outline" size={40} color="#9CA3AF" />
        </View>
        <Text className="text-gray-800 text-xl font-bold">Chat</Text>
        <Text className="text-gray-500 text-sm text-center mt-2">
          Coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}
