import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../lib/api';
import { cacheFaceStatus, getCachedFaceStatus } from '../../../../lib/dataCache';
import { isOnline } from '../../../../lib/network';
import { getUser, saveUser } from '../../../../lib/userStorage';
import { useAuth } from '../../../../context/authContext';
import { COLORS, GRADIENT, CARD } from '../../../lib/staffTheme';


type ProfileData = {
  firstname?: string;
  lastname?: string;
  middlename?: string | null;
  address?: string | null;
};

const ProfileScreen = () => {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [address, setAddress] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceStatusLoading, setFaceStatusLoading] = useState(true);
  const [showFacePasswordModal, setShowFacePasswordModal] = useState(false);
  const [facePassword, setFacePassword] = useState('');
  const [faceResetLoading, setFaceResetLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadFaceStatus();
  }, []);

  const applyProfileData = (data: ProfileData) => {
    setFirstName(data.firstname || '');
    setLastName(data.lastname || '');
    setMiddleName(data.middlename || '');
    setAddress(data.address || '');
  };

  const loadProfile = async () => {
    try {
      setProfileLoading(true);
      const connected = await isOnline();

      if (connected) {
        const { data } = await api.get('me');
        await saveUser(data);
        applyProfileData(data);
        return;
      }

      const cached = await getUser<ProfileData>();
      if (cached) {
        applyProfileData(cached);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const cached = await getUser<ProfileData>();
      if (cached) {
        applyProfileData(cached);
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    const payload = {
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      middlename: middleName.trim() || null,
      address: address.trim() || null,
    };

    try {
      const response = await api.put('/me', payload);
      const responseData = response.data as ProfileData | undefined;

      const cachedUser = (await getUser<Record<string, unknown>>()) ?? {};
      const mergedUser = { ...cachedUser, ...payload };
      await saveUser(mergedUser);
      applyProfileData(mergedUser);

      if (responseData) {
        await saveUser(responseData);
        applyProfileData(responseData);
      }
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      const validationErrors = error?.response?.data?.errors;
      const firstField = validationErrors ? Object.keys(validationErrors)[0] : null;
      const firstMessage = firstField ? validationErrors[firstField]?.[0] : null;
      Alert.alert('Error', firstMessage || error?.response?.data?.message || 'Failed to save profile');
    }
  };

  const loadFaceStatus = async () => {
    try {
      setFaceStatusLoading(true);
      const connected = await isOnline();

      if (connected) {
        const { data } = await api.get('/face/status');
        console.log('[FACE PROFILE] status', data);
        const enrolled = data?.enrolled === true;
        setFaceEnrolled(enrolled);
        await cacheFaceStatus(enrolled);
        return;
      }

      const cached = await getCachedFaceStatus();
      setFaceEnrolled(cached === true);
    } catch (error) {
      console.error('[FACE PROFILE] status failed:', error);
      const cached = await getCachedFaceStatus();
      setFaceEnrolled(cached === true);
    } finally {
      setFaceStatusLoading(false);
    }
  };

  const handleOpenFaceAction = () => {
    if (!faceEnrolled) {
      Alert.alert(
        'Register Facial Data',
        'You have no saved face data yet. Continue to Attendance screen to register your face now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Attendance',
            onPress: () => {
              console.log('[FACE PROFILE] navigate to attendance for first enrollment');
              router.push('/Staff/Attendance' as any);
            },
          },
        ]
      );
      return;
    }

    setFacePassword('');
    setShowFacePasswordModal(true);
  };

  const handleResetFaceData = async () => {
    if (!facePassword.trim()) {
      Alert.alert('Validation', 'Please enter your password.');
      return;
    }

    try {
      setFaceResetLoading(true);
      console.log('[FACE PROFILE] reset request start');

      await api.post('/face/reset', { password: facePassword });

      console.log('[FACE PROFILE] reset success');
      setShowFacePasswordModal(false);
      setFacePassword('');
      setFaceEnrolled(false);
      await cacheFaceStatus(false);
      Alert.alert(
        'Facial Data Reset',
        'Your old facial data was removed. Please register your new face now in Attendance.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Go to Attendance',
            onPress: () => router.push('/Staff/Attendance' as any),
          },
        ]
      );
    } catch (error: any) {
      console.error('[FACE PROFILE] reset failed', error?.response?.data || error?.message);
      const message =
        error?.response?.data?.code === 'FACE_PASSWORD_INVALID'
          ? 'Incorrect password. Please try again.'
          : error?.response?.data?.message || 'Failed to reset facial data.';
      Alert.alert('Error', message);
    } finally {
      setFaceResetLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ marginTop: 16, color: COLORS.TEXT_SECONDARY, fontSize: 16 }}>Loading Profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Profile Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <LinearGradient
            colors={GRADIENT.PRIMARY}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Icon name="person" size={50} color="#FFFFFF" />
          </LinearGradient>
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 24, fontWeight: 'bold' }}>
            {firstName && lastName ? `${firstName} ${lastName}` : 'Staff Member'}
          </Text>
        </View>

        {/* Personal Information */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Personal Information</Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginBottom: 4 }}>First Name</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: isEditing ? COLORS.INPUT_BORDER : COLORS.CARD_BORDER,
                backgroundColor: isEditing ? COLORS.INPUT_BG : COLORS.CARD_BG,
                color: COLORS.TEXT_PRIMARY,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
              }}
              value={firstName}
              onChangeText={setFirstName}
              editable={isEditing}
              placeholder="Enter your first name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginBottom: 4 }}>Middle Name</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: isEditing ? COLORS.INPUT_BORDER : COLORS.CARD_BORDER,
                backgroundColor: isEditing ? COLORS.INPUT_BG : COLORS.CARD_BG,
                color: COLORS.TEXT_PRIMARY,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
              }}
              value={middleName}
              onChangeText={setMiddleName}
              editable={isEditing}
              placeholder="Enter your middle name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginBottom: 4 }}>Last Name</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: isEditing ? COLORS.INPUT_BORDER : COLORS.CARD_BORDER,
                backgroundColor: isEditing ? COLORS.INPUT_BG : COLORS.CARD_BG,
                color: COLORS.TEXT_PRIMARY,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
              }}
              value={lastName}
              onChangeText={setLastName}
              editable={isEditing}
              placeholder="Enter your last name"
              placeholderTextColor="#6B7280"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginBottom: 4 }}>Address</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: isEditing ? COLORS.INPUT_BORDER : COLORS.CARD_BORDER,
                backgroundColor: isEditing ? COLORS.INPUT_BG : COLORS.CARD_BG,
                color: COLORS.TEXT_PRIMARY,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                minHeight: 80,
              }}
              value={address}
              onChangeText={setAddress}
              editable={isEditing}
              placeholder="Enter your address"
              placeholderTextColor="#6B7280"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Facial Data Card */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Facial Data</Text>
          <View style={{ ...CARD, padding: 16 }}>
            {faceStatusLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.PRIMARY_RED} />
                <Text style={{ color: COLORS.TEXT_SECONDARY, marginLeft: 12, fontSize: 14 }}>Checking face status...</Text>
              </View>
            ) : (
              <>
                <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: '500' }}>Status</Text>
                <Text
                  style={{
                    fontWeight: 'bold',
                    marginTop: 4,
                    color: faceEnrolled ? COLORS.STATUS_APPROVED_TEXT : COLORS.STATUS_PENDING_TEXT,
                  }}
                >
                  {faceEnrolled ? 'Registered' : 'Not registered'}
                </Text>
                <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
                  {faceEnrolled
                    ? 'To update your facial data, confirm your current password first.'
                    : 'Register your facial data to use face attendance.'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Facial Action Button */}
        <TouchableOpacity
          disabled={faceStatusLoading}
          onPress={handleOpenFaceAction}
        >
          <LinearGradient
            colors={GRADIENT.PRIMARY}
            style={{
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 16,
              opacity: faceStatusLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
              {faceEnrolled ? 'Update Facial Data' : 'Register Facial Data'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Edit/Save Button */}
        <TouchableOpacity
          onPress={isEditing ? saveProfile : () => setIsEditing(true)}
        >
          <LinearGradient
            colors={GRADIENT.PRIMARY}
            style={{
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
              {isEditing ? 'Save Profile' : 'Edit Profile'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      {/* Password Confirmation Modal */}
      <Modal
        visible={showFacePasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFacePasswordModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: COLORS.CARD_BG, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.CARD_BORDER }}>
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: 'bold' }}>Confirm Password</Text>
            <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4, lineHeight: 20 }}>
              Enter your current password to reset and update your existing facial data.
            </Text>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: COLORS.INPUT_BORDER,
                backgroundColor: COLORS.INPUT_BG,
                color: COLORS.TEXT_PRIMARY,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                marginTop: 16,
              }}
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor="#6B7280"
              value={facePassword}
              onChangeText={setFacePassword}
              editable={!faceResetLoading}
            />

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: COLORS.INPUT_BG, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginRight: 8 }}
                disabled={faceResetLoading}
                onPress={() => {
                  setShowFacePasswordModal(false);
                  setFacePassword('');
                }}
              >
                <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#DC2626',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginLeft: 8,
                  opacity: faceResetLoading ? 0.7 : 1,
                }}
                disabled={faceResetLoading}
                onPress={handleResetFaceData}
              >
                {faceResetLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
