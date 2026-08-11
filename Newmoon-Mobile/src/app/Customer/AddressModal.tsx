import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Platform, Animated, KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../../../lib/api';

type Address = {
  id?: number;
  label?: string;
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: Address) => void;
  selectedAddress?: Address | null;
};

type ViewMode = 'list' | 'form' | 'map';

const MAP_HTML = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f3f4f6; }
    #map { width: 100%; height: 100%; }
    .leaflet-control-zoom a { background: #fff; color: #374151; border-color: #e5e7eb; }
    .leaflet-control-zoom { border: none; }
    .leaflet-control-attribution { display: none !important; }

    .center-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
      font-size: 32px;
      color: #F59E0B;
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
      line-height: 1;
    }
    .center-marker::before {
      content: "📍";
      font-size: 32px;
    }
    .center-dot {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999;
      pointer-events: none;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #F59E0B;
      box-shadow: 0 0 6px rgba(245,158,11,0.8);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-marker"></div>
  <div class="center-dot"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 16,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var isFirstLoad = true;
    var sendTimeout = null;

    function sendCenter() {
      if (sendTimeout) {
        clearTimeout(sendTimeout);
      }
      
      sendTimeout = setTimeout(function() {
        var center = map.getCenter();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          latitude: center.lat.toFixed(7),
          longitude: center.lng.toFixed(7),
        }));
      }, 100);
    }

    map.whenReady(function() {
      setTimeout(function() {
        sendCenter();
      }, 200);
    });

    map.on('moveend', sendCenter);
    map.on('zoomend', sendCenter);
  </script>
