import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../src/stores/profile-store';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { Colors } from '../../src/theme/colors';

const FALLBACK_INTERESTS = [
  { id: 'outdoors-hiking', name: 'Hiking', category: 'Outdoors' },
  { id: 'outdoors-beach', name: 'Beach Trips', category: 'Outdoors' },
  { id: 'music-live', name: 'Live Music', category: 'Music' },
  { id: 'music-bollywood', name: 'Bollywood & Classical', category: 'Music' },
  { id: 'food-coffee', name: 'Coffee & Cafes', category: 'Food & Drink' },
  { id: 'food-cooking', name: 'Cooking', category: 'Food & Drink' },
  { id: 'food-street', name: 'Street Food', category: 'Food & Drink' },
  { id: 'fitness-gym', name: 'Gym & Fitness', category: 'Fitness & Sports' },
  { id: 'fitness-yoga', name: 'Yoga & Wellness', category: 'Fitness & Sports' },
  { id: 'sports-cricket', name: 'Cricket', category: 'Fitness & Sports' },
  { id: 'arts-photography', name: 'Photography', category: 'Arts & Culture' },
  { id: 'arts-cinema', name: 'Movies & Cinema', category: 'Arts & Culture' },
  { id: 'arts-reading', name: 'Reading & Books', category: 'Arts & Culture' },
  { id: 'lifestyle-travel', name: 'Travel & Trips', category: 'Lifestyle' },
  { id: 'lifestyle-gaming', name: 'Gaming', category: 'Lifestyle' },
  { id: 'lifestyle-tech', name: 'Technology', category: 'Lifestyle' },
];

export default function InterestsScreen() {
  const router = useRouter();
  const {
    profile,
    referenceInterests,
    fetchReferenceInterests,
    saveInterests,
    isLoading,
    error: storeError,
    clearError,
  } = useProfileStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchReferenceInterests();
  }, [fetchReferenceInterests]);

  useEffect(() => {
    if (profile?.interests && profile.interests.length > 0) {
      const existing = profile.interests.map((i: any) => (typeof i === 'string' ? i : i.id || i.interestId));
      setSelectedIds(existing.filter(Boolean));
    } else if (selectedIds.length === 0) {
      // Default preselect 3 common interests
      setSelectedIds(['outdoors-beach', 'music-live', 'food-coffee']);
    }
  }, [profile]);

  const allInterests =
    referenceInterests.length > 0 ? referenceInterests : FALLBACK_INTERESTS;

  const toggleInterest = (id: string) => {
    if (validationError) setValidationError(null);
    if (storeError) clearError();

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 10) {
        setValidationError('You can select up to 10 interests');
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleComplete = async () => {
    setValidationError(null);
    clearError();

    if (selectedIds.length < 3) {
      setValidationError('Please select at least 3 interests');
      return;
    }
    if (selectedIds.length > 10) {
      setValidationError('You can select up to 10 interests');
      return;
    }

    try {
      const success = await saveInterests({ interestIds: selectedIds });
      if (success) {
        router.push('/(onboarding)/preferences');
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Failed to save interests');
    }
  };

  const displayedError = validationError || storeError;

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper Progress Bar: 03 active */}
        <StepperHeader currentStep={3} />

        {/* Title & Description */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Interests</Text>
          <Text style={styles.subtitle}>
            Select at least 3 tags so we can match you with people who share your passions.
          </Text>
          <Text style={styles.counterBadge}>
            {selectedIds.length} selected {selectedIds.length >= 3 ? '✓' : '(Min 3)'}
          </Text>
        </View>

        {/* Interests Cloud Grid */}
        <View style={styles.interestsGrid}>
          {allInterests.map((interest) => {
            const isSelected = selectedIds.includes(interest.id);

            return (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.interestPill,
                  isSelected && styles.interestPillSelected,
                ]}
                onPress={() => toggleInterest(interest.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.interestText,
                    isSelected && styles.interestTextSelected,
                  ]}
                >
                  {interest.name}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={Colors.primary}
                    style={styles.pillCheck}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {displayedError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayedError}</Text>
          </View>
        ) : null}

        {/* Save & Continue Button */}
        <TouchableOpacity
          style={[
            styles.completeButton,
            (selectedIds.length < 3 || selectedIds.length > 10 || isLoading) &&
              styles.buttonDisabled,
          ]}
          onPress={handleComplete}
          disabled={selectedIds.length < 3 || selectedIds.length > 10 || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.completeButtonText}>Save & Continue</Text>
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
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  counterBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  interestPillSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  pillCheck: {
    marginRight: 6,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  interestTextSelected: {
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
  completeButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
  completeButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
