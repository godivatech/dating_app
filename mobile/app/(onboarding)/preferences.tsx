import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { useProfileStore } from '../../src/stores/profile-store';
import {
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
} from '../../../shared/src/types';
import { Colors } from '../../src/theme/colors';

export default function PreferencesScreen() {
  const router = useRouter();
  const { profile, savePreferences, isLoading, error, clearError } = useProfileStore();

  const [genderMode, setGenderMode] = useState<PreferredGenderMode>(
    profile?.preferences?.preferredGenderMode || PreferredGenderMode.SELECTED,
  );
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>(
    profile?.preferences?.preferredGenders || [Gender.WOMAN],
  );
  const [minAge, setMinAge] = useState<string>(
    String(profile?.preferences?.minAge || '18'),
  );
  const [maxAge, setMaxAge] = useState<string>(
    String(profile?.preferences?.maxAge || '35'),
  );
  const [intent, setIntent] = useState<RelationshipIntent>(
    profile?.preferences?.relationshipIntent || RelationshipIntent.LONG_TERM,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.preferences) {
      setGenderMode(profile.preferences.preferredGenderMode);
      setSelectedGenders(profile.preferences.preferredGenders);
      setMinAge(String(profile.preferences.minAge));
      setMaxAge(String(profile.preferences.maxAge));
      setIntent(profile.preferences.relationshipIntent);
    }
  }, [profile]);

  const toggleGender = (g: Gender) => {
    if (selectedGenders.includes(g)) {
      if (selectedGenders.length > 1) {
        setSelectedGenders(selectedGenders.filter((item) => item !== g));
      }
    } else {
      setSelectedGenders([...selectedGenders, g]);
    }
  };

  const handleSave = async () => {
    setValidationError(null);
    clearError();

    const numMin = parseInt(minAge, 10);
    const numMax = parseInt(maxAge, 10);

    if (isNaN(numMin) || isNaN(numMax)) {
      setValidationError('Please enter valid numbers for age range.');
      return;
    }
    if (numMin < 18) {
      setValidationError('Minimum age must be at least 18.');
      return;
    }
    if (numMax > 100) {
      setValidationError('Maximum age cannot exceed 100.');
      return;
    }
    if (numMin > numMax) {
      setValidationError('Minimum age cannot be greater than maximum age.');
      return;
    }

    const success = await savePreferences({
      preferredGenderMode: genderMode,
      preferredGenders: selectedGenders,
      minAge: numMin,
      maxAge: numMax,
      relationshipIntent: intent,
    });

    if (success) {
      if (!profile?.bio || !profile?.locationCity) {
        router.push('/(onboarding)/about-location');
      } else {
        router.back();
      }
    }
  };

  const INTENT_OPTIONS: Array<{ label: string; value: RelationshipIntent }> = [
    { label: 'Long-term Relationship', value: RelationshipIntent.LONG_TERM },
    { label: 'Serious Dating', value: RelationshipIntent.SERIOUS_DATING },
    { label: 'Marriage', value: RelationshipIntent.MARRIAGE },
    { label: 'Open to Explore', value: RelationshipIntent.OPEN_TO_EXPLORE },
    { label: 'Casual Dating', value: RelationshipIntent.CASUAL },
  ];

  const displayedError = validationError || error;

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} title="Dating Preferences" showLogo={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper Progress Bar: 04 active */}
        <StepperHeader currentStep={4} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interested In</Text>
          <View style={styles.pillsRow}>
            {[
              { label: 'Women', val: Gender.WOMAN },
              { label: 'Men', val: Gender.MAN },
              { label: 'Everyone', val: Gender.NON_BINARY },
            ].map((item) => {
              const isSelected = selectedGenders.includes(item.val);
              return (
                <TouchableOpacity
                  key={item.val}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => toggleGender(item.val)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={Colors.primary}
                      style={styles.checkIcon}
                    />
                  )}
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age Range</Text>
          <View style={styles.ageInputRow}>
            <View style={styles.ageInputCol}>
              <Text style={styles.inputLabel}>Min Age</Text>
              <TextInput
                style={styles.ageInput}
                keyboardType="numeric"
                maxLength={3}
                value={minAge}
                onChangeText={setMinAge}
              />
            </View>
            <Text style={styles.toText}>to</Text>
            <View style={styles.ageInputCol}>
              <Text style={styles.inputLabel}>Max Age</Text>
              <TextInput
                style={styles.ageInput}
                keyboardType="numeric"
                maxLength={3}
                value={maxAge}
                onChangeText={setMaxAge}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship Intent</Text>
          <View style={styles.intentsList}>
            {INTENT_OPTIONS.map((item) => {
              const isSelected = intent === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.intentCard, isSelected && styles.intentCardSelected]}
                  onPress={() => setIntent(item.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.intentText, isSelected && styles.intentTextSelected]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {displayedError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayedError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  pillSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  checkIcon: {
    marginRight: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pillTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ageInputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  ageInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  toText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 20,
  },
  intentsList: {
    gap: 10,
  },
  intentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  intentCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  intentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  intentTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
