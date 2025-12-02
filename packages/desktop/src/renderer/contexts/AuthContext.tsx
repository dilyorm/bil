import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiService from '../services/api';
import syncService from '../services/sync';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication on app start
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check localStorage for stored auth token
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Validate token with backend by making a health check
        const isHealthy = await apiService.healthCheck();
        if (isHealthy) {
          // For now, create a mock user since we don't have a user profile endpoint
          // In a real implementation, you'd fetch user profile from the API
          setUser({
            id: '1',
            email: 'user@example.com',
            name: 'Desktop User'
          });

          // Connect to sync service
          syncService.connect('1', token);
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear invalid tokens
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const tokens = await apiService.login({ email, password });
      
      // Create user object (in real implementation, this would come from the API)
      const user = {
        id: '1', // This would come from the API response
        email,
        name: 'Desktop User' // This would come from the API response
      };
      
      setUser(user);

      // Connect to sync service
      syncService.connect(user.id, tokens.accessToken);

      // Start desktop agent
      if (window.electronAPI?.startDesktopAgent) {
        console.log('🤖 Starting desktop agent...');
        await window.electronAPI.startDesktopAgent(tokens.accessToken);
      }

      // Register this device
      await apiService.registerDevice({
        name: 'Desktop Application',
        type: 'desktop',
        capabilities: {
          hasVoiceInput: true,
          hasVoiceOutput: true,
          hasFileAccess: true,
          hasCalendarAccess: true,
        }
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const tokens = await apiService.register({ email, password, name });
      
      // Create user object (in real implementation, this would come from the API)
      const user = {
        id: '1', // This would come from the API response
        email,
        name
      };
      
      setUser(user);

      // Connect to sync service
      syncService.connect(user.id, tokens.accessToken);

      // Register this device
      await apiService.registerDevice({
        name: 'Desktop Application',
        type: 'desktop',
        capabilities: {
          hasVoiceInput: true,
          hasVoiceOutput: true,
          hasFileAccess: true,
          hasCalendarAccess: true,
        }
      });
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Disconnect from sync service
      syncService.disconnect();
      
      // Logout from API
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};