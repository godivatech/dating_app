import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { CityPassportModal } from '../../src/components/CityPassportModal';
import { useProfileStore } from '../../src/stores/profile-store';
import {
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
} from '../../../shared/src/types';
import { Colors } from '../../src/theme/colors';

export default function PreferencesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromProfile?: string }>();
  const isFromProfile = params.fromProfile === 'true';
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
  const [globalMode, setGlobalMode] = useState<boolean>(
    profile?.preferences?.globalMode || false,
  );
  const [targetCity, setTargetCity] = useState<string | null | undefined>(
    profile?.preferences?.targetCity,
  );
  const [targetRegion, setTargetRegion] = useState<string | null | undefined>(
    profile?.preferences?.targetRegion,
  );
  const [passportModalVisible, setPassportModalVisible] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.preferences) {
      setGenderMode(profile.preferences.preferredGenderMode);
      setSelectedGenders(profile.preferences.preferredGenders);
      setMinAge(String(profile.preferences.minAge));
      setMaxAge(String(profile.preferences.maxAge));
      setIntent(profile.preferences.relationshipIntent);
      setGlobalMode(!!profile.preferences.globalMode);
      setTargetCity(profile.preferences.targetCity);
      setTargetRegion(profile.preferences.targetRegion);
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
    if (numMax > 99) {
      setValidationError('Maximum age cannot exceed 99.');
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
      globalMode,
      targetCity: globalMode ? null : targetCity,
      targetRegion: globalMode ? null : targetRegion,
    });

    if (success) {
      if (isFromProfile) {
        router.back();
      } else {
        router.push('/(onboarding)/about-location');
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
      <TrueloveHeader
        showBack={true}
        title={isFromProfile ? 'Match Preferences' : 'Dating Preferences'}
        showLogo={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper Progress Bar: only shown during onboarding */}
        {!isFromProfile && <StepperHeader currentStep={4} />}
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
                maxLength={2}
                value={minAge}
                onChangeText={(text) => {
                  setMinAge(text);
                  if (validationError) setValidationError(null);
                  if (error) clearError();
                }}
              />
            </View>
            <Text style={styles.toText}>to</Text>
            <View style={styles.ageInputCol}>
              <Text style={styles.inputLabel}>Max Age</Text>
              <TextInput
                style={styles.ageInput}
                keyboardType="numeric"
                maxLength={2}
                value={maxAge}
                onChangeText={(text) => {
                  setMaxAge(text);
                  if (validationError) setValidationError(null);
                  if (error) clearError();
                }}
              />
            </View>
          </View>
        </View>

        {/* Dating Scope / Target City Passport & Global Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery Scope</Text>

          {/* Target City Passport Card */}
          <TouchableOpacity
            style={[styles.passportCard, !!targetCity && styles.passportCardActive]}
            onPress={() => setPassportModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.passportCardHeader}>
              <View style={[styles.passportIconCircle, !!targetCity && styles.passportIconCircleActive]}>
                <Ionicons
                  name="airplane"
                  size={20}
                  color={targetCity ? '#7C3AED' : '#8B5CF6'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passportCardTitle}>
                  {targetCity ? `Target City: ${targetCity}` : 'Destination Passport (Travel Mode)'}
                </Text>
                <Text style={styles.passportCardSub}>
                  {targetCity
                    ? `Exploring singles living in ${targetCity}${targetRegion ? `, ${targetRegion}` : ''}`
                    : 'Explore singles in another city (Chennai, Bengaluru, Mumbai, Dubai, etc.)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>

            {!!targetCity && (
              <View style={styles.passportActionsRow}>
                <TouchableOpacity
                  style={styles.changePassportBtn}
                  onPress={() => setPassportModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#7C3AED" style={{ marginRight: 4 }} />
                  <Text style={styles.changePassportBtnText}>Change City</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetPassportBtn}
                  onPress={() => {
                    setTargetCity(null);
                    setTargetRegion(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.resetPassportBtnText}>Reset to Local</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>

          {/* Global Mode Switch Card */}
          <View style={[styles.scopeCard, { marginTop: 12 }]}>
            <View style={styles.scopeInfo}>
              <View style={styles.scopeTitleRow}>
                <Ionicons
                  name={globalMode ? 'earth' : 'location-sharp'}
                  size={18}
                  color={globalMode ? Colors.primary : Colors.textMuted}
                />
                <Text style={styles.scopeTitle}>
                  {globalMode
                    ? 'Explore Worldwide (Global)'
                    : 'Nearby Discovery (Local)'}
                </Text>
              </View>
              <Text style={styles.scopeSubText}>
                {globalMode
                  ? 'Active: See compatible singles from across India and worldwide. Distance restrictions lifted.'
                  : 'Prioritizes verified singles living in your local area and city first.'}
              </Text>
            </View>
            <Switch
              value={globalMode}
              onValueChange={(val) => {
                setGlobalMode(val);
                if (val) {
                  setTargetCity(null);
                  setTargetRegion(null);
                }
              }}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
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

      {/* City Passport Modal */}
      <CityPassportModal
        visible={passportModalVisible}
        currentCity={targetCity}
        homeCity={profile?.locationCity}
        onClose={() => setPassportModalVisible(false)}
        onSelectCity={(city, region) => {
          setTargetCity(city);
          setTargetRegion(region || null);
          setGlobalMode(false);
        }}
        onResetLocation={() => {
          setTargetCity(null);
          setTargetRegion(null);
        }}
      />
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
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSecondary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scopeInfo: {
    flex: 1,
    paddingRight: 12,
  },
  scopeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  scopeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scopeSubText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  passportCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  passportCardActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  passportCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passportIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportIconCircleActive: {
    backgroundColor: '#DDD6FE',
  },
  passportCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  passportCardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  passportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DDD6FE',
  },
  changePassportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  changePassportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  resetPassportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  resetPassportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
