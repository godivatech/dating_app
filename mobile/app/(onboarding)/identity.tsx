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

const MONTHS = [
  { val: 1, name: 'Jan', full: 'January' },
  { val: 2, name: 'Feb', full: 'February' },
  { val: 3, name: 'Mar', full: 'March' },
  { val: 4, name: 'Apr', full: 'April' },
  { val: 5, name: 'May', full: 'May' },
  { val: 6, name: 'Jun', full: 'June' },
  { val: 7, name: 'Jul', full: 'July' },
  { val: 8, name: 'Aug', full: 'August' },
  { val: 9, name: 'Sep', full: 'September' },
  { val: 10, name: 'Oct', full: 'October' },
  { val: 11, name: 'Nov', full: 'November' },
  { val: 12, name: 'Dec', full: 'December' },
];

function validateDateParts(
  dayStr: string,
  monthNum: number,
  yearStr: string,
): { normalized: string; age: number | null; error?: string } {
  const day = parseInt(dayStr.trim(), 10);
  const year = parseInt(yearStr.trim(), 10);

  if (!dayStr.trim() || !yearStr.trim() || isNaN(day) || isNaN(year)) {
    return { normalized: '', age: null };
  }

  if (day < 1 || day > 31) {
    return { normalized: '', age: null, error: 'Please enter a valid day (1–31)' };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1920 || year > currentYear) {
    return { normalized: '', age: null, error: `Enter a birth year between 1920 and ${currentYear}` };
  }

  const testDate = new Date(year, monthNum - 1, day);
  if (
    isNaN(testDate.getTime()) ||
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== monthNum - 1 ||
    testDate.getDate() !== day
  ) {
    return {
      normalized: '',
      age: null,
      error: `Invalid date for ${MONTHS.find((m) => m.val === monthNum)?.full || 'selected month'}`,
    };
  }

  const mm = monthNum.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  const normalized = `${year}-${mm}-${dd}`;

  const today = new Date();
  let age = today.getFullYear() - year;
  const cMonth = today.getMonth() + 1;
  const cDay = today.getDate();

  if (cMonth < monthNum || (cMonth === monthNum && cDay < day)) {
    age--;
  }

  if (age < 18) {
    return { normalized, age, error: 'You must be at least 18 years old to join Truelove' };
  }

  if (age > 100) {
    return { normalized, age, error: 'Please enter a valid birth year' };
  }

  return { normalized, age };
}

