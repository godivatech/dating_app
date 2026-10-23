import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { maskPhoneNumber } from '../../src/utils/phone.util';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { NumericKeypad } from '../../src/components/NumericKeypad';
import { Colors } from '../../src/theme/colors';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');

  const {
    pendingPhone,
    isNewUser,
    loginWithPin,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const { fetchProfile } = useProfileStore();

  const handleDigitPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      clearError();
      if (nextPin.length === 4) {
        handleVerify(nextPin);
      }
    }
  };

  const handleBackspacePress = () => {
    setPin((prev) => prev.slice(0, -1));
    clearError();
  };

  const handleVerify = async (candidatePin?: string) => {
    const pinToSubmit = candidatePin || pin;
    if (pinToSubmit.length !== 4 || isLoading || !pendingPhone) return;
    clearError();

    const success = await loginWithPin(pendingPhone, pinToSubmit);
    if (success) {
      try {
        const profile = await fetchProfile();
        if (
          profile?.status === 'READY' ||
          (profile?.displayName && profile?.status !== 'NOT_STARTED')
        ) {
          router.replace('/');
        } else {
          router.replace('/(onboarding)/identity');
        }
      } catch {
        router.replace('/(onboarding)/identity');
      }
    } else {
      setPin('');
    }
  };

  const handleChangeNumber = () => {
    clearError();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} />

      <View style={styles.content}>
        {/* Header Info */}
        <View style={styles.headerSection}>
          <Text style={styles.stepBadge}>
            {isNewUser ? 'ACCOUNT SECURITY' : 'WELCOME BACK'}
          </Text>
          <Text style={styles.title}>
            {isNewUser ? 'Create Security PIN' : 'Enter Security PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {isNewUser
              ? 'Choose a 4-digit PIN for '
              : 'Enter your 4-digit security PIN for '}
            <Text style={styles.phoneHighlight}>
              {maskPhoneNumber(pendingPhone)}
            </Text>
          </Text>
        </View>

        {/* 4-Digit PIN Boxes */}
        <View style={styles.otpBoxesContainer}>
          {[0, 1, 2, 3].map((index) => {
            const digit = pin[index] || '';
            const isFilled = digit !== '';
            const isCurrent = pin.length === index;

            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  isFilled && styles.otpBoxFilled,
                  isCurrent && styles.otpBoxCurrent,
                ]}
              >
                <Text style={styles.otpBoxText}>{isFilled ? '●' : ''}</Text>
              </View>
            );
          })}
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Action Section */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (pin.length !== 4 || isLoading) && styles.buttonDisabled,
            ]}
            onPress={() => handleVerify()}
            disabled={pin.length !== 4 || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.verifyButtonText}>
                {isNewUser ? 'Set PIN & Continue' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Change phone number link */}
          <TouchableOpacity
            style={styles.changeNumberButton}
            onPress={handleChangeNumber}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.changeNumberText}>
              Wrong number? <Text style={styles.changeNumberHighlight}>Change number</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Keypad */}
        <View style={styles.keypadSection}>
          <NumericKeypad
            onPressDigit={handleDigitPress}
            onPressBackspace={handleBackspacePress}
            disabled={isLoading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otpBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  otpBox: {
    width: 58,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  otpBoxCurrent: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  otpBoxText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 12,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  changeNumberButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  changeNumberText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  changeNumberHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
  keypadSection: {
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
});
