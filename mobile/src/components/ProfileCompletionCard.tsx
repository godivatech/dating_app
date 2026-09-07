import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeDatingProfile, ProfileCompletionResult } from '../../../shared/src/types';
import { Colors } from '../theme/colors';

interface ProfileCompletionCardProps {
  profile: SafeDatingProfile | null;
  completion?: ProfileCompletionResult | null;
  onRefresh?: () => void;
  compact?: boolean;
}

interface StepItem {
  id: string;
  number: number;
  title: string;
  description: string;
  iconName: string;
  route: string;
  isComplete: boolean;
}

export function ProfileCompletionCard({
  profile,
  completion,
  onRefresh,
  compact = false,
}: ProfileCompletionCardProps) {
  const router = useRouter();

  // Evaluate each milestone explicitly (prioritize backend missingFields when available)
  const missing = completion?.missingFields;

  const isIdentityDone = missing
    ? !missing.includes('identity')
    : Boolean(
        profile?.displayName &&
        profile.displayName.trim().length >= 2 &&
        profile?.gender
      );

  const isPhotosDone = missing
    ? !missing.includes('photos')
    : Boolean((profile?.photos?.length || 0) >= 1);

  const isInterestsDone = missing
    ? !missing.includes('interests')
    : Boolean((profile?.interests?.length || 0) >= 3);

  const isPreferencesDone = missing
    ? !missing.includes('preferences')
    : Boolean(
        profile?.preferences?.relationshipIntent &&
        (profile?.preferences?.minAge || 18) >= 18
      );

  const isAboutDone = missing
    ? !missing.includes('about-location') && !missing.includes('bio') && !missing.includes('locationCity')
    : Boolean(
        (profile?.bio?.trim()?.length || 0) >= 10 &&
        (profile?.locationCity?.trim()?.length || 0) >= 2
      );

  const steps: StepItem[] = [
    {
      id: 'identity',
      number: 1,
      title: 'Basic Info',
      description: isIdentityDone
        ? `${profile?.displayName}, ${profile?.gender}`
        : 'Enter your name, birthday & gender',
      iconName: 'person',
      route: '/(onboarding)/identity',
      isComplete: isIdentityDone,
    },
    {
      id: 'photos',
      number: 2,
      title: 'Profile Photos',
      description: isPhotosDone
        ? `${profile?.photos?.length} photo(s) added`
        : 'Upload at least 1 clear photo',
      iconName: 'image',
      route: '/(onboarding)/photos',
      isComplete: isPhotosDone,
    },
    {
      id: 'interests',
      number: 3,
      title: 'Passions & Interests',
      description: isInterestsDone
        ? `${profile?.interests?.length} interests selected`
        : `Select 3 or more interests (${profile?.interests?.length || 0}/3)`,
      iconName: 'heart',
      route: '/(onboarding)/interests',
      isComplete: isInterestsDone,
    },
    {
      id: 'preferences',
      number: 4,
      title: 'Dating Preferences',
      description: isPreferencesDone
        ? `${profile?.preferences?.relationshipIntent?.replace('_', ' ')}`
        : 'Set who you want to date & age range',
      iconName: 'options',
      route: '/(onboarding)/preferences',
      isComplete: isPreferencesDone,
    },
    {
      id: 'about',
      number: 5,
      title: 'Bio & Location',
      description: isAboutDone
        ? `${profile?.locationCity}`
        : 'Write a short bio (10+ chars) & city',
      iconName: 'location',
      route: '/(onboarding)/about-location',
      isComplete: isAboutDone,
    },
  ];

  const completedCount = steps.filter((s) => s.isComplete).length;
  const percentage = completion?.completionScore || Math.round((completedCount / steps.length) * 100);
  const firstIncompleteStep = steps.find((s) => !s.isComplete);

  if (compact) {
    if (percentage === 100) return null;

    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={() => {
          if (firstIncompleteStep) {
            router.push(firstIncompleteStep.route as any);
          } else {
            router.push('/profile/edit' as any);
          }
        }}
        activeOpacity={0.9}
      >
        <View style={styles.compactLeft}>
          <View style={styles.compactIconCircle}>
            <Ionicons name="sparkles" size={18} color={Colors.primary} />
          </View>
          <View style={styles.compactTexts}>
            <Text style={styles.compactTitle}>Complete Profile ({percentage}%)</Text>
            <Text style={styles.compactSubtitle}>
              Next: {firstIncompleteStep?.title || 'Finish Setup'}
            </Text>
          </View>
        </View>
        <View style={styles.compactRightBtn}>
          <Text style={styles.compactRightBtnText}>Complete</Text>
          <Feather name="arrow-right" size={14} color={Colors.white} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Badge & Title */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.sparkleBadge}>
            <Ionicons name="sparkles" size={14} color={Colors.primary} />
            <Text style={styles.sparkleBadgeText}>Quick Setup</Text>
          </View>
          <Text style={styles.progressPercent}>{percentage}%</Text>
        </View>

        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Finish these {5 - completedCount} quick step(s) to unlock matching and discovery in your area.
        </Text>

        {/* Multi-step Progress Bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      </View>

      {/* Checklist Steps */}
      <View style={styles.stepsList}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepCard,
              step.isComplete ? styles.stepCardComplete : styles.stepCardPending,
            ]}
            onPress={() => router.push(step.route as any)}
            activeOpacity={0.8}
          >
            {/* Step Check Icon */}
            <View
              style={[
                styles.stepIconWrapper,
                step.isComplete ? styles.stepIconComplete : styles.stepIconPending,
              ]}
            >
              {step.isComplete ? (
                <Ionicons name="checkmark" size={16} color={Colors.white} />
              ) : (
                <Text style={styles.stepNumberText}>{step.number}</Text>
              )}
            </View>

            {/* Step Content */}
            <View style={styles.stepContent}>
              <View style={styles.stepTitleRow}>
                <Text
                  style={[
                    styles.stepTitle,
                    step.isComplete && styles.stepTitleComplete,
                  ]}
                >
                  {step.title}
                </Text>
                {step.isComplete && (
                  <View style={styles.doneChip}>
                    <Text style={styles.doneChipText}>Done</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.stepDescription,
                  step.isComplete && styles.stepDescriptionComplete,
                ]}
                numberOfLines={1}
              >
                {step.description}
              </Text>
            </View>

            {/* Step Action Button */}
            <View style={styles.stepAction}>
              {step.isComplete ? (
                <Feather name="edit-2" size={16} color={Colors.textMuted} />
              ) : (
                <View style={styles.actionArrowBtn}>
                  <Feather name="arrow-right" size={16} color={Colors.primary} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Big Action Button */}
      <View style={styles.actionFooter}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            if (firstIncompleteStep) {
              router.push(firstIncompleteStep.route as any);
            } else if (onRefresh) {
              onRefresh();
            } else {
              router.push('/(onboarding)/ready' as any);
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {firstIncompleteStep
              ? `Continue: ${firstIncompleteStep.title}`
              : 'Unlock Discovery Now 🎉'}
          </Text>
          <Feather name="arrow-right" size={18} color={Colors.white} />
        </TouchableOpacity>

        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshLink}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.refreshLinkText}>Refresh profile status</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sparkleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  stepsList: {
    gap: 10,
    marginBottom: 20,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  stepCardComplete: {
    borderColor: '#E5E7EB',
    opacity: 0.88,
  },
  stepCardPending: {
    borderColor: '#FFE4E6',
    backgroundColor: '#FFFDFD',
  },
  stepIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepIconComplete: {
    backgroundColor: '#10B981',
  },
  stepIconPending: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepTitleComplete: {
    color: Colors.textSecondary,
  },
  doneChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  stepDescription: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  stepDescriptionComplete: {
    color: '#9CA3AF',
  },
  stepAction: {
    marginLeft: 10,
  },
  actionArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFooter: {
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 26,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  refreshLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  refreshLinkText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  compactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTexts: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  compactSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  compactRightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  compactRightBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
});
