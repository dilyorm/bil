import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  TouchableOpacity, 
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDevices } from '../../hooks/useDevices';
import { DeviceCard } from '../../components/ui/DeviceCard';
import { DevicePairingModal } from '../../components/device/DevicePairingModal';
import { Button } from '../../components/ui/Button';
import { Device, DeviceType } from '../../types/device';

export const DevicesScreen: React.FC = () => {
  const {
    devices,
    activeDevices,
    currentDevice,
    stats,
    isLoading,
    error,
    refreshDevices,
    registerDevice,
    updateDevice,
    removeDevice,
    deactivateDevice,
    isOnline,
  } = useDevices();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<DeviceType>('mobile');

  const handleAddDevice = useCallback(async () => {
    if (!newDeviceName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }

    const result = await registerDevice({
      name: newDeviceName.trim(),
      type: newDeviceType,
    });

    if (result) {
      setShowAddModal(false);
      setNewDeviceName('');
      setNewDeviceType('mobile');
    }
  }, [newDeviceName, newDeviceType, registerDevice]);

  const handleEditDevice = useCallback((device: Device) => {
    setEditingDevice(device);
    setNewDeviceName(device.name);
    setShowEditModal(true);
  }, []);

  const handleUpdateDevice = useCallback(async () => {
    if (!editingDevice || !newDeviceName.trim()) {
      Alert.alert('Error', 'Please enter a device name');
      return;
    }

    const result = await updateDevice(editingDevice.id, {
      name: newDeviceName.trim(),
    });

    if (result) {
      setShowEditModal(false);
      setEditingDevice(null);
      setNewDeviceName('');
    }
  }, [editingDevice, newDeviceName, updateDevice]);

  const handleRemoveDevice = useCallback(async (device: Device) => {
    await removeDevice(device.id);
  }, [removeDevice]);

  const handleToggleActive = useCallback(async (device: Device) => {
    if (device.is_active) {
      await deactivateDevice(device.id);
    } else {
      await updateDevice(device.id, { is_active: true });
    }
  }, [deactivateDevice, updateDevice]);

  const handleDevicePaired = useCallback(async (bluetoothDevice: any) => {
    // Register the paired device
    await registerDevice({
      name: bluetoothDevice.name,
      type: 'wearable',
      connection_info: {
        bluetoothId: bluetoothDevice.id,
        rssi: bluetoothDevice.rssi,
        pairedAt: new Date().toISOString(),
      },
    });
  }, [registerDevice]);

  const renderDevice = useCallback(({ item }: { item: Device }) => (
    <DeviceCard
      device={item}
      onEdit={handleEditDevice}
      onRemove={handleRemoveDevice}
      onToggleActive={handleToggleActive}
    />
  ), [handleEditDevice, handleRemoveDevice, handleToggleActive]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Connected Devices</Text>
        {!isOnline && (
          <Text style={styles.offlineIndicator}>Offline Mode</Text>
        )}
      </View>
      
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.connectedDevices}</Text>
            <Text style={styles.statLabel}>Connected</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.activeDevices}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalDevices}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Add Device"
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
        />
        <Button
          title="Pair Wearable"
          onPress={() => setShowPairingModal(true)}
          style={styles.pairButton}
        />
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Devices Found</Text>
      <Text style={styles.emptySubtitle}>
        Add your first device to start syncing across all your devices
      </Text>
      <View style={styles.emptyButtonContainer}>
        <Button
          title="Add Device"
          onPress={() => setShowAddModal(true)}
          style={styles.emptyButton}
        />
        <Button
          title="Pair Wearable"
          onPress={() => setShowPairingModal(true)}
          style={styles.pairButton}
        />
      </View>
    </View>
  );

  const deviceTypeOptions: { label: string; value: DeviceType }[] = [
    { label: 'Mobile', value: 'mobile' },
    { label: 'Desktop', value: 'desktop' },
    { label: 'Wearable', value: 'wearable' },
    { label: 'Web', value: 'web' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={devices}
        renderItem={renderDevice}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshDevices}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={devices.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Device Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Device</Text>
            <TouchableOpacity onPress={handleAddDevice}>
              <Text style={styles.modalSave}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Name</Text>
              <TextInput
                style={styles.textInput}
                value={newDeviceName}
                onChangeText={setNewDeviceName}
                placeholder="Enter device name"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Type</Text>
              <View style={styles.typeSelector}>
                {deviceTypeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.typeOption,
                      newDeviceType === option.value && styles.typeOptionSelected,
                    ]}
                    onPress={() => setNewDeviceType(option.value)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        newDeviceType === option.value && styles.typeOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Edit Device Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Device</Text>
            <TouchableOpacity onPress={handleUpdateDevice}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Device Name</Text>
              <TextInput
                style={styles.textInput}
                value={newDeviceName}
                onChangeText={setNewDeviceName}
                placeholder="Enter device name"
                autoFocus
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Device Pairing Modal */}
      <DevicePairingModal
        visible={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onDevicePaired={handleDevicePaired}
      />

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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#f5f5f5',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addButton: {
    flex: 1,
  },
  pairButton: {
    flex: 1,
    backgroundColor: '#FF9500',
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  emptyButton: {
    minWidth: 140,
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
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666666',
  },
  typeOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '500',
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