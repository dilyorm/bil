import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
};

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  value?: string | number;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  value,
  onPress,
  rightElement,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.item, disabled && styles.disabledItem]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, disabled && styles.disabledText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.itemSubtitle, disabled && styles.disabledText]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.itemRight}>
          {value && (
            <Text style={[styles.itemValue, disabled && styles.disabledText]}>
              {value}
            </Text>
          )}
          {rightElement}
          {onPress && !rightElement && (
            <Text style={[styles.chevron, disabled && styles.disabledText]}>›</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface SettingsSwitchProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const SettingsSwitch: React.FC<SettingsSwitchProps> = ({
  title,
  subtitle,
  value,
  onValueChange,
  disabled = false,
}) => {
  return (
    <View style={[styles.item, disabled && styles.disabledItem]}>
      <View style={styles.itemContent}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, disabled && styles.disabledText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.itemSubtitle, disabled && styles.disabledText]}>
              {subtitle}
            </Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
          thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
        />
      </View>
    </View>
  );
};

interface SettingsSliderProps {
  title: string;
  subtitle?: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}

export const SettingsSlider: React.FC<SettingsSliderProps> = ({
  title,
  subtitle,
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  disabled = false,
  formatValue,
}) => {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <View style={[styles.item, styles.sliderItem, disabled && styles.disabledItem]}>
      <View style={styles.sliderHeader}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, disabled && styles.disabledText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.itemSubtitle, disabled && styles.disabledText]}>
              {subtitle}
            </Text>
          )}
        </View>
        <Text style={[styles.itemValue, disabled && styles.disabledText]}>
          {displayValue}
        </Text>
      </View>
      {/* Note: React Native Slider would be imported from @react-native-community/slider */}
      {/* For now, we'll use a placeholder that shows the concept */}
      <View style={styles.sliderContainer}>
        <View style={styles.sliderTrack}>
          <View 
            style={[
              styles.sliderFill, 
              { 
                width: `${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%`,
                backgroundColor: disabled ? '#CCCCCC' : '#007AFF'
              }
            ]} 
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  sectionContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  disabledItem: {
    opacity: 0.5,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  disabledText: {
    color: '#CCCCCC',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemValue: {
    fontSize: 16,
    color: '#666666',
    marginRight: 8,
  },
  chevron: {
    fontSize: 20,
    color: '#CCCCCC',
    fontWeight: '300',
  },
  sliderItem: {
    paddingVertical: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sliderContainer: {
    paddingHorizontal: 16,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
});