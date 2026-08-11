import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveToken, getToken, deleteToken } from '../lib/authStorage';
import {
  getUser,
  deleteUser,
  saveUser,
} from '../lib/userStorage';
import { hasNetworkConnection } from '../lib/network';
import api from '../lib/api';
import { cacheStaffContextAfterLogin } from '../lib/staffContext';
import { normalizeUserType, type MobileUserType } from '../lib/userType';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
    userType?: MobileUserType;
  }>;
  register: (formData: Record<string, string>) => Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
    errors?: Record<string, string>;
    userType?: MobileUserType;
  }>;
  signOut: () => Promise<void>;
  user: any;
  userType: MobileUserType | null;
  updateUser: (updates: Record<string, any>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function persistAuthSession(
  token: string,
  loggedInUser: any,
  resolvedUserType: MobileUserType,
) {
  await saveToken(token);

  const userWithType = {
    ...loggedInUser,
    role: loggedInUser?.role,
    userType: resolvedUserType,
  };

  const cachedUser = await cacheStaffContextAfterLogin(userWithType);

  return cachedUser;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<MobileUserType | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      const storedUser = await getUser();
      if (token && storedUser) {
        setUser(storedUser);
        setUserType(
          normalizeUserType(String(storedUser?.userType || storedUser?.role || '')) || 'staff'
        );
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const connected = await hasNetworkConnection();

    if (!connected) {
      return { success: false, error: 'No internet connection. Please connect to the internet and try again.' };
    }

    try {
      const response = await api.post('/login', { username, password });
      const { token, user: loggedInUser, user_type: responseUserType, role: responseRole } = response.data;

      const resolvedUserType =
        normalizeUserType(responseUserType) ||
        normalizeUserType(loggedInUser?.user_type) ||
        normalizeUserType(loggedInUser?.role) ||
        normalizeUserType(responseRole);

      if (!resolvedUserType) {
        return {
          success: false,
          error: 'This account is not authorized for mobile access.',
        };
      }

      const cachedUser = await persistAuthSession(
        token,
        { ...loggedInUser, role: loggedInUser?.role || responseRole },
        resolvedUserType,
      );

      setUser(cachedUser);
      setUserType(resolvedUserType);
      setIsAuthenticated(true);

      return {
        success: true,
        token,
        user: cachedUser,
        userType: resolvedUserType,
      };
    } catch (error: any) {
      if (error?.response?.status === 403) {
        return {
          success: false,
          error: error?.response?.data?.message || 'You do not have permission to access this account type.',
        };
      }

      const errorMessage =
        error?.response?.data?.message || error?.message || 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const register = async (formData: Record<string, string>) => {
    try {
      const response = await api.post('/register', formData);
      const { token, user: registeredUser } = response.data;

      if (!token || !registeredUser) {
        return {
          success: false,
          error: response.data?.message || 'Registration failed.',
        };
      }

      return {
        success: true,
      };
    } catch (error: any) {
      if (error?.response?.status === 422 && error?.response?.data?.errors) {
        const serverErrors: Record<string, string> = {};
        Object.entries(error.response.data.errors).forEach(([key, value]) => {
          serverErrors[key] = Array.isArray(value) ? String(value[0]) : String(value);
        });
        return {
          success: false,
          error: Object.values(serverErrors)[0] || 'Please check your inputs.',
          errors: serverErrors,
        };
      }

      return {
        success: false,
        error: error?.response?.data?.message || error?.message || 'Registration failed.',
      };
    }
  };

  const signOut = async () => {
    try {
      const connected = await hasNetworkConnection();
      if (connected) {
        try {
          await api.post('logout');
        } catch {
          // ignore logout API errors
        }
      }
      await deleteToken();
      await deleteUser();
      setUser(null);
      setUserType(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const updateUser = async (updates: Record<string, any>) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    await saveUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        register,
        signOut,
        user,
        userType,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
