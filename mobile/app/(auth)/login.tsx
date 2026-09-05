import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { validateAndFormatPhone } from '../../src/utils/phone.util';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { NumericKeypad } from '../../src/components/NumericKeypad';
import { Colors } from '../../src/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { requestOtp, isLoading, error, clearError } = useAuthStore();

  // Validate in real time
  const phoneValidation = validateAndFormatPhone(phoneNumber, 'IN');

  const handleDigitPress = (digit: string) => {
    if (phoneNumber.length < 10) {
      const nextNumber = phoneNumber + digit;
      setPhoneNumber(nextNumber);
      if (validationError) setValidationError(null);
      if (error) clearError();
    }
  };

  const handleBackspacePress = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
    if (validationError) setValidationError(null);
    if (error) clearError();
  };

  const handleLogin = async () => {
    setValidationError(null);
    clearError();

    if (!phoneNumber || !phoneNumber.trim()) {
      setValidationError('Please enter your 10-digit mobile number');
      return;
    }

    if (!phoneValidation.isValid) {
      setValidationError(phoneValidation.error || 'Please enter a valid 10-digit mobile number');
      return;
    }

    // Standard production OTP flow
    const success = await requestOtp(phoneValidation.e164);
    if (success) {
      router.push('/(auth)/verify-otp');
    }
  };

  const displayedError = validationError || error;
  const isButtonEnabled = phoneNumber.length >= 10 && phoneValidation.isValid && !isLoading;

  return (
    <SafeAreaView style={styles.container}>
      {/* Truelove Branded Header */}
      <TrueloveHeader showBack={true} />

      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Enter your number</Text>
          <Text style={styles.subtitle}>
            We will send you a 6-digit confirmation code to verify your account
          </Text>
        </View>

        {/* Input Form */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View
            style={[
              styles.phoneInputCard,
              displayedError ? styles.phoneInputCardError : null,
              phoneNumber.length === 10 && phoneValidation.isValid ? styles.phoneInputCardValid : null,
            ]}
          >
            <View style={styles.countryPicker}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.countryCode}>+91</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.numberDisplay}>
              <TextInput
                style={styles.numberInput}
                value={phoneNumber}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 10);
                  setPhoneNumber(cleaned);
                  if (validationError) setValidationError(null);
                  if (error) clearError();
                }}
                placeholder="98765 43210"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
                onSubmitEditing={handleLogin}
                autoFocus={Platform.OS === 'web'}
              />
            </View>
          </View>

          {/* Real-time formatted helper / status */}
          {phoneNumber.length > 0 && (
            <View style={styles.helperRow}>
              <Text style={styles.helperText}>
                {phoneNumber.length === 10 && phoneValidation.isValid
                  ? `Formatted: ${phoneValidation.formatted}`
                  : `${phoneNumber.length}/10 digits`}
              </Text>
            </View>
          )}

          {displayedError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayedError}</Text>
            </View>
          ) : null}

          {/* Continue CTA Button */}
          <TouchableOpacity
            style={[styles.continueButton, !isButtonEnabled && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!isButtonEnabled}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueButtonText}>Get OTP Code</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Numeric Keypad for Mobile Touchscreens */}
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
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  formSection: {
    paddingHorizontal: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  phoneInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  phoneInputCardValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  phoneInputCardError: {
    borderColor: Colors.primary,
    backgroundColor: '#FEF2F2',
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  numberDisplay: {
    flex: 1,
    justifyContent: 'center',
  },
  numberInput: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 1.5,
    padding: 0,
    margin: 0,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
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
  continueButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  keypadSection: {
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
});
