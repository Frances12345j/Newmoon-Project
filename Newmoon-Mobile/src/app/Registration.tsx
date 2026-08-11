import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/authContext';
import api from '../../lib/api';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type RegisterFormData = {
  username: string;
  firstname: string;
  lastname: string;
  middlename: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  password_confirmation: string;
};

type RegisterFormField = keyof RegisterFormData;

const REQUIRED_FIELDS: RegisterFormField[] = [
  'username',
  'firstname',
  'lastname',
  'email',
  'password',
  'password_confirmation',
];

type InputConfig = {
  key: RegisterFormField;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  placeholder: string;
  required: boolean;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
};

const INPUT_FIELDS: InputConfig[] = [
  { key: 'firstname', icon: 'person-outline', label: 'First Name', placeholder: 'Enter first name', required: true, autoCapitalize: 'words' },
  { key: 'lastname', icon: 'person-outline', label: 'Last Name', placeholder: 'Enter last name', required: true, autoCapitalize: 'words' },
  { key: 'middlename', icon: 'person-outline', label: 'Middle Name', placeholder: 'Enter middle name (optional)', required: false, autoCapitalize: 'words' },
  { key: 'username', icon: 'at-outline', label: 'Username', placeholder: 'Choose a username', required: true, autoCapitalize: 'none' },
  { key: 'email', icon: 'mail-outline', label: 'Email Address', placeholder: 'Enter email address', required: true, keyboardType: 'email-address', autoCapitalize: 'none' },
  { key: 'phone', icon: 'call-outline', label: 'Phone Number', placeholder: 'Enter phone number (optional)', required: false, keyboardType: 'phone-pad' },
  { key: 'address', icon: 'home-outline', label: 'Address', placeholder: 'Enter your address (optional)', required: false, multiline: true },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<RegisterFormField | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

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

  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    firstname: '',
    lastname: '',
    middlename: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    password_confirmation: '',
  });

  const validateField = (name: RegisterFormField, value: string) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'username':
        if (!value) newErrors.username = 'Username is required';
        else if (value.length < 3) newErrors.username = 'Username must be at least 3 characters';
        else if (value.length > 255) newErrors.username = 'Username must be less than 255 characters';
        else if (!/^[a-zA-Z0-9_]+$/.test(value)) newErrors.username = 'Username can only contain letters, numbers, and underscores';
        else delete newErrors.username;
        break;

      case 'firstname':
        if (!value) newErrors.firstname = 'First name is required';
        else if (value.length < 2) newErrors.firstname = 'First name must be at least 2 characters';
        else delete newErrors.firstname;
        break;

      case 'lastname':
        if (!value) newErrors.lastname = 'Last name is required';
        else if (value.length < 2) newErrors.lastname = 'Last name must be at least 2 characters';
        else delete newErrors.lastname;
        break;

      case 'email':
        if (!value) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(value)) newErrors.email = 'Please enter a valid email address';
        else delete newErrors.email;
        break;

      case 'phone':
        if (value && !/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(value)) {
          newErrors.phone = 'Please enter a valid phone number';
        } else {
          delete newErrors.phone;
        }
        break;

      case 'password':
        if (!value) newErrors.password = 'Password is required';
        else if (value.length < 8) newErrors.password = 'Password must be at least 8 characters';
        else if (!/[A-Z]/.test(value)) newErrors.password = 'Password must contain at least one uppercase letter';
        else if (!/[a-z]/.test(value)) newErrors.password = 'Password must contain at least one lowercase letter';
        else if (!/[0-9]/.test(value)) newErrors.password = 'Password must contain at least one number';
        else delete newErrors.password;

        if (formData.password_confirmation && value !== formData.password_confirmation) {
          newErrors.password_confirmation = 'Passwords do not match';
        } else if (formData.password_confirmation) {
          delete newErrors.password_confirmation;
        }
        break;

      case 'password_confirmation':
        if (!value) newErrors.password_confirmation = 'Please confirm your password';
        else if (value !== formData.password) newErrors.password_confirmation = 'Passwords do not match';
        else delete newErrors.password_confirmation;
        break;

      default:
        delete newErrors[name];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (name: RegisterFormField, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (username.length < 3) return true;
    try {
      const response = await api.post('/check-username', { username });
      if (!response.data.available) {
        setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) return true;
    try {
      const response = await api.post('/check-email', { email });
      if (!response.data.available) {
        setErrors(prev => ({ ...prev, email: 'Email is already registered' }));
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleRegister = async () => {
    const fieldsToValidate = REQUIRED_FIELDS;
    let isValid = true;

    fieldsToValidate.forEach((field) => {
      if (!validateField(field, formData[field])) {
        isValid = false;
      }
    });

    if (!agreeTerms) {
      Alert.alert('Terms & Conditions', 'Please agree to the Terms and Conditions to continue.');
      return;
    }

    if (!isValid) {
      Alert.alert('Validation Error', 'Please fix all errors before submitting.');
      return;
    }

    const isUsernameAvailable = await checkUsernameAvailability(formData.username);
    const isEmailAvailable = await checkEmailAvailability(formData.email);

    if (!isUsernameAvailable || !isEmailAvailable) return;

    setIsLoading(true);

    try {
      const result = await register(formData);

      if (result.success) {
        Alert.alert(
          'Registration Successful! 🎉',
          'Your customer account has been created successfully. Please login to continue.',
          [{ text: 'Go to Login', onPress: () => router.replace('/Login') }]
        );
      } else {
        if (result.errors) setErrors(result.errors);
        Alert.alert('Registration Failed', result.error || 'Something went wrong. Please try again.');
      }
    } catch {
      Alert.alert(
        'Network Error',
        'Unable to connect to the server. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (config: InputConfig) => {
    const { key, icon, label, placeholder, required, keyboardType, autoCapitalize, multiline } = config;
    const isFocused = focusedField === key;
    const hasError = !!errors[key];

    return (
      <View key={key} style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}{' '}
          {!required && <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>(Optional)</Text>}
        </Text>
        <View style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: hasError ? '#ef4444' : isFocused ? '#818cf8' : 'rgba(255,255,255,0.1)',
          paddingLeft: 14,
        }}>
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? '#818cf8' : 'rgba(255,255,255,0.4)'}
            style={{ marginTop: multiline ? 14 : 0 }}
          />
          <TextInput
            style={{
              flex: 1,
              padding: 14,
              fontSize: 15,
              color: '#fff',
              minHeight: multiline ? 80 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            }}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={formData[key]}
            onChangeText={(text) => {
              const val = key === 'username' || key === 'email' ? text.toLowerCase() : text;
              handleInputChange(key, val);
            }}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField(null)}
            secureTextEntry={config.secure}
            keyboardType={keyboardType || 'default'}
            autoCapitalize={autoCapitalize || 'none'}
            autoCorrect={false}
            multiline={multiline}
            numberOfLines={multiline ? 3 : undefined}
          />
        </View>
        {hasError && (
          <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 4 }}>{errors[key]}</Text>
        )}
      </View>
    );
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
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>

                {/* Header */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, width: 40, marginTop: 30 }}>
                      <Ionicons name="arrow-back" size={24} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center', marginRight: 40, marginTop: 30 }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
                        Create Account
                      </Text>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 0.5 }}>
                        Register as a customer
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Registration Card */}
                <Animated.View style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  padding: 24,
                }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 24 }}>
                    Customer Registration
                  </Text>

                  {/* Personal Information */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(129,140,248,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person-outline" size={16} color="#818cf8" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' }}>
                      Personal Information
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  </View>

                  {INPUT_FIELDS.map(renderInput)}

                  {/* Security */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8, gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(129,140,248,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#818cf8" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' }}>
                      Security
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  </View>

                  {/* Password */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Password <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: errors.password ? '#ef4444' : focusedField === 'password' ? '#818cf8' : 'rgba(255,255,255,0.1)',
                      paddingLeft: 14,
                    }}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={focusedField === 'password' ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                      />
                      <TextInput
                        style={{ flex: 1, padding: 14, fontSize: 15, color: '#fff' }}
                        placeholder="Create a strong password"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        secureTextEntry={!showPassword}
                        value={formData.password}
                        onChangeText={(text) => handleInputChange('password', text)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingRight: 14 }}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                    {errors.password ? (
                      <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 4 }}>{errors.password}</Text>
                    ) : (
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 6, marginLeft: 4 }}>
                        Minimum 8 characters with uppercase, lowercase, and number
                      </Text>
                    )}
                  </View>

                  {/* Confirm Password */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Confirm Password <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: errors.password_confirmation ? '#ef4444' : focusedField === 'password_confirmation' ? '#818cf8' : 'rgba(255,255,255,0.1)',
                      paddingLeft: 14,
                    }}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={focusedField === 'password_confirmation' ? '#818cf8' : 'rgba(255,255,255,0.4)'}
                      />
                      <TextInput
                        style={{ flex: 1, padding: 14, fontSize: 15, color: '#fff' }}
                        placeholder="Confirm your password"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        secureTextEntry={!showConfirmPassword}
                        value={formData.password_confirmation}
                        onChangeText={(text) => handleInputChange('password_confirmation', text)}
                        onFocus={() => setFocusedField('password_confirmation')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ paddingRight: 14 }}>
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                    {errors.password_confirmation && (
                      <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 4 }}>{errors.password_confirmation}</Text>
                    )}
                  </View>

                  {/* Terms and Conditions */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
                    onPress={() => setAgreeTerms(!agreeTerms)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: agreeTerms ? '#818cf8' : 'rgba(255,255,255,0.3)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: agreeTerms ? 'rgba(129,140,248,0.3)' : 'transparent',
                      marginRight: 12,
                    }}>
                      {agreeTerms && <Ionicons name="checkmark" size={16} color="#818cf8" />}
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1 }}>
                      I agree to the{' '}
                      <Text style={{ color: '#818cf8', fontWeight: '700' }}>Terms and Conditions</Text>
                      {' '}and{' '}
                      <Text style={{ color: '#818cf8', fontWeight: '700' }}>Privacy Policy</Text>
                    </Text>
                  </TouchableOpacity>

                  {/* Register Button */}
                  <TouchableOpacity
                    onPress={handleRegister}
                    disabled={isLoading || !agreeTerms}
                    activeOpacity={0.85}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      shadowColor: '#818cf8',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 8,
                      opacity: isLoading || !agreeTerms ? 0.5 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#6366f1', '#4f46e5', '#4338ca']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}
                    >
                      {isLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>
                            Creating Account...
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                            Create Account
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginHorizontal: 16, letterSpacing: 1 }}>
                      OR
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  </View>

                  {/* Login Link */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                      Already have an account?{' '}
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/Login')}>
                      <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '700' }}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                {/* Footer */}
                <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginTop: 28, letterSpacing: 1 }}>
                  NEW MOON LECHON MANOK & LIEMPO HOUSE
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