</body>
</html>
`;

export default function AddressModal({ visible, onClose, onSelect, selectedAddress }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Address>({
    label: '', street: '', barangay: '', city: '', province: '',
    latitude: null, longitude: null,
  });
  const [mapLat, setMapLat] = useState(14.5995);
  const [mapLng, setMapLng] = useState(120.9842);
  const [mapKey, setMapKey] = useState(0);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setViewMode('list');
      setEditingId(null);
      loadAddresses();
    }
  }, [visible]);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/addresses');
      if (isMounted.current) {
        setAddresses(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const animateTo = (mode: ViewMode) => {
    Animated.timing(slideAnim, {
      toValue: mode === 'list' ? 0 : mode === 'form' ? 1 : 2,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setViewMode(mode);
    setIsMapVisible(mode === 'map');
  };

  const handleUseCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addr = geocode[0] || {};
      setForm({
        label: 'Current Location',
        street: [addr.street, addr.name, addr.district].filter(Boolean).join(', '),
        barangay: addr.subregion || '',
        city: addr.city || addr.subregion || '',
        province: addr.region || '',
        latitude,
        longitude,
      });
      setMapLat(latitude);
      setMapLng(longitude);
      if (!isMapVisible) {
        setMapKey(prev => prev + 1);
      }
      animateTo('map');
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      if (isMounted.current) {
        setGettingLocation(false);
      }
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({ label: '', street: '', barangay: '', city: '', province: '', latitude: null, longitude: null });
    animateTo('form');
  };

  const openEditForm = (addr: Address) => {
    setEditingId(addr.id || null);
    setForm({
      label: addr.label || '',
      street: addr.street || '',
      barangay: addr.barangay || '',
      city: addr.city || '',
      province: addr.province || '',
      latitude: addr.latitude,
      longitude: addr.longitude,
    });
    if (addr.latitude && addr.longitude) {
      setMapLat(Number(addr.latitude));
      setMapLng(Number(addr.longitude));
      if (!isMapVisible) {
        setMapKey(prev => prev + 1);
      }
    }
    animateTo('form');
  };

  const handleSave = async () => {
    if (!form.street?.trim() && !form.city?.trim()) {
      Alert.alert('Required', 'Please enter at least a street and city.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/addresses/${editingId}`, form);
      } else {
        await api.post('/addresses', form);
      }
      await loadAddresses();
      animateTo('list');
    } catch {
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  };

  const handleDelete = (addr: Address) => {
    Alert.alert('Delete Address', `Remove "${addr.label || 'this address'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/addresses/${addr.id}`);
            loadAddresses();
          } catch {
            Alert.alert('Error', 'Failed to delete address.');
          }
        },
      },
    ]);
  };

  const handleMapConfirm = () => {
    setForm(prev => ({ ...prev, latitude: mapLat, longitude: mapLng }));
    geocodeMapPoint(mapLat, mapLng);
    animateTo('form');
  };

  const geocodeMapPoint = async (lat: number, lng: number) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const addr = geocode[0] || {};
      if (isMounted.current) {
        setForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          street: prev.street || [addr.street, addr.name, addr.district].filter(Boolean).join(', '),
          barangay: prev.barangay || addr.subregion || '',
          city: prev.city || addr.city || '',
          province: prev.province || addr.region || '',
        }));
      }
    } catch {
      if (isMounted.current) {
        setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
      }
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.latitude && data.longitude) {
        const newLat = Number(data.latitude);
        const newLng = Number(data.longitude);
        if (Math.abs(newLat - mapLat) > 0.000001 || Math.abs(newLng - mapLng) > 0.000001) {
          setMapLat(newLat);
          setMapLng(newLng);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSelectAddress = (addr: Address) => {
    onSelect(addr);
    onClose();
  };

  const getAddressText = (addr: Address) => {
    return [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(', ');
  };

  const renderList = () => (
    <View style={{ flex: 1 }}>
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={onClose} className="mr-3 p-1">
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-gray-900 text-lg font-bold">Delivery Address</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4 bg-gray-50">
        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm flex-row items-center"
          onPress={handleUseCurrentLocation}
          disabled={gettingLocation}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 rounded-full bg-yellow-50 items-center justify-center mr-3 border border-yellow-200">
            {gettingLocation ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <Ionicons name="locate" size={22} color="#F59E0B" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 text-base font-semibold">Use My Current Location</Text>
            <Text className="text-gray-500 text-sm mt-0.5">GPS-based delivery address</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <View className="flex-row items-center mb-3">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="text-gray-400 text-xs mx-3 uppercase tracking-wider">Saved Addresses</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        {loading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color="#F59E0B" />
          </View>
        ) : addresses.length === 0 ? (
          <View className="bg-white rounded-2xl p-6 items-center border border-gray-200 mb-3 shadow-sm">
            <Ionicons name="location-outline" size={40} color="#D1D5DB" />
            <Text className="text-gray-500 text-sm mt-3">No saved addresses yet</Text>
          </View>
        ) : (
          addresses.map((addr) => {
            const isSelected = selectedAddress?.id === addr.id;
            const isDefault = addr.is_default;
            return (
              <TouchableOpacity
                key={addr.id}
                className={`bg-white rounded-2xl p-4 mb-3 border shadow-sm flex-row items-center ${
                  isSelected ? 'border-yellow-400' : 'border-gray-200'
                }`}
                onPress={() => handleSelectAddress(addr)}
                activeOpacity={0.7}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                  isSelected ? 'bg-yellow-50' : 'bg-gray-100'
                }`}>
                  <Ionicons name="location" size={20} color={isSelected ? '#F59E0B' : '#9CA3AF'} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-gray-900 text-sm font-semibold" numberOfLines={1}>
                      {addr.label || 'Address'}
                    </Text>
                    {isDefault && (
                      <View className="bg-yellow-50 px-2 py-0.5 rounded-full ml-2 border border-yellow-200">
                        <Text className="text-yellow-600 text-xs">Default</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                    {getAddressText(addr)}
                  </Text>
                  {addr.latitude && addr.longitude && (
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {Number(addr.latitude).toFixed(5)}, {Number(addr.longitude).toFixed(5)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-1"
                  onPress={() => openEditForm(addr)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="create-outline" size={16} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  onPress={() => handleDelete(addr)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mb-6 border border-dashed border-gray-300 flex-row items-center justify-center shadow-sm"
          onPress={openAddForm}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={22} color="#F59E0B" />
          <Text className="text-yellow-600 text-base font-semibold ml-2">Add New Address</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderForm = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-row items-center px-4 py-4 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => animateTo('list')} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-gray-900 text-lg font-bold">{editingId ? 'Edit Address' : 'New Address'}</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4 bg-gray-50">
        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Label</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
            placeholder="e.g. Home, Office"
            placeholderTextColor="#9CA3AF"
            value={form.label}
            onChangeText={(v) => setForm({ ...form, label: v })}
          />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Street / Unit</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
            placeholder="Street name, building, unit"
            placeholderTextColor="#9CA3AF"
            value={form.street}
            onChangeText={(v) => setForm({ ...form, street: v })}
          />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Barangay</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
            placeholder="Barangay"
            placeholderTextColor="#9CA3AF"
            value={form.barangay}
            onChangeText={(v) => setForm({ ...form, barangay: v })}
          />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">City</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
            placeholder="City / Municipality"
            placeholderTextColor="#9CA3AF"
            value={form.city}
            onChangeText={(v) => setForm({ ...form, city: v })}
          />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-200 shadow-sm">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Province</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm border border-gray-200"
            placeholder="Province"
            placeholderTextColor="#9CA3AF"
            value={form.province}
            onChangeText={(v) => setForm({ ...form, province: v })}
          />
        </View>

        <TouchableOpacity
          className="bg-white rounded-2xl p-4 mb-6 border border-dashed border-gray-300 flex-row items-center justify-center shadow-sm"
          onPress={() => {
            setMapLat(form.latitude ? Number(form.latitude) : 14.5995);
            setMapLng(form.longitude ? Number(form.longitude) : 120.9842);
            if (!isMapVisible) {
              setMapKey(prev => prev + 1);
            }
            animateTo('map');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="map-outline" size={22} color="#F59E0B" />
          <Text className="text-yellow-600 text-base font-semibold ml-2">
            {form.latitude && form.longitude ? 'Change Location on Map' : 'Select on Map'}
          </Text>
        </TouchableOpacity>

        {form.latitude && form.longitude && (
          <View className="bg-white rounded-2xl p-4 mb-6 border border-gray-200 shadow-sm">
            <Text className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Selected Coordinates</Text>
            <Text className="text-gray-900 text-sm">
              {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
            </Text>
          </View>
        )}
      </ScrollView>

      <View className="px-4 pb-6 pt-2 border-t border-gray-200 bg-white">
        <TouchableOpacity
          className="bg-yellow-400 py-3.5 rounded-xl items-center"
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#78350F" />
          ) : (
            <Text className="text-yellow-900 font-bold text-base">
              {editingId ? 'Update Address' : 'Save Address'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderMap = () => (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => animateTo('form')} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-gray-900 text-lg font-bold">Pin Your Location</Text>
        </View>
        <TouchableOpacity
          className="bg-yellow-400 px-4 py-2 rounded-lg"
          onPress={handleMapConfirm}
        >
          <Text className="text-yellow-900 font-semibold text-sm">Confirm</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          key={mapKey}
          ref={webViewRef}
          source={{ html: MAP_HTML(mapLat, mapLng) }}
          style={{ flex: 1, backgroundColor: '#f3f4f6' }}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          onShouldStartLoadWithRequest={() => true}
        />
      </View>

      <View className="bg-white px-4 py-3 border-t border-gray-200">
        <Text className="text-gray-500 text-xs text-center">
          Drag the pin or tap the map to set your location
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {viewMode === 'list' && renderList()}
        {viewMode === 'form' && renderForm()}
        {viewMode === 'map' && renderMap()}
      </View>
    </Modal>
  );
}