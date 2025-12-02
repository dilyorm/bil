import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_USER_PREFERENCES } from '../types/settings';

// Mock the hooks
jest.mock('../hooks/useSettings');
jest.mock('../hooks/useAuth');

const mockUseSettings = useSettings as jest.MockedFunction<typeof useSettings>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      isLoading: false,
      error: null,
    });

    mockUseSettings.mockReturnValue({
      preferences: DEFAULT_USER_PREFERENCES,
      offlineSettings: {
        enableOfflineMode: true,
        maxOfflineMessages: 100,
        syncOnReconnect: true,
        cacheConversations: true,
        cacheDurationDays: 7,
      },
      isLoading: false,
      error: null,
      updatePreferences: jest.fn(),
      updateOfflineSettings: jest.fn(),
      resetPreferences: jest.fn(),
      exportSettings: jest.fn(),
      importSettings: jest.fn(),
      isOnline: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings sections correctly', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Voice & Speech')).toBeTruthy();
    expect(getByText('AI Personality')).toBeTruthy();
    expect(getByText('Privacy & Data')).toBeTruthy();
    expect(getByText('Offline Mode')).toBeTruthy();
    expect(getByText('Notifications')).toBeTruthy();
  });

  it('shows voice settings correctly', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Wake Word Detection')).toBeTruthy();
    expect(getByText("Enable 'Hey BIL' wake word")).toBeTruthy();
    expect(getByText('Speech Rate')).toBeTruthy();
    expect(getByText('Voice Volume')).toBeTruthy();
  });

  it('shows AI personality settings', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Response Style')).toBeTruthy();
    expect(getByText('Response Length')).toBeTruthy();
    expect(getByText('Proactiveness')).toBeTruthy();
    expect(getByText('Learning Enabled')).toBeTruthy();
  });

  it('shows privacy settings', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Data Integration')).toBeTruthy();
    expect(getByText('Location Access')).toBeTruthy();
    expect(getByText('Camera Access')).toBeTruthy();
    expect(getByText('Share Usage Data')).toBeTruthy();
  });

  it('shows offline mode settings', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Enable Offline Mode')).toBeTruthy();
    expect(getByText('Cache Conversations')).toBeTruthy();
    expect(getByText('Max Offline Messages')).toBeTruthy();
  });

  it('shows data management options', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Data Management')).toBeTruthy();
    expect(getByText('Export Settings')).toBeTruthy();
    expect(getByText('Import Settings')).toBeTruthy();
    expect(getByText('Reset to Defaults')).toBeTruthy();
  });

  it('shows account section', () => {
    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Sign Out')).toBeTruthy();
  });

  it('shows offline indicator when offline', () => {
    mockUseSettings.mockReturnValue({
      ...mockUseSettings(),
      isOnline: false,
    });

    const { getByText } = render(<SettingsScreen />);
    
    expect(getByText('Offline Mode')).toBeTruthy();
  });

  it('opens import modal when import button is pressed', () => {
    const { getByText } = render(<SettingsScreen />);
    
    const importButton = getByText('Import Settings');
    fireEvent.press(importButton);
    
    // Modal should open
    expect(getByText('Import')).toBeTruthy();
    expect(getByText('Paste your exported settings JSON below:')).toBeTruthy();
  });
});