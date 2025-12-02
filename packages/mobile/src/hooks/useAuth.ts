import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiService, LoginRequest, RegisterRequest } from '../services/api';
import { biometricService } from '../services/biometric';
import { STORAGE_KEYS } from '../config/constants';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    refreshToken: null,
  });

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
      const onboardingCompleted = await SecureStore.getItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED);

      if (accessToken && refreshToken && userData && onboardingCompleted === 'true') {
        const user = JSON.parse(userData);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user,
          accessToken,
          refreshToken,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          accessToken: null,
          refreshToken: null,
        });
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    }
  };

  const storeAuthData = async (accessToken: string, refreshToken: string, user: User) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  };

  const clearAuthData = async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
  };

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await apiService.login(credentials);
      const { tokens, user } = response.data;

      await storeAuthData(tokens.accessToken, tokens.refreshToken, user);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      const response = await apiService.register(userData);
      const { tokens, user } = response.data;

      await storeAuthData(tokens.accessToken, tokens.refreshToken, user);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const loginWithBiometrics = async () => {
    try {
      const isAuthenticated = await biometricService.authenticateWithBiometrics();
      if (isAuthenticated) {
        // Biometric authentication successful, user is already logged in
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric login error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (authState.refreshToken) {
        await apiService.logout(authState.refreshToken);
      }
      await clearAuthData();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local data even if API call fails
      await clearAuthData();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    }
  };

  const refreshAccessToken = async () => {
    try {
      if (!authState.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiService.refreshToken(authState.refreshToken);
      const { tokens } = response;

      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);

      setAuthState(prev => ({
        ...prev,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }));

      return tokens.accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout the user
      await logout();
      throw error;
    }
  };

  return {
    ...authState,
    login,
    register,
    loginWithBiometrics,
    logout,
    refreshAccessToken,
    checkAuthState,
  };
};