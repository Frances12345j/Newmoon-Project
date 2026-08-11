import NetInfo from '@react-native-community/netinfo';

export async function hasNetworkConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const isConnected = state.isConnected === true;
  console.log('[NETWORK] Connection status:', isConnected, 'Details:', state);
  return isConnected;
}

/** True when device has a network interface (Wi‑Fi/mobile). LAN servers count as online. */
export async function isOnline(): Promise<boolean> {
  return hasNetworkConnection();
}

export function subscribeToNetwork(callback: (online: boolean) => void) {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected === true);
  });
}

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { message?: string; code?: string; response?: unknown };
  if (err.response) return false;
  const message = String(err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_INTERNET_DISCONNECTED' ||
    message.includes('network error') ||
    message.includes('network request failed') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('connection refused') ||
    message.includes('unable to connect')
  );
}

export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { response?: { status?: number } };
  return err.response?.status === 401;
}
