import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import api from '../../../lib/api';

interface Props {
  visible: boolean;
  orderId: number;
  orderNumber: string;
  customerName: string;
  onSubmit?: () => void;
  onCancel?: () => void;
}

export default function ProofOfDelivery({
  visible,
  orderId,
  orderNumber,
  customerName,
  onSubmit = () => {},
  onCancel = () => {},
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [confirmedName, setConfirmedName] = useState('');
  const [step, setStep] = useState<'camera' | 'preview' | 'form'>('camera');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCameraReady(false);
      setTakingPhoto(false);
      setPhotoUri(null);
      setDeliveryNotes('');
      setConfirmedName('');
      setStep('camera');
      setSubmitting(false);
    }
  }, [visible]);

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    setTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        setPhotoUri(photo.uri);
        setStep('preview');
      } else {
        Alert.alert('Error', 'No image data returned from camera');
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e?.message || 'Failed to take photo');
    } finally {
      setTakingPhoto(false);
    }
  };

  const retakePhoto = () => {
    setPhotoUri(null);
    setStep('camera');
  };

  const confirmPhoto = () => {
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!confirmedName.trim()) {
      Alert.alert('Required', 'Please confirm the customer name');
      return;
    }
    if (!photoUri) {
      Alert.alert('Required', 'Please take a delivery photo');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('status', 'delivered');
      formData.append('delivery_notes', deliveryNotes.trim());
      formData.append('customer_confirmed', confirmedName.trim());
      formData.append('delivery_photo', {
        uri: photoUri,
        type: 'image/jpeg',
        name: `delivery_${orderId}.jpg`,
      } as any);
      await api.post(`/rider/orders/${orderId}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUri(null);
      setStep('camera');
      onSubmit();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit proof of delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPhotoUri(null);
    setDeliveryNotes('');
    setConfirmedName('');
    setStep('camera');
    setSubmitting(false);
    onCancel();
    router.replace('/Rider/Dashboard');
  };

  const header = (
    <View className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-gray-900/95 border-b border-gray-800">
      <TouchableOpacity onPress={handleClose} className="p-2" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color="white" />
      </TouchableOpacity>
      <Text className="text-white font-bold text-base">{orderNumber}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/90">
        {header}
        {step === 'camera' && (
          <View className="flex-1">
            {!permission?.granted ? (
              <View className="flex-1 items-center justify-center px-6">
                <Ionicons name="camera-outline" size={64} color="#6B7280" />
                <Text className="text-white text-lg font-bold mt-4 mb-2">Camera Access Needed</Text>
                <Text className="text-gray-400 text-center text-sm mb-6">
                  Take a photo of the delivered items or delivery location as proof
                </Text>
                <TouchableOpacity
                  className="bg-emerald-600 px-8 py-3 rounded-xl"
                  onPress={requestPermission}
                  activeOpacity={0.7}
                >
                  <Text className="text-white font-bold">Grant Permission</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1">
                <View className="flex-1 relative">
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                    onCameraReady={() => setCameraReady(true)}
                  />
                  {!cameraReady && (
                    <View className="absolute inset-0 items-center justify-center bg-black/60">
                      <ActivityIndicator size="large" color="#10B981" />
                      <Text className="text-gray-300 mt-3 text-sm">Initializing camera...</Text>
                    </View>
                  )}
                  {cameraReady && (
                    <View className="absolute inset-0 justify-end items-center pb-12">
                      <View className="bg-gray-900/70 px-4 py-2 rounded-full mb-6">
                        <Text className="text-white/80 text-xs">Position the package in frame</Text>
                      </View>
                      <TouchableOpacity
                        onPress={takePicture}
                        disabled={takingPhoto}
                        className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
                        activeOpacity={0.7}
                      >
                        {takingPhoto ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <View className="w-16 h-16 rounded-full bg-white" />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        {step === 'preview' && photoUri && (
          <View className="flex-1 items-center justify-center px-4">
            <Image
              source={{ uri: photoUri }}
              className="w-full flex-1 rounded-2xl"
              resizeMode="contain"
            />
            <View className="flex-row gap-4 py-6">
              <TouchableOpacity
                className="flex-1 bg-gray-800 py-3 rounded-xl items-center flex-row justify-center"
                onPress={retakePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
                <Text className="text-gray-300 font-semibold">Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-emerald-600 py-3 rounded-xl items-center flex-row justify-center"
                onPress={confirmPhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={18} color="white" style={{ marginRight: 6 }} />
                <Text className="text-white font-bold">Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {step === 'form' && (
          <ScrollView
            className="flex-1 px-4 pt-6"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 80 }}
          >
            <View className="bg-gray-900 rounded-2xl p-5 mb-4 border border-gray-800">
              <Text className="text-white text-lg font-bold mb-4">Delivery Confirmation</Text>
              {photoUri && (
                <View className="mb-4">
                  <Image source={{ uri: photoUri }} className="w-full h-48 rounded-xl" resizeMode="cover" />
                  <TouchableOpacity onPress={retakePhoto} className="mt-2">
                    <Text className="text-emerald-400 text-xs font-semibold">Retake photo</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View className="mb-4">
                <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">
                  Confirm Customer Name
                </Text>
                <TextInput
                  className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base"
                  placeholder="Enter customer name..."
                  placeholderTextColor="#6B7280"
                  value={confirmedName}
                  onChangeText={setConfirmedName}
                  autoCapitalize="words"
                />
                <Text className="text-gray-500 text-xs mt-1">Expected: {customerName}</Text>
              </View>
              <View className="mb-2">
                <Text className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-2">
                  Delivery Notes (Optional)
                </Text>
                <TextInput
                  className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base min-h-[80px]"
                  placeholder="Any remarks about the delivery..."
                  placeholderTextColor="#6B7280"
                  value={deliveryNotes}
                  onChangeText={setDeliveryNotes}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
            <TouchableOpacity
              className="bg-emerald-600 py-4 rounded-xl items-center mb-3"
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-base">Confirm Delivery</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 rounded-xl items-center mb-8"
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text className="text-gray-500 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
