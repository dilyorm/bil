import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { desktopControl } from '../../services/desktop-control';
import { useDevices } from '../../hooks/useDevices';

export const DesktopControlScreen: React.FC = () => {
  const { devices } = useDevices();
  const [customCommand, setCustomCommand] = useState('');
  const [loading, setLoading] = useState(false);

  // Get desktop device
  const desktopDevice = devices.find(d => d.type === 'desktop');

  const executeCommand = async (command: string) => {
    if (!desktopDevice) {
      Alert.alert('Error', 'No desktop device connected');
      return;
    }

    setLoading(true);
    try {
      const result = await desktopControl.sendNaturalCommand(
        desktopDevice.id,
        command
      );

      Alert.alert(
        'Success',
        result.message || 'Command sent to desktop'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send command'
      );
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: '🎮 Open Steam', command: 'open steam' },
    { label: '🔫 Launch CS2', command: 'open cs2' },
    { label: '🎵 Open Spotify', command: 'open spotify' },
    { label: '🎯 Open Faceit', command: 'open faceit' },
    { label: '💻 Open Cursor', command: 'open cursor' },
    { label: '🌐 Open Chrome', command: 'open chrome' },
  ];

  if (!desktopDevice) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No desktop device connected
          </Text>
          <Text style={styles.emptySubtext}>
            Open the BIL desktop app and sign in to control your computer
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Desktop Control</Text>
        <Text style={styles.subtitle}>
          Control {desktopDevice.name}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={() => executeCommand(action.command)}
              disabled={loading}
            >
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom Command */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Command</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 'open steam and launch cs2'"
          value={customCommand}
          onChangeText={setCustomCommand}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={() => {
            if (customCommand.trim()) {
              executeCommand(customCommand);
              setCustomCommand('');
            }
          }}
          disabled={loading || !customCommand.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send Command</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Examples */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Example Commands</Text>
        <View style={styles.exampleList}>
          <Text style={styles.exampleItem}>• "Open Steam"</Text>
          <Text style={styles.exampleItem}>• "Launch CS2"</Text>
          <Text style={styles.exampleItem}>• "Open Spotify"</Text>
          <Text style={styles.exampleItem}>• "SSH to user@server.com"</Text>
          <Text style={styles.exampleItem}>• "Open Cursor"</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  actionButton: {
    width: '48%',
    margin: '1%',
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exampleList: {
    gap: 8,
  },
  exampleItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
