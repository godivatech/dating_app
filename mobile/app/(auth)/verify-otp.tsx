import React, { useState, useEffect } from 'react';
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
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(60);

  const {
    pendingPhone,
    verifyOtp,
    requestOtp,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const { fetchProfile } = useProfileStore();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleDigitPress = (digit: string) => {
    if (otp.length < 6) {
      const nextOtp = otp + digit;
      setOtp(nextOtp);
      clearError();
    }
  };

  const handleBackspacePress = () => {
    setOtp((prev) => prev.slice(0, -1));
    clearError();
  };

  const handleVerify = async () => {
    if (otp.length !== 6 || isLoading) return;
    clearError();

    const success = await verifyOtp(otp);
    if (success) {
      try {
        const profile = await fetchProfile();
        if (profile?.status === 'READY' || (profile?.displayName && profile?.status !== 'NOT_STARTED')) {
          router.replace('/');
        } else {
          router.replace('/(onboarding)/identity');
        }
      } catch {
        router.replace('/(onboarding)/identity');
      }
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !pendingPhone || isLoading) return;
    clearError();

    const success = await requestOtp(pendingPhone);
    if (success) {
      setResendCooldown(60);
      setOtp('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} />

      <View style={styles.content}>
        {/* Header Info */}
        <View style={styles.headerSection}>
          <Text style={styles.stepBadge}>VERIFICATION</Text>
          <Text style={styles.title}>Enter 6-Digit Code</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to{' '}
            <Text style={styles.phoneHighlight}>{maskPhoneNumber(pendingPhone)}</Text>
          </Text>
        </View>

        {/* 6-Digit OTP Boxes */}
        <View style={styles.otpBoxesContainer}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const digit = otp[index] || '';
            const isFilled = digit !== '';
            const isCurrent = otp.length === index;

            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  isFilled && styles.otpBoxFilled,
                  isCurrent && styles.otpBoxCurrent,
                ]}
              >
                <Text style={styles.otpBoxText}>{digit}</Text>
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

        {/* Verify CTA */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (otp.length !== 6 || isLoading) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          {/* Resend link */}
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendCooldown > 0 || isLoading}
          >
            <Text
              style={[
                styles.resendText,
                resendCooldown > 0 && styles.resendTextDisabled,
              ]}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
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
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  otpBoxCurrent: {
    borderColor: Colors.dark,
    backgroundColor: Colors.white,
  },
  otpBoxText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  resendTextDisabled: {
    color: Colors.textMuted,
  },
  keypadSection: {
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
});
