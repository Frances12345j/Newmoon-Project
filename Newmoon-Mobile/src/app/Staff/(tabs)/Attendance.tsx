import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, CARD } from '../../../lib/staffTheme';
import FaceDetectionWebView, {
  type FaceDetectionWebViewHandle,
} from '../../../../components/FaceDetectionWebView';
import api from '../../../../lib/api';
import { getUser as getStoredUser } from '../../../../lib/userStorage';
import { buildLandmarkEmbedding, normalizeEmbedding } from '../../../../utils/faceEmbedding';
import { FaceScanOverlay, type ScanPhase } from '../../../../components/staff/FaceScanOverlay';
import {  
  isFaceDetectorNativeAvailable,
} from '../../../../utils/expoFaceDetectorOptional';
import { landmarks68ToFaceLandmarksInput } from '../../../../utils/landmarks68ToFace';

function isStaffUser(u: any): boolean {
  return String(u?.role ?? '').toLowerCase() === 'staff';
}

function attendanceErrorMessage(error: any): string {
  const code = error?.response?.data?.code;
  if (code === 'FACE_MISMATCH') {
    return 'Face not recognized. Match your enrollment pose and lighting.';
  }
  if (code === 'FACE_NOT_ENROLLED') {
    return 'Register your face on this screen before time in or out.';
  }
  if (code === 'FACE_EMBEDDING_REQUIRED') {
    return 'Face check did not complete. Try again.';
  }
  if (code === 'FACE_DIM_MISMATCH') {
    return 'Face data format changed. Register your face again.';
  }
  if (code === 'FACE_TEMPLATE_WEAK') {
    return 'Old face template found. Register again to use high-accuracy face recognition.';
  }
  if (code === 'FACE_STRONG_EMBEDDING_REQUIRED') {
    return 'High-accuracy face model is still loading. Keep this screen open, then retry.';
  }
  if (code === 'FACE_REENROLL_MISMATCH') {
    return 'Re-enroll failed because the face does not match the currently enrolled owner.';
  }
  if (code === 'FACE_REENROLL_BLOCKED') {
    return 'Existing face template is incompatible. Ask admin to reset face enrollment.';
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  return error?.message ?? 'Something went wrong.';
}

function TimeOutCountdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  const ms = Math.max(0, until - now);
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <>{`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}</>;
}

function ScreenCenter(props: { title?: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.BG_PAGE, paddingHorizontal: 24 }}>
      {props.title ? <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 16, fontWeight: '600' }}>{props.title}</Text> : null}
      {props.subtitle ? (
        <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginTop: 8 }}>{props.subtitle}</Text>
      ) : null}
      {props.children ? <View style={{ marginTop: 20, width: '100%' }}>{props.children}</View> : null}
    </View>
  );
}

function Pill(props: { text: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const tone = props.tone ?? 'neutral';
  const cls =
    tone === 'success'
      ? 'bg-green-100 text-green-700 border-green-200'
      : tone === 'danger'
        ? 'bg-red-100 text-red-700 border-red-200'
        : tone === 'warning'
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <View className={`px-3 py-1 rounded-full border ${cls}`}>
      <Text className="text-xs font-semibold">{props.text}</Text>
    </View>
  );
}

function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'violet' | 'blue' | 'green' | 'red';
  loading?: boolean;
}) {
  const tone = props.tone ?? 'blue';
  const base =
    tone === 'violet'
      ? 'bg-[#E53935]'
      : tone === 'green'
        ? 'bg-[#16A34A]'
        : tone === 'red'
          ? 'bg-[#DC2626]'
          : 'bg-[#E53935]';
  return (
    <TouchableOpacity
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      className={`py-4 rounded-xl items-center ${props.disabled || props.loading ? 'bg-gray-200' : base}`}
    >
      {props.loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white font-bold text-base">{props.label}</Text>
      )}
    </TouchableOpacity>
  );
}

function InfoRow(props: { label: string; value: React.ReactNode }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1.5">
      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>{props.label}</Text>
      <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600', textAlign: 'right', flex: 1 }}>{props.value}</Text>
    </View>
  );
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return <View style={CARD} className={`${props.className ?? ''}`}>{props.children}</View>;
}

// ===== HELPER: extract attendance record from paginated or plain response =====
function extractAttendanceRecord(data: any): any | null {
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
    // Laravel paginated response: { data: [...], current_page: 1, ... }
    return data.data[0] || null;
  }
  return data || null;
}

export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [mode, setMode] = useState<'time_in' | 'time_out'>('time_in');
  const [attendance, setAttendance] = useState<any | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [staffAssignment, setStaffAssignment] = useState<any | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceStatusLoading, setFaceStatusLoading] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [enrollingFace, setEnrollingFace] = useState(false);
  const [faceModuleAvailable] = useState(() => {
    const ok = isFaceDetectorNativeAvailable();
    console.log('[FACE] Native expo-face-detector usable (not Expo Go + module linked):', ok);
    return ok;
  });
  const [scanPhase, setScanPhase] = useState<ScanPhase>('scanning');
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const [scanThreshold, setScanThreshold] = useState<number | null>(null);
  const [showBottomDetails, setShowBottomDetails] = useState(false);
  const [currentDate, setCurrentDate] = useState<string>(getPhilippinesTime().date);

  const cameraRef = useRef<InstanceType<typeof CameraView> | null>(null);
  const faceWebRef = useRef<FaceDetectionWebViewHandle | null>(null);
  const scanInFlightRef = useRef(false);
  const scanCooldownUntilRef = useRef<number>(0);
  const TIME_OUT_LOCK_MS = 2 * 60 * 1000;
  const TIME_OUT_LOCK_KEY = 'attendance_timeOutLockUntil';
  const [timeOutLockUntil, setTimeOutLockUntil] = useState<number>(0);

  const timeOutLocked = timeOutLockUntil > Date.now();

  const startTimeOutLock = async (source: 'auto_time_in' | 'manual_time_in') => {
    const until = Date.now() + TIME_OUT_LOCK_MS;
    setTimeOutLockUntil(until);
    console.log('[ATTENDANCE] time-out lock start', { source, until, ms: TIME_OUT_LOCK_MS });
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TIME_OUT_LOCK_KEY, String(until));
      } else {
        await SecureStore.setItemAsync(TIME_OUT_LOCK_KEY, String(until));
      }
    } catch (e) {
      console.log('[ATTENDANCE] failed saving time-out lock', e);
    }
  };

  const clearTimeOutLock = async (source: 'time_out' | 'expired' | 'load' | 'new_day') => {
    setTimeOutLockUntil(0);
    console.log('[ATTENDANCE] time-out lock clear', { source });
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TIME_OUT_LOCK_KEY);
      } else {
        await SecureStore.deleteItemAsync(TIME_OUT_LOCK_KEY);
      }
    } catch (e) {
      console.log('[ATTENDANCE] failed clearing time-out lock', e);
    }
  };

  function getPhilippinesTime() {
    const now = new Date();
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const time = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return { date, time };
  }

  const getAttendanceDate = (record: any) => {
    const rawDate = record?.date || record?.created_at || '';
    if (typeof rawDate !== 'string') return '';
    const match = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  };

  const todayDate = getPhilippinesTime().date;
  const attendanceDate = getAttendanceDate(attendance);
  const isTodayAttendance = attendanceDate === todayDate;
  const hasTimedIn = Boolean(attendance?.time_in);
  const hasTimedOut = Boolean(attendance?.time_out);
  const hasOpenAttendance = hasTimedIn && !hasTimedOut;
  const hasCompletedToday = isTodayAttendance && hasTimedIn && hasTimedOut;
  const hasTimedInToday = isTodayAttendance && hasTimedIn;
  const staffNeedsFace = user ? isStaffUser(user) : false;
  const staffFaceReady = !staffNeedsFace || (!faceStatusLoading && faceEnrolled);
  const canTimeIn =
    staffFaceReady && !attendanceLoading && !hasOpenAttendance && !hasCompletedToday;
  const canTimeOut = staffFaceReady && !attendanceLoading && hasOpenAttendance;
  const canTimeOutEffective = canTimeOut && !timeOutLocked;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = Platform.OS === 'web'
          ? localStorage.getItem(TIME_OUT_LOCK_KEY)
          : await SecureStore.getItemAsync(TIME_OUT_LOCK_KEY);
        const n = raw ? Number(raw) : 0;
        if (!mounted) return;
        if (Number.isFinite(n) && n > Date.now()) {
          setTimeOutLockUntil(n);
          console.log('[ATTENDANCE] restored time-out lock', { until: n });
        } else if (Number.isFinite(n) && n > 0) {
          await clearTimeOutLock('load');
        }
      } catch (e) {
        console.log('[ATTENDANCE] failed restoring time-out lock', e);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timeOutLocked && timeOutLockUntil > 0) {
      clearTimeOutLock('expired');
    }
  }, [timeOutLocked, timeOutLockUntil]);

  // Daily reset logic: check if day has changed and reset state
  useEffect(() => {
    const checkDayChange = () => {
      const today = getPhilippinesTime().date;
      if (today !== currentDate) {
        console.log('[ATTENDANCE] Day changed from', currentDate, 'to', today);
        setCurrentDate(today);
        setAttendance(null);
        setMode('time_in');
        clearTimeOutLock('new_day');
        // Reload attendance for the new day
        if (user?.id && branchId) {
          loadAttendanceRecord(user.id, branchId);
        }
      }
    };

    // Check immediately
    checkDayChange();

    // Check every minute for day changes
    const interval = setInterval(checkDayChange, 60000);

    return () => clearInterval(interval);
  }, [currentDate, user?.id, branchId]);

  useEffect(() => {
    loadUserData();
  }, []);

  const addDebug = (message: string) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + message);
  };

  const refreshFaceStatus = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    if (!isStaffUser(user)) {
      console.log('[FACE] Non-staff user; skip enrollment status');
      setFaceEnrolled(true);
      setFaceStatusLoading(false);
      return;
    }

    setFaceStatusLoading(true);
    try {
      const res = await api.get('/face/status');
      console.log('[FACE] /face/status', res.data);
      setFaceEnrolled(res.data?.enrolled === true);
    } catch (err) {
      console.log('[FACE] status request failed', err);
      setFaceEnrolled(false);
    } finally {
      setFaceStatusLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    refreshFaceStatus();
  }, [refreshFaceStatus]);

  const loadUserData = async () => {
    try {
      setUserLoading(true);
      setDebugInfo('Loading user data...');
      
      // Get user from storage
      const userRaw = Platform.OS === 'web'
        ? localStorage.getItem('user')
        : await SecureStore.getItemAsync('user');
      addDebug(`User from storage: ${userRaw ? 'Found' : 'Not found'}`);
      
      let userData = userRaw ? JSON.parse(userRaw) : null;
      if (!userData?.id) {
        userData = await getStoredUser();
      }
      
      if (!userData?.id) {
        addDebug('No user ID in storage, fetching from API...');
        try {
          const response = await api.get('/me');
          userData = response.data || {};
          addDebug(`User fetched: ID=${userData.id}, Name=${userData.name}`);
          if (Platform.OS === 'web') {
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            await SecureStore.setItemAsync('user', JSON.stringify(userData));
          }
        } catch (error: any) {
          addDebug(`Failed to fetch user: ${error.message}`);
          console.error('Failed to fetch user:', error);
        }
      }
      
      setUser(userData);
      addDebug(`User ID: ${userData?.id}`);
      
      // Fetch staff assignment from staff_assignments table
      if (userData?.id) {
        await fetchStaffAssignment(userData.id);
      }
      
    } catch (error: any) {
      addDebug(`Error in loadUserData: ${error.message}`);
      console.error('Failed to load user data:', error);
      Alert.alert('Error', 'Failed to load user data. Please login again.');
    } finally {
      setUserLoading(false);
    }
  };

  const fetchStaffAssignment = async (userId: number) => {
    try {
      addDebug(`Fetching staff assignment for user ID: ${userId}`);
      
      // Try to get staff assignment from staff_assignments table
      const response = await api.get(`/staff-assignments`, {
        params: { user_id: userId, is_active: true }
      });
      
      addDebug(`Staff assignment response: ${JSON.stringify(response.data)}`);
      
      let assignment = null;
      
      // Check if response is array and has data
      const responseData = response?.data;
      if (Array.isArray(responseData) && responseData.length > 0) {
        assignment = responseData[0];
      } else if (responseData?.data && Array.isArray(responseData.data) && responseData.data.length > 0) {
        // Handle paginated response (Laravel pagination)
        assignment = responseData.data[0];
      } else if (responseData && typeof responseData === 'object' && !responseData.data) {
        assignment = responseData;
      }
      
      if (assignment && assignment.branch_id) {
        setStaffAssignment(assignment);
        setBranchId(assignment.branch_id);
        addDebug(`Found active staff assignment - Branch ID: ${assignment.branch_id}, Position: ${assignment.position}, Daily Rate: ${assignment.daily_rate}`);
        
        // Update user data with branch info
        const updatedUser = { ...user, branch_id: assignment.branch_id, staff_assignment: assignment };
        if (Platform.OS === 'web') {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } else {
          await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
        }
        
        // Load attendance record
        await loadAttendanceRecord(userId, assignment.branch_id);
      } else {
        addDebug('No active staff assignment found');
        setBranchId(null);
      }
      
    } catch (error: any) {
      addDebug(`Error fetching staff assignment: ${error.message}`);
      console.error('Failed to fetch staff assignment:', error);
      
      // Try alternative endpoint if needed
      try {
        addDebug('Trying alternative endpoint: /staff/{userId}/assignment');
        const altResponse = await api.get(`/staff/${userId}/assignment`);
        addDebug(`Alternative response: ${JSON.stringify(altResponse.data)}`);
        
        if (altResponse.data && altResponse.data.branch_id) {
          setStaffAssignment(altResponse.data);
          setBranchId(altResponse.data.branch_id);
          addDebug(`Found via alternative endpoint - Branch ID: ${altResponse.data.branch_id}`);
          
           await loadAttendanceRecord(userId, altResponse.data.branch_id);
        }
      } catch (altError: any) {
        addDebug(`Alternative endpoint also failed: ${altError.message}`);
      }
    }
  };

  // ===== FIXED: loadAttendanceRecord with proper extraction =====
  const loadAttendanceRecord = async (userId: number, branchIdValue: number) => {
    if (!userId || !branchIdValue) return;

    setAttendanceLoading(true);
    try {
      const { date: today } = getPhilippinesTime();
      addDebug(`Fetching attendance for user=${userId}, branch=${branchIdValue}, date=${today}`);

      const response = await api.get('/attendance', {
        params: { user_id: userId, branch_id: branchIdValue, date: today }
      });

      // ✅ Extract the record from either plain array or paginated object
      let record = extractAttendanceRecord(response?.data);

      if (!record) {
        // Fallback: try again (already same query, but keep for safety)
        const fallbackResponse = await api.get('/attendance', {
          params: { user_id: userId, branch_id: branchIdValue, date: today }
        });
        const fallbackData = fallbackResponse?.data;
        // Extract from paginated if needed
        const records = Array.isArray(fallbackData)
          ? fallbackData
          : (fallbackData?.data && Array.isArray(fallbackData.data) ? fallbackData.data : []);
        // Only consider records from today
        record = records.find((item: any) => {
          const itemDate = getAttendanceDate(item);
          return itemDate === today && item?.time_in && !item?.time_out;
        }) || null;
      }

      setAttendance(record);
      addDebug(`Attendance record: ${record ? 'Found' : 'Not found'}`);
      if (record) {
        addDebug(`Time In: ${record.time_in || 'Not set'}, Time Out: ${record.time_out || 'Not set'}`);
      }
    } catch (error: any) {
      addDebug(`Failed to load attendance: ${error.message}`);
      console.error('Failed to load attendance:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const [tabFocused, setTabFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      if (!user?.id || !branchId) {
        return;
      }
      console.log('[ATTENDANCE UI] screen focused; refreshing face status + attendance');
      refreshFaceStatus();
      loadAttendanceRecord(user.id, branchId);
      return () => {
        setTabFocused(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, branchId])
  );

  const showFaceNeedsDevBuild = () => {
    Alert.alert(
      'Face detection',
      'Native face module failed. If you use Expo Go, wait on Wi‑Fi for browser models, or run npx expo prebuild then npx expo run:android.'
    );
  };

  const waitForWebFaceReady = async (timeoutMs = 120000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (faceWebRef.current?.ready) {
        console.log('[FACE-WEB] ready after', Date.now() - t0, 'ms');
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error('WEB_FACE_TIMEOUT');
  };

  const captureFaceEmbedding = async (opts?: { silent?: boolean; requireStrong?: boolean }): Promise<number[] | null> => {
    if (!cameraRef.current) {
      if (!opts?.silent) {
        Alert.alert('Camera', 'Camera is not ready yet.');
      }
      return null;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        base64: true,
        shutterSound: false,
      });
      console.log('[FACE] captured frame', photo?.width, photo?.height);

      console.log('[FACE] WebView face-api.js path (preferred for recognition)');
      try {
        await waitForWebFaceReady(120000);
      } catch {
        if (!opts?.silent) {
          Alert.alert(
            'Face detection',
            'Face models did not load. Use Wi‑Fi, stay on this screen ~30s, then try again.'
          );
        }
        return null;
      }

      if (!faceWebRef.current?.ready) {
        if (!opts?.silent) {
          Alert.alert('Face detection', 'Browser face engine not ready yet.');
        }
        return null;
      }

      const b64 =
        typeof photo.base64 === 'string'
          ? photo.base64
          : await FileSystemLegacy.readAsStringAsync(photo.uri, {
              encoding: FileSystemLegacy.EncodingType.Base64,
            });
      const webRes = await faceWebRef.current.detectFromBase64(b64);
      console.log('[FACE-WEB] result', webRes.ok, !webRes.ok ? webRes.code : '');

      if (!webRes.ok) {
        if (!opts?.silent) {
          if (webRes.code === 'NO_FACE') {
            Alert.alert('Face check', 'No face detected. Move closer and use good lighting.');
          } else if (webRes.code === 'MULTI_FACE') {
            Alert.alert('Face check', 'Only one person should be in the frame.');
          } else if (webRes.code === 'TIMEOUT' || webRes.code === 'NOT_READY') {
            Alert.alert('Face detection', 'Models still loading. Wait on Wi‑Fi a few seconds and retry.');
          } else {
            Alert.alert('Face check', webRes.error || webRes.code || 'Could not verify face.');
          }
        }
        return null;
      }

      if (Array.isArray(webRes.descriptor) && webRes.descriptor.length >= 64) {
        console.log('[FACE] Using face-api descriptor dim=', webRes.descriptor.length);
        return normalizeEmbedding(webRes.descriptor.map((v) => Number(v)));
      }

      const faceInput = landmarks68ToFaceLandmarksInput(webRes.box, webRes.landmarks);
      if (!faceInput) {
        if (!opts?.silent) {
          Alert.alert('Face check', 'Could not map landmarks. Face the camera straight on.');
        }
        return null;
      }

      const embedding = buildLandmarkEmbedding(faceInput);
      if (!embedding) {
        if (!opts?.silent) {
          Alert.alert(
            'Face check',
            'Could not read face geometry. Try brighter light and face straight on.'
          );
        }
        return null;
      }

      if (opts?.requireStrong) {
        if (!opts?.silent) {
          Alert.alert(
            'Face recognition',
            'High-accuracy face descriptor not ready yet. Stay on this screen for model loading, then retry.'
          );
        }
        return null;
      }
      return embedding;
    } catch (err: any) {
      console.log('[FACE] captureFaceEmbedding error', err?.message, err);
      const msg = String(err?.message ?? '');
      if (
        msg.includes('not available') ||
        msg.includes('Cannot find native module') ||
        msg.includes('ExpoFaceDetector') ||
        err?.code === 'ERR_UNAVAILABLE'
      ) {
        if (!opts?.silent) {
          showFaceNeedsDevBuild();
        }
      } else {
        if (!opts?.silent) {
          Alert.alert('Face check', msg || 'Could not verify face.');
        }
      }
      return null;
    }
  };

  // ===== FIXED: submitAutoAttendance with record extraction =====
  const submitAutoAttendance = async () => {
    if (!user?.id || !branchId) return;
    if (!isStaffUser(user) || !faceEnrolled) return;
    if (loading || enrollingFace) return;

    const now = Date.now();
    if (scanInFlightRef.current) return;
    if (now < scanCooldownUntilRef.current) return;

    const shouldTimeIn = mode === 'time_in' && canTimeIn;
    const shouldTimeOut = mode === 'time_out' && canTimeOutEffective;
    if (!shouldTimeIn && !shouldTimeOut) return;

    scanInFlightRef.current = true;
    setScanPhase('scanning');
    try {
      const emb = await captureFaceEmbedding({ silent: true, requireStrong: true });
      if (!emb) {
        setScanPhase('scanning');
        return;
      }

      setScanPhase('checking');

      if (shouldTimeIn) {
        const { date, time } = getPhilippinesTime();
        const body: Record<string, unknown> = {
          user_id: user.id,
          branch_id: branchId,
          date,
          time_in: time,
          face_embedding: emb,
        };
        console.log('[FACE] auto time-in request');
        const response = await api.post('/attendance/time-in', body);
        const responseData = response.data as Record<string, unknown>;
        setAttendance(extractAttendanceRecord(responseData));
        setMode('time_out');
        startTimeOutLock('auto_time_in');
        const sim = responseData?.similarity;
        const th = responseData?.threshold;
        if (typeof sim === 'number') setScanConfidence(sim);
        if (typeof th === 'number') setScanThreshold(th);
        Alert.alert('Success', `Time In recorded at ${time}`);
        scanCooldownUntilRef.current = Date.now() + 2500;
        return;
      }

      if (shouldTimeOut && attendance?.id) {
        const { time } = getPhilippinesTime();
        const body: Record<string, unknown> = {
          time_out: time,
          face_embedding: emb,
        };
        console.log('[FACE] auto time-out request');
        const response = await api.put(`/attendance/${attendance.id}/time-out`, body);
        const responseData = response.data as Record<string, unknown>;
        setAttendance(extractAttendanceRecord(responseData));
        setMode('time_in');
        clearTimeOutLock('time_out');
        const sim = responseData?.similarity;
        const th = responseData?.threshold;
        if (typeof sim === 'number') setScanConfidence(sim);
        if (typeof th === 'number') setScanThreshold(th);
        Alert.alert('Success', `Time Out recorded at ${time}`);
        scanCooldownUntilRef.current = Date.now() + 2500;
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const sim = err?.response?.data?.similarity;
      const th = err?.response?.data?.threshold;
      console.log('[FACE] auto attendance error', code, err?.response?.data ?? err?.message);
      if (code === 'FACE_MISMATCH') {
        setScanPhase('mismatch');
        if (typeof sim === 'number') setScanConfidence(sim);
        if (typeof th === 'number') setScanThreshold(th);
        scanCooldownUntilRef.current = Date.now() + 2500;
        setTimeout(() => setScanPhase('scanning'), 2000);
      } else {
        Alert.alert('Error', attendanceErrorMessage(err));
        scanCooldownUntilRef.current = Date.now() + 2500;
      }
    } finally {
      scanInFlightRef.current = false;
      if (Date.now() >= scanCooldownUntilRef.current) {
        setScanPhase('scanning');
      }
    }
  };

  useEffect(() => {
    if (!permission?.granted) return;
    if (!user?.id) return;
    if (!isStaffUser(user)) return;
    if (!faceEnrolled) return;
    if (!branchId) return;
    if (faceStatusLoading) return;

    const id = setInterval(() => {
      submitAutoAttendance();
    }, 1600);

    return () => clearInterval(id);
  }, [
    permission?.granted,
    user?.id,
    user?.role,
    faceEnrolled,
    faceStatusLoading,
    branchId,
    mode,
    canTimeIn,
    canTimeOut,
    attendance?.id,
    loading,
    enrollingFace,
  ]);

  const handleRegisterFace = async () => {
    if (!isStaffUser(user)) {
      return;
    }
    setEnrollingFace(true);
    try {
      const embedding = await captureFaceEmbedding({ requireStrong: true });
      if (!embedding) {
        return;
      }
      const res = await api.post('/face/enroll', { embedding });
      console.log('[FACE] enroll ok', res.data);
      setFaceEnrolled(true);
      Alert.alert('Done', 'Your face is registered for attendance.');
    } catch (err: any) {
      console.log('[FACE] enroll failed', err?.response?.data ?? err?.message);
      Alert.alert('Register face', attendanceErrorMessage(err));
    } finally {
      setEnrollingFace(false);
    }
  };

  // ===== FIXED: handleTimeIn with record extraction =====
  const handleTimeIn = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    if (hasTimedInToday) {
      Alert.alert(
        'Already Timed In',
        isTodayAttendance
          ? 'You already recorded your time in for today.'
          : 'You still need to time out from your previous attendance record.'
      );
      setMode('time_out');
      return;
    }
    
    if (!branchId) {
      Alert.alert(
        'No Branch Assignment',
        'You are not assigned to any branch. Please contact administrator to assign you in staff_assignments table.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setLoading(true);
    try {
      const { date, time } = getPhilippinesTime();
      addDebug(`Time In: user=${user.id}, branch=${branchId}, date=${date}, time=${time}`);

      let faceEmbedding: number[] | undefined;
      if (isStaffUser(user)) {
        const emb = await captureFaceEmbedding({ requireStrong: true });
        if (!emb) {
          setLoading(false);
          return;
        }
        faceEmbedding = emb;
      }

      const body: Record<string, unknown> = {
        user_id: user.id,
        branch_id: branchId,
        date: date,
        time_in: time,
      };
      if (faceEmbedding) {
        body.face_embedding = faceEmbedding;
      }

      const response = await api.post('/attendance/time-in', body);
      const responseData = response.data as Record<string, unknown>;
      const record = extractAttendanceRecord(responseData);
      setAttendance(record);
      const sim = responseData?.similarity;
      const th = responseData?.threshold;
      if (typeof sim === 'number') setScanConfidence(sim);
      if (typeof th === 'number') setScanThreshold(th);
      setMode('time_out');
      startTimeOutLock('manual_time_in');
      Alert.alert('Success', `Time In recorded at ${time}`);
      addDebug(`Time In successful`);
    } catch (error: any) {
      addDebug(`Time In error: ${error.message}`);
      console.error('Time in error:', error);
      
      Alert.alert('Error', attendanceErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // ===== FIXED: handleTimeOut with record extraction =====
  const handleTimeOut = async () => {
    if (!attendance?.id) {
      Alert.alert('Error', 'Please time in first');
      return;
    }

    if (timeOutLocked) {
      console.log('[ATTENDANCE] time-out blocked (cooldown)', { msLeft: timeOutLockUntil - Date.now() });
      Alert.alert(
        'Please wait',
        `Time Out will be available in ${((w) => { const t = Math.ceil(Math.max(0, w) / 1000); const m = Math.floor(t / 60); const s = t % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; })(Math.max(0, timeOutLockUntil - Date.now()))}.`
      );
      return;
    }

    if (!hasTimedIn) {
      Alert.alert('Time In Required', 'Please time in first before recording time out.');
      setMode('time_in');
      return;
    }

    if (hasTimedOut) {
      Alert.alert('Already Timed Out', 'You already recorded your time out for today. You can time in again tomorrow.');
      return;
    }
    
    setLoading(true);
    try {
      const { time } = getPhilippinesTime();
      addDebug(`Time Out: attendance=${attendance.id}, time=${time}`);

      let faceEmbedding: number[] | undefined;
      if (isStaffUser(user)) {
        const emb = await captureFaceEmbedding({ requireStrong: true });
        if (!emb) {
          setLoading(false);
          return;
        }
        faceEmbedding = emb;
      }

      const body: Record<string, unknown> = { time_out: time };
      if (faceEmbedding) {
        body.face_embedding = faceEmbedding;
      }

      const response = await api.put(`/attendance/${attendance.id}/time-out`, body);
      const responseData = response.data as Record<string, unknown>;
      const record = extractAttendanceRecord(responseData);
      setAttendance(record);
      const sim = responseData?.similarity;
      const th = responseData?.threshold;
      if (typeof sim === 'number') setScanConfidence(sim);
      if (typeof th === 'number') setScanThreshold(th);
      setMode('time_in');
      clearTimeOutLock('time_out');
      Alert.alert('Success', `Time Out recorded at ${time}`);
      addDebug(`Time Out successful`);
    } catch (error: any) {
      addDebug(`Time Out error: ${error.message}`);
      console.error('Time out error:', error);
      
      Alert.alert('Error', attendanceErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <ScreenCenter
        title="Camera permission required"
        subtitle="Enable camera access to record time in/out with face verification."
      >
        <PrimaryButton label="Grant Permission" onPress={requestPermission} tone="blue" />
      </ScreenCenter>
    );
  }

  if (userLoading) {
    return (
      <ScreenCenter title="Loading user data...">
        <View className="items-center">
          <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        </View>
      </ScreenCenter>
    );
  }

  if (!user) {
    return (
      <ScreenCenter title="Session expired" subtitle="Please login again to continue.">
        <PrimaryButton
          label="Login Again"
          onPress={() => {
            // Navigate to login
          }}
          tone="blue"
        />
      </ScreenCenter>
    );
  }

  const staffUser = user ? isStaffUser(user) : false;
  const showFaceWebLayer = staffUser && !!branchId;

  // Show debug view if no branch
  if (!branchId) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }} contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
        <View className="pt-10 pb-4 items-center">
          <Pill text="Action needed" tone="warning" />
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 20, fontWeight: '800', marginTop: 12 }}>No Branch Assignment</Text>
          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            You are not assigned to any branch in the staff assignments table.
          </Text>
        </View>

        <Card className="p-4">
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', marginBottom: 12 }}>User information</Text>
          <InfoRow label="ID" value={user.id} />
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role || user.role_id || 'Staff'} />
        </Card>

        <View className="h-4"></View>

        <Card className="p-4">
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', marginBottom: 8 }}>Quick fix (SQL)</Text>
          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12, marginBottom: 12 }}>
            Add an active row in <Text style={{ fontWeight: '600' }}>staff_assignments</Text> for this user.
          </Text>
          <View style={{ backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: '#34D399', fontSize: 11, lineHeight: 16 }}>
              INSERT INTO staff_assignments (user_id, branch_id, position, daily_rate, is_active, created_at, updated_at){'\n'}
              VALUES ({user.id}, 1, &apos;Staff&apos;, 500.00, 1, NOW(), NOW());
            </Text>
          </View>
        </Card>

        <View className="h-4" />

        <Card className="p-4">
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', marginBottom: 8 }}>Debug information</Text>
          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 11, lineHeight: 16 }}>{debugInfo || 'No debug info'}</Text>
        </Card>

        <View className="h-5"></View>

        <PrimaryButton label="Retry Loading" onPress={loadUserData} tone="blue" />
      </ScrollView>
    );
  }

  let attendanceBody: React.ReactNode;

  // Staff: loading face enrollment status before showing attendance camera
  if (staffUser && faceStatusLoading) {
    console.log('[FACE] Blocking UI until face status is loaded');
    attendanceBody = (
      <View style={{ flex: 1, backgroundColor: COLORS.BG_PAGE, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
        <Text style={{ color: COLORS.TEXT_PRIMARY, marginTop: 16, textAlign: 'center', fontSize: 16 }}>
          Checking face registration...
        </Text>
      </View>
    );
  } else if (staffUser && !faceEnrolled) {
    console.log('[FACE UI] render registration-first layout');
    // Staff without enrolled face: registration only
    attendanceBody = (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.BG_PAGE }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }}>
        <View className="px-4 pt-12 pb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 22, fontWeight: '800' }}>Face registration</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 4 }}>{user.name}</Text>
            </View>
            <Pill text="Required" tone="warning" />
          </View>

          <View className="mt-4">
            <Card className="p-4">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700' }}>Assignment</Text>
                <Pill text={`Branch #${branchId}`} />
              </View>
              <View className="mt-2">
                <InfoRow label="Position" value={staffAssignment?.position || 'Staff'} />
                <InfoRow label="Daily rate" value={`₱${staffAssignment?.daily_rate || '0'}`} />
              </View>
            </Card>
          </View>

          <View className="mt-4">
            <Card className="p-4">
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700' }}>How to register</Text>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, marginTop: 8 }}>
                Keep your face centered in the guide frame, then tap Register face.
              </Text>
              <View className="mt-3 gap-2">
                <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>- Use bright, even lighting</Text>
                <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>- Keep only one face in view</Text>
                <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>- Remove mask/sunglasses</Text>
              </View>
              {!faceModuleAvailable ? (
                <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 12, lineHeight: 16 }}>
                  First-time setup may take longer while browser face models load. Keep this screen open.
                </Text>
              ) : null}
            </Card>
          </View>
        </View>

        <View className="mx-4 mt-1 rounded-3xl overflow-hidden border border-[#E53935]/30" style={{ backgroundColor: '#F1F5F9', minHeight: 390 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER }} className="px-4 py-3 flex-row items-center justify-between">
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '600' }}>Camera preview</Text>
            <Pill text={torchOn ? 'Light on' : 'Light off'} tone={torchOn ? 'success' : 'neutral'} />
          </View>

          <View style={{ minHeight: 340 }}>
            <CameraView
              ref={cameraRef}
              style={{ flex: 1, minHeight: 340 }}
              facing="front"
              enableTorch={torchOn}
            />
            <View className="absolute left-8 right-8 top-10 bottom-10 border-2 border-[#E53935]/70 rounded-3xl" pointerEvents="none"></View>
            <View className="absolute bottom-4 left-4 right-4 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  const next = !torchOn;
                  console.log('[FACE] enrollment torch', next);
                  setTorchOn(next);
                }}
                style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: COLORS.INPUT_BORDER }}
                className="px-3 py-2 rounded-xl"
              >
                <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>{torchOn ? 'Turn light off' : 'Turn light on'}</Text>
              </TouchableOpacity>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: COLORS.INPUT_BORDER }} className="px-3 py-2 rounded-xl">
                <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>Ready</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-4 mt-5">
          <PrimaryButton
            label="Register face"
            onPress={handleRegisterFace}
            tone="violet"
            loading={enrollingFace}
          />
          <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            Register once to enable secure time in and time out.
          </Text>
        </View>

        <View className="px-4 mt-4">
          <Card className="p-4">
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', marginBottom: 8 }}>Today</Text>
            {attendanceLoading ? (
              <ActivityIndicator size="small" color={COLORS.PRIMARY_RED} />
            ) : attendance ? (
              <>
                <InfoRow label="Time in" value={attendance.time_in || '—'} />
                <InfoRow label="Time out" value={attendance.time_out || '—'} />
                {Boolean(attendance.is_late) ? (
                  <View className="mt-2">
                    <Pill text={`Late by ${attendance.late_minutes} min`} tone="warning" />
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 14 }}>No attendance record yet</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    );
  } else if (hasCompletedToday) {
    console.log('[ATTENDANCE UI] Completed for today; showing return tomorrow state');
    attendanceBody = (
      <View style={{ flex: 1, backgroundColor: COLORS.BG_PAGE, paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40 }}>
        <View className="items-center">
          <Pill text="Done for today" tone="success" />
          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
            Time in and time out complete
          </Text>
          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            You are all set for today. Please return tomorrow for your next attendance.
          </Text>
        </View>

        <View className="mt-6">
          <Card className="p-4">
            <Text style={{ color: COLORS.TEXT_PRIMARY, fontWeight: '700', marginBottom: 12 }}>Today&apos;s record</Text>
            <InfoRow label="Time in" value={attendance?.time_in || '—'} />
            <InfoRow label="Time out" value={attendance?.time_out || '—'} />
            {Boolean(attendance?.is_late) ? (
              <View className="mt-2">
                <Pill text={`Late by ${attendance?.late_minutes} min`} tone="warning" />
              </View>
            ) : null}
            <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
              <InfoRow label="Branch" value={`#${branchId}`} />
              <InfoRow label="Position" value={staffAssignment?.position || 'Staff'} />
              <InfoRow label="Daily rate" value={`₱${staffAssignment?.daily_rate || '0'}`} />
            </View>
          </Card>
        </View>

        <View className="mt-5">
          <PrimaryButton
            label={attendanceLoading ? 'Refreshing...' : 'Refresh Status'}
            onPress={() => loadAttendanceRecord(user.id, branchId)}
            tone="blue"
            loading={attendanceLoading}
          />
        </View>
      </View>
    );
  } else {
    attendanceBody = (
      <View style={{ flex: 1 }}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
          enableTorch={torchOn}
        />

        {/* Top controls (simple + clean) */}
        <View className="absolute top-12 left-0 right-0 px-4 z-40">
          <View className="flex-row items-center gap-3">
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: COLORS.CARD_BORDER }} className="flex-1 flex-row rounded-2xl p-1">
              <TouchableOpacity
                onPress={() => setMode('time_in')}
                disabled={!canTimeIn && mode !== 'time_in'}
                className={`flex-1 py-3 rounded-xl ${
                  mode === 'time_in'
                    ? ''
                    : !canTimeIn
                      ? 'opacity-50'
                      : ''
                }`}
                style={{
                  backgroundColor: mode === 'time_in'
                    ? COLORS.PRIMARY_RED
                    : !canTimeIn
                      ? 'transparent'
                      : 'rgba(229,57,53,0.08)',
                }}
              >
                <Text className="text-center font-extrabold" style={{ color: mode === 'time_in' ? '#fff' : COLORS.TEXT_PRIMARY }}>Time In</Text>
              </TouchableOpacity>

              <View className="w-2"></View>

              <TouchableOpacity
                onPress={() => setMode('time_out')}
                disabled={!canTimeOutEffective && mode !== 'time_out'}
                className={`flex-1 py-3 rounded-xl ${
                  mode === 'time_out'
                    ? ''
                    : !canTimeOutEffective
                      ? 'opacity-50'
                      : ''
                }`}
                style={{
                  backgroundColor: mode === 'time_out'
                    ? COLORS.PRIMARY_NAVY
                    : !canTimeOutEffective
                      ? 'transparent'
                      : 'rgba(26,35,126,0.08)',
                }}
              >
                <Text className="text-center font-extrabold" style={{ color: mode === 'time_out' ? '#fff' : COLORS.TEXT_PRIMARY }}>Time Out</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (!user?.id || !branchId) return;
                console.log('[ATTENDANCE UI] top refresh');
                loadAttendanceRecord(user.id, branchId);
              }}
              disabled={attendanceLoading}
              style={{
                backgroundColor: attendanceLoading ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.95)',
                borderWidth: 1,
                borderColor: COLORS.CARD_BORDER,
              }}
              className="px-3 py-3 rounded-2xl"
            >
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>
                {attendanceLoading ? '...' : 'Refresh'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const next = !torchOn;
                console.log('[FACE] torch', next);
                setTorchOn(next);
              }}
              style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: COLORS.CARD_BORDER }}
              className="px-4 py-3 rounded-2xl"
            >
              <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>{torchOn ? 'Light on' : 'Light'}</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <View>
              <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 11 }}>
                {staffUser ? 'Auto scan' : 'Manual scan'} • {mode === 'time_in' ? 'Time In' : 'Time Out'}
              </Text>
              {mode === 'time_out' && timeOutLocked ? (
                <Text style={{ color: '#D97706', fontSize: 11, marginTop: 2 }}>
                  Time Out available in <TimeOutCountdown until={timeOutLockUntil} />
                </Text>
              ) : null}
            </View>
            <Pill
              text={
                staffUser
                  ? scanPhase === 'mismatch'
                    ? 'Mismatch'
                    : scanPhase === 'checking'
                      ? 'Checking…'
                      : 'Ready'
                  : loading
                    ? 'Working…'
                    : 'Ready'
              }
              tone={staffUser && scanPhase === 'mismatch' ? 'danger' : 'success'}
            />
          </View>
        </View>

        {staffUser && tabFocused ? (
          <>
            <FaceScanOverlay
              phase={scanPhase}
              confidence={scanConfidence}
              threshold={scanThreshold}
              topInset={188}
              bottomInset={232}
            />
          </>
        ) : (
          <View className="absolute bottom-10 left-0 right-0 items-center px-6">
            <TouchableOpacity
              onPress={mode === 'time_in' ? handleTimeIn : handleTimeOut}
              disabled={loading || (mode === 'time_in' ? !canTimeIn : !canTimeOutEffective)}
              className={`w-20 h-20 rounded-full justify-center items-center shadow-lg ${
                loading || (mode === 'time_in' ? !canTimeIn : !canTimeOutEffective)
                  ? 'bg-gray-500/80'
                  : 'bg-white'
              }`}
            >
              {loading ? (
                <ActivityIndicator size="large" color={COLORS.PRIMARY_RED} />
              ) : (
                <View className="w-16 h-16 border-4 border-gray-400 rounded-full"></View>
              )}
            </TouchableOpacity>

            <Text className="text-xs mt-3 opacity-80 text-center" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {mode === 'time_in'
                ? hasTimedInToday
                  ? isTodayAttendance
                    ? 'Time In already recorded today'
                    : 'Time Out previous record first'
                  : 'Tap to Time In'
                : timeOutLocked
                  ? <>
                      Please wait <TimeOutCountdown until={timeOutLockUntil} />
                    </>
                  : hasTimedOut
                  ? 'Time Out already recorded today'
                  : !hasTimedIn
                    ? 'Time In first'
                    : 'Tap to Time Out'}
            </Text>
          </View>
        )}

        {/* Bottom summary (tap to expand) */}
        <View className="absolute left-4 right-4 z-40" style={{ bottom: 92 }}>
          <TouchableOpacity
            onPress={() => setShowBottomDetails((v) => !v)}
            activeOpacity={0.9}
          >
            <Card className="px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '700' }}>Today</Text>
                <Text style={{ color: COLORS.TEXT_MUTED, fontSize: 11 }}>
                  {showBottomDetails ? 'Hide details' : 'Tap for details'}
                </Text>
              </View>
              <View className="mt-2">
                {attendanceLoading ? (
                  <View className="py-1 items-center">
                    <ActivityIndicator size="small" color={COLORS.PRIMARY_RED} />
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>Time in</Text>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>{attendance?.time_in || '—'}</Text>
                    </View>
                    <View className="flex-row items-center justify-between mt-1.5">
                      <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>Time out</Text>
                      <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>{attendance?.time_out || '—'}</Text>
                    </View>
                    {Boolean(attendance?.is_late) ? (
                      <View className="mt-2">
                        <Pill text={`Late by ${attendance?.late_minutes} min`} tone="warning" />
                      </View>
                    ) : null}

                    {showBottomDetails ? (
                      <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.DIVIDER }}>
                        <View className="flex-row items-center justify-between">
                          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>Branch</Text>
                          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>#{branchId}</Text>
                        </View>
                        <View className="flex-row items-center justify-between mt-1.5">
                          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>Position</Text>
                          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>
                            {staffAssignment?.position || 'Staff'}
                          </Text>
                        </View>
                        <View className="flex-row items-center justify-between mt-1.5">
                          <Text style={{ color: COLORS.TEXT_SECONDARY, fontSize: 12 }}>Daily rate</Text>
                          <Text style={{ color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '600' }}>
                            ₱{staffAssignment?.daily_rate || '0'}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        </View>
    </View>
    );
  }

  return (
    <>
      {showFaceWebLayer ? <FaceDetectionWebView ref={faceWebRef} /> : null}
      {attendanceBody}
    </>
  );
}