export default function IdentityScreen() {
  const router = useRouter();
  const { profile, saveIdentity, isLoading, error: storeError, clearError } = useProfileStore();

  const [name, setName] = useState(profile?.displayName || '');

  // Initialize DOB parts
  const initialDateStr =
    (profile as any)?.dateOfBirth
      ? (profile as any).dateOfBirth.split('T')[0]
      : profile?.age
        ? `${new Date().getFullYear() - profile.age}-01-15`
        : '2000-01-15';

  const parts = initialDateStr.split('-');
  const [birthYear, setBirthYear] = useState(parts[0] || '2000');
  const [birthMonth, setBirthMonth] = useState(parseInt(parts[1] || '1', 10));
  const [birthDay, setBirthDay] = useState(parts[2] || '15');
  const [showMonthModal, setShowMonthModal] = useState(false);

  const [gender, setGender] = useState<Gender>(profile?.gender || Gender.WOMAN);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live validation & calculated age
  const liveDate = validateDateParts(birthDay, birthMonth, birthYear);

  const handleContinue = async () => {
    setValidationError(null);
    clearError();

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setValidationError('Please enter your full name (at least 2 characters)');
      return;
    }

    if (trimmedName.length > 50) {
      setValidationError('Full name cannot exceed 50 characters');
      return;
    }

    if (!birthDay.trim() || !birthYear.trim()) {
      setValidationError('Please enter your complete date of birth');
      return;
    }

    if (liveDate.error) {
      setValidationError(liveDate.error);
      return;
    }

    if (!liveDate.normalized) {
      setValidationError('Please enter a valid date of birth');
      return;
    }

    try {
      const success = await saveIdentity({
        displayName: trimmedName,
        dateOfBirth: liveDate.normalized,
        gender,
      });

      if (success) {
        router.push('/(onboarding)/photos');
      } else {
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
                autoCapitalize="words"
                onChangeText={(text) => {
                  setName(text);
                  if (validationError) setValidationError(null);
                  if (storeError) clearError();
                }}
              />
            </View>

            {/* Date of Birth (Modern 3-Segment Picker) */}
            <View style={styles.inputGroup}>
              <View style={styles.dobHeaderRow}>
                <Text style={styles.label}>Date of Birth</Text>
                <Text style={styles.badge18}>18+ Only</Text>
              </View>

              <View style={styles.dobRow}>
                {/* Day Input */}
                <View style={styles.dobDayCol}>
                  <Text style={styles.dobSubLabel}>Day</Text>
                  <TextInput
                    style={styles.dobInput}
                    placeholder="DD"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={birthDay}
                    onChangeText={(text) => {
                      setBirthDay(text);
                      if (validationError) setValidationError(null);
                      if (storeError) clearError();
                    }}
                  />
                </View>

                {/* Month Dropdown Button */}
                <View style={styles.dobMonthCol}>
                  <Text style={styles.dobSubLabel}>Month</Text>
                  <TouchableOpacity
                    style={styles.dobMonthBtn}
                    onPress={() => {
                      setShowMonthModal(!showMonthModal);
                      setShowGenderModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dobMonthBtnText}>
                      {MONTHS.find((m) => m.val === birthMonth)?.name}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Year Input */}
                <View style={styles.dobYearCol}>
                  <Text style={styles.dobSubLabel}>Year</Text>
                  <TextInput
                    style={styles.dobInput}
                    placeholder="YYYY"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={birthYear}
                    onChangeText={(text) => {
                      setBirthYear(text);
                      if (validationError) setValidationError(null);
                      if (storeError) clearError();
                    }}
                  />
                </View>
              </View>

              {/* Month Grid Dropdown */}
              {showMonthModal && (
                <View style={styles.monthGridContainer}>
                  <Text style={styles.monthGridTitle}>Select Birth Month</Text>
                  <View style={styles.monthGrid}>
                    {MONTHS.map((m) => {
                      const isSelected = birthMonth === m.val;
                      return (
                        <TouchableOpacity
                          key={m.val}
                          style={[
                            styles.monthChip,
                            isSelected && styles.monthChipSelected,
                          ]}
                          onPress={() => {
                            setBirthMonth(m.val);
                            setShowMonthModal(false);
                            if (validationError) setValidationError(null);
                            if (storeError) clearError();
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.monthChipText,
                              isSelected && styles.monthChipTextSelected,
                            ]}
                          >
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Live Age Feedback Badge */}
              {liveDate.age !== null ? (
                <View
                  style={[
                    styles.ageBadge,
                    liveDate.age < 18 ? styles.ageBadgeError : styles.ageBadgeSuccess,
                  ]}
                >
                  <Ionicons
                    name={liveDate.age < 18 ? 'alert-circle' : 'sparkles'}
                    size={16}
                    color={liveDate.age < 18 ? '#EF4444' : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.ageBadgeText,
                      liveDate.age < 18 ? styles.ageBadgeTextError : styles.ageBadgeTextSuccess,
                    ]}
                  >
                    {liveDate.age < 18
                      ? `Age: ${liveDate.age} (Must be at least 18 to register)`
                      : `Age: ${liveDate.age} years old`}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.dobPrivacyNote}>
                🔒 Only your age is shown to matches. Your exact birthdate is never shared.
              </Text>
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity
                style={styles.dropdownInput}
                onPress={() => {
                  setShowGenderModal(!showGenderModal);
                  setShowMonthModal(false);
                }}
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
  dobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge18: {
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  dobDayCol: {
    flex: 2,
  },
  dobMonthCol: {
    flex: 3,
  },
  dobYearCol: {
    flex: 3,
  },
  dobSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dobInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dobMonthBtn: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dobMonthBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  monthGridContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  monthGridTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthChip: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  monthChipSelected: {
    backgroundColor: Colors.primary,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  monthChipTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  ageBadgeSuccess: {
    backgroundColor: Colors.primaryLight,
  },
  ageBadgeError: {
    backgroundColor: '#FEE2E2',
  },
  ageBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ageBadgeTextSuccess: {
    color: Colors.primary,
  },
  ageBadgeTextError: {
    color: '#EF4444',
  },
  dobPrivacyNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
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
