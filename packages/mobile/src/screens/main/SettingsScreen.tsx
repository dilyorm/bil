import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Share,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { 
  SettingsSection, 
  SettingsItem, 
  SettingsSwitch, 
  SettingsSlider 
} from '../../components/ui/SettingsSection';
import { Button } from '../../components/ui/Button';

export const SettingsScreen: React.FC = () => {
  const {
    preferences,
    offlineSettings,
    isLoading,
    error,
    updatePreferences,
    updateOfflineSettings,
    resetPreferences,
    exportSettings,
    importSettings,
    isOnline,
  } = useSettings();

  const { logout } = useAuth();

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Voice Settings Handlers
  const handleVoiceSettingChange = useCallback((key: string, value: any) => {
    updatePreferences({
      voiceSettings: {
        ...preferences.voiceSettings,
        [key]: value,
      },
    });
  }, [preferences.voiceSettings, updatePreferences]);

  // Privacy Settings Handlers
  const handlePrivacySettingChange = useCallback((key: string, value: any) => {
    updatePreferences({
      privacySettings: {
        ...preferences.privacySettings,
        [key]: value,
      },
    });
  }, [preferences.privacySettings, updatePreferences]);

  // AI Personality Handlers
  const handleAISettingChange = useCallback((key: string, value: any) => {
    updatePreferences({
      aiPersonality: {
        ...preferences.aiPersonality,
        [key]: value,
      },
    });
  }, [preferences.aiPersonality, updatePreferences]);

  // Notification Handlers
  const handleNotificationChange = useCallback((key: string, value: any) => {
    updatePreferences({
      notifications: {
        ...preferences.notifications,
        [key]: value,
      },
    });
  }, [preferences.notifications, updatePreferences]);

  // Offline Settings Handlers
  const handleOfflineSettingChange = useCallback((key: string, value: any) => {
    updateOfflineSettings({
      [key]: value,
    });
  }, [updateOfflineSettings]);

  // Export Settings
  const handleExportSettings = useCallback(async () => {
    try {
      const settingsJson = await exportSettings();
      await Share.share({
        message: settingsJson,
        title: 'BIL Assistant Settings',
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export settings');
    }
  }, [exportSettings]);

  // Import Settings
  const handleImportSettings = useCallback(async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Please paste your settings JSON');
      return;
    }

    const success = await importSettings(importText.trim());
    if (success) {
      setShowImportModal(false);
      setImportText('');
    }
  }, [importText, importSettings]);

  // Response Style Options
  const responseStyleOptions = [
    { label: 'Formal', value: 'formal' },
    { label: 'Casual', value: 'casual' },
    { label: 'Friendly', value: 'friendly' },
  ];

  const verbosityOptions = [
    { label: 'Concise', value: 'concise' },
    { label: 'Detailed', value: 'detailed' },
  ];

  const formatSliderValue = (value: number, suffix: string = '') => {
    return `${value}${suffix}`;
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          {!isOnline && (
            <Text style={styles.offlineIndicator}>Offline Mode</Text>
          )}
        </View>

        {/* Voice Settings */}
        <SettingsSection title="Voice & Speech">
          <SettingsSwitch
            title="Wake Word Detection"
            subtitle="Enable 'Hey BIL' wake word"
            value={preferences.voiceSettings.enableWakeWord}
            onValueChange={(value) => handleVoiceSettingChange('enableWakeWord', value)}
          />
          
          <SettingsSlider
            title="Wake Word Sensitivity"
            subtitle="How easily the wake word is detected"
            value={preferences.voiceSettings.wakeWordSensitivity}
            minimumValue={0.1}
            maximumValue={1.0}
            step={0.1}
            onValueChange={(value) => handleVoiceSettingChange('wakeWordSensitivity', value)}
            formatValue={formatPercentage}
            disabled={!preferences.voiceSettings.enableWakeWord}
          />

          <SettingsSlider
            title="Speech Rate"
            subtitle="How fast BIL speaks"
            value={preferences.voiceSettings.speechRate}
            minimumValue={0.5}
            maximumValue={2.0}
            step={0.1}
            onValueChange={(value) => handleVoiceSettingChange('speechRate', value)}
            formatValue={(value) => `${value.toFixed(1)}x`}
          />

          <SettingsSlider
            title="Voice Volume"
            subtitle="BIL's voice volume level"
            value={preferences.voiceSettings.voiceVolume}
            minimumValue={0.1}
            maximumValue={1.0}
            step={0.1}
            onValueChange={(value) => handleVoiceSettingChange('voiceVolume', value)}
            formatValue={formatPercentage}
          />
        </SettingsSection>

        {/* AI Personality */}
        <SettingsSection title="AI Personality">
          <SettingsItem
            title="Response Style"
            subtitle="How BIL communicates with you"
            value={preferences.aiPersonality.responseStyle}
            onPress={() => {
              Alert.alert(
                'Response Style',
                'Choose how BIL should communicate',
                responseStyleOptions.map(option => ({
                  text: option.label,
                  onPress: () => handleAISettingChange('responseStyle', option.value),
                }))
              );
            }}
          />

          <SettingsItem
            title="Response Length"
            subtitle="How detailed BIL's responses are"
            value={preferences.aiPersonality.verbosity}
            onPress={() => {
              Alert.alert(
                'Response Length',
                'Choose response detail level',
                verbosityOptions.map(option => ({
                  text: option.label,
                  onPress: () => handleAISettingChange('verbosity', option.value),
                }))
              );
            }}
          />

          <SettingsSlider
            title="Proactiveness"
            subtitle="How often BIL offers suggestions"
            value={preferences.aiPersonality.proactiveness}
            minimumValue={1}
            maximumValue={10}
            step={1}
            onValueChange={(value) => handleAISettingChange('proactiveness', value)}
            formatValue={(value) => `${value}/10`}
          />

          <SettingsSwitch
            title="Learning Enabled"
            subtitle="Allow BIL to learn from your interactions"
            value={preferences.aiPersonality.learningEnabled}
            onValueChange={(value) => handleAISettingChange('learningEnabled', value)}
          />

          <SettingsSlider
            title="Context Memory"
            subtitle="How long BIL remembers conversation context"
            value={preferences.aiPersonality.contextMemoryDays}
            minimumValue={1}
            maximumValue={30}
            step={1}
            onValueChange={(value) => handleAISettingChange('contextMemoryDays', value)}
            formatValue={(value) => `${value} days`}
            disabled={!preferences.aiPersonality.learningEnabled}
          />
        </SettingsSection>

        {/* Privacy Settings */}
        <SettingsSection title="Privacy & Data">
          <SettingsSwitch
            title="Data Integration"
            subtitle="Allow BIL to access your personal data"
            value={preferences.privacySettings.allowDataIntegration}
            onValueChange={(value) => handlePrivacySettingChange('allowDataIntegration', value)}
          />

          <SettingsSwitch
            title="Location Access"
            subtitle="Allow BIL to access your location"
            value={preferences.privacySettings.enableLocationAccess}
            onValueChange={(value) => handlePrivacySettingChange('enableLocationAccess', value)}
          />

          <SettingsSwitch
            title="Camera Access"
            subtitle="Allow BIL to access your camera"
            value={preferences.privacySettings.enableCameraAccess}
            onValueChange={(value) => handlePrivacySettingChange('enableCameraAccess', value)}
          />

          <SettingsSwitch
            title="Share Usage Data"
            subtitle="Help improve BIL by sharing anonymous usage data"
            value={preferences.privacySettings.shareUsageData}
            onValueChange={(value) => handlePrivacySettingChange('shareUsageData', value)}
          />

          <SettingsSlider
            title="Data Retention"
            subtitle="How long to keep your conversation data"
            value={preferences.privacySettings.dataRetentionDays}
            minimumValue={7}
            maximumValue={365}
            step={7}
            onValueChange={(value) => handlePrivacySettingChange('dataRetentionDays', value)}
            formatValue={(value) => `${value} days`}
          />
        </SettingsSection>

        {/* Offline Settings */}
        <SettingsSection title="Offline Mode">
          <SettingsSwitch
            title="Enable Offline Mode"
            subtitle="Allow BIL to work without internet connection"
            value={offlineSettings.enableOfflineMode}
            onValueChange={(value) => handleOfflineSettingChange('enableOfflineMode', value)}
          />

          <SettingsSwitch
            title="Cache Conversations"
            subtitle="Store conversations locally for offline access"
            value={offlineSettings.cacheConversations}
            onValueChange={(value) => handleOfflineSettingChange('cacheConversations', value)}
            disabled={!offlineSettings.enableOfflineMode}
          />

          <SettingsSlider
            title="Max Offline Messages"
            subtitle="Maximum messages to store offline"
            value={offlineSettings.maxOfflineMessages}
            minimumValue={10}
            maximumValue={500}
            step={10}
            onValueChange={(value) => handleOfflineSettingChange('maxOfflineMessages', value)}
            formatValue={(value) => `${value} messages`}
            disabled={!offlineSettings.enableOfflineMode}
          />

          <SettingsSlider
            title="Cache Duration"
            subtitle="How long to keep cached conversations"
            value={offlineSettings.cacheDurationDays}
            minimumValue={1}
            maximumValue={30}
            step={1}
            onValueChange={(value) => handleOfflineSettingChange('cacheDurationDays', value)}
            formatValue={(value) => `${value} days`}
            disabled={!offlineSettings.enableOfflineMode || !offlineSettings.cacheConversations}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsSwitch
            title="Enable Notifications"
            subtitle="Receive notifications from BIL"
            value={preferences.notifications.enabled}
            onValueChange={(value) => handleNotificationChange('enabled', value)}
          />

          <SettingsSwitch
            title="Sound"
            subtitle="Play sound for notifications"
            value={preferences.notifications.soundEnabled}
            onValueChange={(value) => handleNotificationChange('soundEnabled', value)}
            disabled={!preferences.notifications.enabled}
          />

          <SettingsSwitch
            title="Vibration"
            subtitle="Vibrate for notifications"
            value={preferences.notifications.vibrationEnabled}
            onValueChange={(value) => handleNotificationChange('vibrationEnabled', value)}
            disabled={!preferences.notifications.enabled}
          />
        </SettingsSection>

        {/* Data Management */}
        <SettingsSection title="Data Management">
          <SettingsItem
            title="Export Settings"
            subtitle="Share your settings configuration"
            onPress={handleExportSettings}
          />

          <SettingsItem
            title="Import Settings"
            subtitle="Restore settings from backup"
            onPress={() => setShowImportModal(true)}
          />

          <SettingsItem
            title="Reset to Defaults"
            subtitle="Reset all settings to default values"
            onPress={resetPreferences}
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsItem
            title="Sign Out"
            subtitle="Sign out of your BIL account"
            onPress={() => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: logout },
                ]
              );
            }}
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>BIL Assistant v1.0.0</Text>
          <Text style={styles.footerText}>
            {isOnline ? 'Connected' : 'Offline Mode'}
          </Text>
        </View>
      </ScrollView>

      {/* Import Settings Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImportModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowImportModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Import Settings</Text>
            <TouchableOpacity onPress={handleImportSettings}>
              <Text style={styles.modalSave}>Import</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Paste your exported settings JSON below:
            </Text>
            <TextInput
              style={styles.importTextInput}
              value={importText}
              onChangeText={setImportText}
              placeholder="Paste settings JSON here..."
              multiline
              textAlignVertical="top"
            />
          </View>
        </SafeAreaView>
      </Modal>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  offlineIndicator: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  modalCancel: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalSave: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 22,
  },
  importTextInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontFamily: 'Courier',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});