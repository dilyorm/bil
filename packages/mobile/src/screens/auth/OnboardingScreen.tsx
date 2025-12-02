import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { biometricService, BiometricCapabilities } from '../../services/biometric';
import { Button } from '../../components/ui/Button';
import { colors, typography, spacing } from '../../theme';
import { STORAGE_KEYS } from '../../config/constants';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to BIL',
    description: 'Your personal AI assistant that learns and adapts to help you throughout your day.',
    icon: '🤖',
  },
  {
    id: 'voice',
    title: 'Voice Interaction',
    description: 'Talk to BIL naturally using voice commands. Just say "Hey BIL" to get started.',
    icon: '🎤',
  },
  {
    id: 'sync',
    title: 'Multi-Device Sync',
    description: 'Your conversations and preferences sync across all your devices seamlessly.',
    icon: '🔄',
  },
  {
    id: 'privacy',
    title: 'Privacy First',
    description: 'Your data is encrypted and secure. You control what BIL can access.',
    icon: '🔒',
  },
];

export const OnboardingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [biometricCapabilities, setBiometricCapabilities] = useState<BiometricCapabilities | null>(null);
  const [isSettingUpBiometric, setIsSettingUpBiometric] = useState(false);

  useEffect(() => {
    checkBiometricCapabilities();
  }, []);

  const checkBiometricCapabilities = async () => {
    try {
      const capabilities = await biometricService.getCapabilities();
      setBiometricCapabilities(capabilities);
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Show biometric setup if available
      if (biometricCapabilities?.isAvailable && biometricCapabilities?.isEnrolled) {
        showBiometricSetup();
      } else {
        completeOnboarding();
      }
    }
  };

  const handleSkip = () => {
    setCurrentStep(onboardingSteps.length - 1);
  };

  const showBiometricSetup = () => {
    if (!biometricCapabilities) return;

    const authTypeLabel = biometricCapabilities.supportedTypes
      .map(type => biometricService.getAuthenticationTypeLabel(type))
      .join(' or ');

    Alert.alert(
      'Enable Biometric Authentication',
      `Would you like to use ${authTypeLabel} for quick and secure access to your account?`,
      [
        {
          text: 'Skip',
          style: 'cancel',
          onPress: completeOnboarding,
        },
        {
          text: 'Enable',
          onPress: setupBiometric,
        },
      ]
    );
  };

  const setupBiometric = async () => {
    setIsSettingUpBiometric(true);
    try {
      const isAuthenticated = await biometricService.authenticate(
        'Verify your identity to enable biometric authentication'
      );

      if (isAuthenticated) {
        await biometricService.setBiometricEnabled(true);
        Alert.alert(
          'Success',
          'Biometric authentication has been enabled successfully!',
          [{ text: 'OK', onPress: completeOnboarding }]
        );
      } else {
        Alert.alert(
          'Setup Cancelled',
          'Biometric authentication was not enabled.',
          [{ text: 'OK', onPress: completeOnboarding }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Setup Failed',
        'Failed to enable biometric authentication. You can enable it later in settings.',
        [{ text: 'OK', onPress: completeOnboarding }]
      );
    } finally {
      setIsSettingUpBiometric(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
      // The auth state will automatically update and navigate to main app
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>
            {currentStep + 1} of {onboardingSteps.length}
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.icon}>{currentStepData.icon}</Text>
          <Text style={styles.title}>{currentStepData.title}</Text>
          <Text style={styles.description}>{currentStepData.description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {onboardingSteps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentStep && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.buttons}>
            {!isLastStep && (
              <Button
                title="Skip"
                onPress={handleSkip}
                variant="outline"
                style={styles.skipButton}
              />
            )}
            <Button
              title={isLastStep ? 'Get Started' : 'Next'}
              onPress={handleNext}
              loading={isSettingUpBiometric}
              style={styles.nextButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  stepIndicator: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  icon: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.fontSize.lg * typography.lineHeight.relaxed,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    flex: 1,
    marginRight: spacing.md,
  },
  nextButton: {
    flex: 1,
  },
});