import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';

interface GpsGateProps {
  children: React.ReactNode;
}

export default function GpsGate({ children }: GpsGateProps) {
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'denied' | 'granted'>('loading');
  const [requesting, setRequesting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (mountedRef.current) {
        setGpsStatus(status === 'granted' ? 'granted' : 'denied');
      }
    } catch {
      if (mountedRef.current) setGpsStatus('denied');
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  const requestGps = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (mountedRef.current) {
        if (status === 'granted') {
          setGpsStatus('granted');
        } else {
          setGpsStatus('denied');
          Alert.alert(
            'GPS Required',
            'Location access is needed to find nearby branches and track deliveries. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    } catch {
      if (mountedRef.current) setGpsStatus('denied');
    } finally {
      if (mountedRef.current) setRequesting(false);
    }
  };

  if (gpsStatus === 'loading') {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.title}>Checking GPS...</Text>
        </View>
      </View>
    );
  }

  if (gpsStatus === 'denied') {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="locate" size={40} color="#10B981" />
          </View>
          <Text style={styles.title}>Enable Location</Text>
          <Text style={styles.subtitle}>
            Allow location access to find nearby branches, estimate delivery times, and track your orders in real-time.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={requestGps}
            disabled={requesting}
            activeOpacity={0.8}
          >
            {requesting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="navigate" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Enable GPS</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => router.replace('/Login')}
          >
            <Text style={{ color: '#6B7280', fontSize: 14 }}>Go Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    width: '100%',
  },
});
