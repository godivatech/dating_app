import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../src/stores/profile-store';
import { Gender } from '../../../shared/src/types';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { Colors } from '../../src/theme/colors';

/**
 * Normalizes user input into YYYY-MM-DD.
 * Supports YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, YYYY/MM/DD.
 */
function normalizeDateInput(input: string): { normalized: string; error?: string; age?: number } {
  const clean = input.trim().replace(/\//g, '-');
  const parts = clean.split('-');

  let year: number;
  let month: number;
  let day: number;

  if (parts.length !== 3) {
    return { normalized: '', error: 'Please enter a valid date (e.g. 2000-01-15 or 15-01-2000)' };
  }

  // Format 1: YYYY-MM-DD
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  }
  // Format 2: DD-MM-YYYY
  else if (parts[2].length === 4) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return { normalized: '', error: 'Please enter a 4-digit year (e.g. 2000-01-15)' };
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return { normalized: '', error: 'Please enter a valid calendar date' };
  }

  // Exact calendar validation (catches Feb 30, April 31, leap year mismatches)
  const testDate = new Date(year, month - 1, day);
  if (
    isNaN(testDate.getTime()) ||
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return { normalized: '', error: 'Please enter a valid calendar date' };
  }

  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  const normalized = `${year}-${mm}-${dd}`;

  // Age calculation
  const today = new Date();
  let age = today.getFullYear() - year;
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  if (age < 18) {
    return { normalized, error: 'You must be at least 18 years old to create a dating profile', age };
  }

  if (age > 100 || year < 1920) {
    return { normalized, error: 'Please enter a valid birth year', age };
  }

  return { normalized, age };
}

export default function IdentityScreen() {
  const router = useRouter();
  const { profile, saveIdentity, isLoading, error: storeError, clearError } = useProfileStore();

  const [name, setName] = useState(profile?.displayName || '');
  const [birthdate, setBirthdate] = useState(
    (profile as any)?.dateOfBirth
      ? (profile as any).dateOfBirth.split('T')[0]
      : profile?.age
        ? `${new Date().getFullYear() - profile.age}-01-15`
        : '2000-01-15',
  );
  const [gender, setGender] = useState<Gender>(profile?.gender || Gender.WOMAN);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleContinue = async () => {
    setValidationError(null);
    clearError();

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setValidationError('Please enter your full name (at least 2 characters)');
      return;
    }

    const dateResult = normalizeDateInput(birthdate);
    if (dateResult.error) {
      setValidationError(dateResult.error);
      return;
    }

    try {
      const success = await saveIdentity({
        displayName: trimmedName,
        dateOfBirth: dateResult.normalized,
        gender,
      });

      if (success) {
        router.push('/(onboarding)/photos');
      } else {
        // If saveIdentity returned false, storeError will be displayed
        if (!storeError) {
          setValidationError('Failed to save profile details. Please try again.');
        }
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save identity');
    }
  };

  const displayedError = validationError || storeError;

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stepper Progress Bar: 01 active */}
          <StepperHeader currentStep={1} />

          {/* Form Content */}
          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ananya / Kavitha / Karthik"
                placeholderTextColor={Colors.textMuted}
                value={name}
                maxLength={50}
                onChangeText={(text) => {
                  setName(text);
                  if (validationError) setValidationError(null);
                  if (storeError) clearError();
                }}
              />
            </View>

            {/* Birthdate */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth (18+)</Text>
              <View style={styles.iconInputWrapper}>
                <TextInput
                  style={styles.iconInput}
                  placeholder="YYYY-MM-DD or DD-MM-YYYY"
                  placeholderTextColor={Colors.textMuted}
                  value={birthdate}
                  onChangeText={(text) => {
                    setBirthdate(text);
                    if (validationError) setValidationError(null);
                    if (storeError) clearError();
                  }}
                />
                <Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />
              </View>
              <Text style={styles.inputHelper}>Example: 2000-01-15 or 15-01-2000</Text>
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => setShowGenderModal(!showGenderModal)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownValue}>
                  {gender === Gender.WOMAN ? 'Female' : gender === Gender.MAN ? 'Male' : 'Non-binary'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>

              {/* Gender selector choices */}
              {showGenderModal && (
                <View style={styles.genderOptions}>
                  {[
                    { label: 'Female', value: Gender.WOMAN },
                    { label: 'Male', value: Gender.MAN },
                    { label: 'Non-binary', value: Gender.NON_BINARY },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.genderOptionItem,
                        gender === item.value && styles.genderOptionSelected,
                      ]}
                      onPress={() => {
                        setGender(item.value);
                        setShowGenderModal(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          gender === item.value && styles.genderOptionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {displayedError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  formContainer: {
    gap: 16,
    marginTop: 10,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  iconInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  iconInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputHelper: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
  },
  dropdownValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  genderOptions: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  genderOptionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  genderOptionSelected: {
    backgroundColor: Colors.primaryLight,
  },
  genderOptionText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  genderOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
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
    marginTop: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
