import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/authContext';
import { getDashboardPath } from '../../lib/userType';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, userType, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [navigationReady, setNavigationReady] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setNavigationReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated && navigationReady) {
      const redirectPath = getDashboardPath(userType || 'staff');
      router.replace(redirectPath as any);
    }
  }, [isAuthenticated, userType, navigationReady]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  const validateUsername = (username: string) => {
    if (!username) return 'Username is required';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    return '';
  };

  const handleLogin = async () => {
    if (isLoading) return;

    const usernameValidationError = validateUsername(username);
    const passwordValidationError = validatePassword(password);

    setUsernameError(usernameValidationError);
    setPasswordError(passwordValidationError);

    if (usernameValidationError || passwordValidationError) return;

    setIsLoading(true);

    try {
      const result = await login(username.trim(), password);

      if (result?.success) {
        const userTypeFromResult = result.userType || 'staff';
        const redirectPath = getDashboardPath(userTypeFromResult);
        const welcomeLabel =
          userTypeFromResult === 'rider'
            ? 'Rider'
            : userTypeFromResult === 'customer'
              ? 'Customer'
              : 'Staff';

        Alert.alert('Login Successful', `Welcome ${welcomeLabel}!`, [
          {
            text: 'Continue',
            onPress: () => {
              setTimeout(() => {
                try {
                  router.replace(redirectPath as any);
                } catch {
                  try {
                    router.push(redirectPath as any);
                  } catch {}
                }
              }, 300);
            },
          },
        ]);
      } else {
        Alert.alert(
          'Login Failed',
          result?.error || 'Incorrect username or password',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to connect to server',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <View className="flex-1 justify-center px-6 py-8">
                {/* Brand Section */}
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                    alignItems: 'center',
                    marginBottom: 40,
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 24,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <Image
                      source={require('../../assets/images/logooos.jpg')}
                      style={{ width: 64, height: 64, borderRadius: 16 }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 26,
                      fontWeight: '800',
                      color: '#fff',
                      textAlign: 'center',
                      letterSpacing: -0.5,
                    }}
                  >
                    New Moon
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.5)',
                      textAlign: 'center',
                      marginTop: 4,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    Lechon Manok & Liempo House
                  </Text>
                </Animated.View>

                {/* Login Card */}
                <Animated.View
                  style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    padding: 28,
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '700',
                      color: '#fff',
                      textAlign: 'center',
                      marginBottom: 4,
                    }}
                  >
                    Welcome Back
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.5)',
                      textAlign: 'center',
                      marginBottom: 28,
                    }}
                  >
                    Sign in to access your account
                  </Text>

                  {/* Username */}
                  <View style={{ marginBottom: 18 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: 8,
                        marginLeft: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}
                    >
                      Username
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: usernameError
                          ? '#ef4444'
                          : usernameFocused
                            ? '#818cf8'
                            : 'rgba(255,255,255,0.1)',
                        paddingLeft: 14,
                      }}
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={usernameFocused ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                      />
                      <TextInput
                        style={{
                          flex: 1,
                          padding: 14,
                          fontSize: 15,
                          color: '#fff',
                        }}
                        placeholder="Enter your username"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={username}
                        onChangeText={(text) => {
                          setUsername(text);
                          setUsernameError('');
                        }}
                        onFocus={() => setUsernameFocused(true)}
                        onBlur={() => setUsernameFocused(false)}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {usernameError ? (
                      <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                        {usernameError}
                      </Text>
                    ) : null}
                  </View>

                  {/* Password */}
                  <View style={{ marginBottom: 6 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: 8,
                        marginLeft: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}
                    >
                      Password
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: passwordError
                          ? '#ef4444'
                          : passwordFocused
                            ? '#818cf8'
                            : 'rgba(255,255,255,0.1)',
                        paddingLeft: 14,
                      }}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={passwordFocused ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                      />
                      <TextInput
                        style={{ flex: 1, padding: 14, fontSize: 15, color: '#fff' }}
                        placeholder="Enter your password"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          setPasswordError('');
                        }}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ paddingRight: 14 }}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color="rgba(255,255,255,0.4)"
                        />
                      </TouchableOpacity>
                    </View>
                    {passwordError ? (
                      <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                        {passwordError}
                      </Text>
                    ) : null}
                  </View>

                  {/* Forgot Password */}
                  <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 28, marginTop: 4 }}>
                    <Text style={{ color: 'rgba(129,140,248,0.8)', fontSize: 13, fontWeight: '600' }}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  {/* Login Button */}
                  <TouchableOpacity
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      shadowColor: '#818cf8',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 8,
                    }}
                  >
                    <LinearGradient
                      colors={['#6366f1', '#4f46e5', '#4338ca']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingVertical: 15,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isLoading ? 0.7 : 1,
                      }}
                    >
                      {isLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text
                            style={{
                              color: '#fff',
                              fontSize: 16,
                              fontWeight: '700',
                              marginLeft: 10,
                            }}
                          >
                            Logging in...
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text
                            style={{
                              color: '#fff',
                              fontSize: 16,
                              fontWeight: '700',
                              letterSpacing: 0.5,
                            }}
                          >
                            Sign In
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={18}
                            color="#fff"
                            style={{ marginLeft: 8 }}
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginVertical: 28,
                    }}
                  >
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: 12,
                        marginHorizontal: 16,
                        letterSpacing: 1,
                      }}
                    >
                      OR
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  </View>

                  {/* Sign Up Link */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                      Don't have an account?{' '}
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/Registration')}>
                      <Text
                        style={{
                          color: '#818cf8',
                          fontSize: 14,
                          fontWeight: '700',
                        }}
                      >
                        Sign Up
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                {/* Footer */}
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: 11,
                    textAlign: 'center',
                    marginTop: 32,
                    letterSpacing: 1,
                  }}
                >
                  SECURE LOGIN SYSTEM
                </Text>
              </View>
            </SafeAreaView>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
