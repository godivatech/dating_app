import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { useProfileStore } from '../../src/stores/profile-store';
import {
  Gender,
  RelationshipIntent,
  PreferredGenderMode,
} from '../../../shared/src/types';
import { Colors } from '../../src/theme/colors';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, completion, fetchProfile, saveIdentity, saveAboutLocation, savePreferences } =
    useProfileStore();

  const [displayName, setDisplayName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [gender, setGender] = useState<Gender>(Gender.MAN);
  const [bio, setBio] = useState<string>('');
  const [locationCity, setLocationCity] = useState<string>('');
  const [locationRegion, setLocationRegion] = useState<string>('');
  const [intent, setIntent] = useState<RelationshipIntent>(RelationshipIntent.LONG_TERM);
  const [minAge, setMinAge] = useState<string>('21');
  const [maxAge, setMaxAge] = useState<string>('35');
  const [genderMode, setGenderMode] = useState<PreferredGenderMode>(PreferredGenderMode.SELECTED);
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>([Gender.WOMAN]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    const p = await fetchProfile();
    if (p) {
      setDisplayName(p.displayName || '');
      setDateOfBirth((p as any).dateOfBirth ? String((p as any).dateOfBirth).split('T')[0] : '');
      setGender(p.gender || Gender.MAN);
      setBio(p.bio || '');
      setLocationCity(p.locationCity || '');
      setLocationRegion(p.locationRegion || '');
      if (p.preferences) {
        setIntent(p.preferences.relationshipIntent || RelationshipIntent.LONG_TERM);
        setMinAge(String(p.preferences.minAge || 21));
        setMaxAge(String(p.preferences.maxAge || 35));
        setGenderMode(p.preferences.preferredGenderMode || PreferredGenderMode.SELECTED);
        if (p.preferences.preferredGenders && p.preferences.preferredGenders.length > 0) {
          setSelectedGenders(p.preferences.preferredGenders);
        } else {
          setSelectedGenders(p.gender === Gender.WOMAN ? [Gender.MAN] : [Gender.WOMAN]);
        }
      }
    }
  };

  const calculateClientAge = (dobString: string): number => {
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSave = async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    if (dateOfBirth) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        setError('Invalid birthdate format. Use YYYY-MM-DD');
        return;
      }
      const clientAge = calculateClientAge(dateOfBirth);
      if (clientAge < 18) {
        setError('You must be at least 18 years old.');
        return;
      }
    }

    const trimmedCity = locationCity.trim();
    if (!trimmedCity || trimmedCity.length < 2) {
      setError('Please enter a valid city name (at least 2 characters).');
      return;
    }

    const parsedMin = parseInt(minAge, 10) || 18;
    const parsedMax = parseInt(maxAge, 10) || 50;
    if (parsedMin < 18 || parsedMax > 99 || parsedMin > parsedMax) {
      setError('Please enter a valid age preference range between 18 and 99.');
      return;
    }

    setIsSaving(true);
    try {
      if (dateOfBirth) {
        await saveIdentity({
          displayName: displayName.trim(),
          dateOfBirth,
          gender,
        });
      }

      await saveAboutLocation({
        bio: bio.trim() || undefined,
        locationCity: trimmedCity,
        locationRegion: locationRegion.trim() || undefined,
      });

      await savePreferences({
        relationshipIntent: intent,
        minAge: Math.max(18, parsedMin),
        maxAge: Math.min(99, Math.max(parsedMin, parsedMax)),
        preferredGenderMode: genderMode,
        preferredGenders: selectedGenders,
      });

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save profile.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const currentScore = completion?.completionScore || profile?.completionScore || 85;

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} title="Edit Profile" showLogo={false} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Completion Card */}
        <View style={styles.completionCard}>
          <View style={styles.completionRow}>
            <Text style={styles.completionTitle}>Profile Readiness</Text>
            <Text style={styles.completionScore}>{currentScore}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${currentScore}%` }]} />
          </View>
          <Text style={styles.completionSubtitle}>
            {currentScore === 100
              ? 'Your profile is 100% complete and discoverable!'
              : 'Complete your bio, preferences and approved photos to reach 100%.'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Basic Info Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Basic Info</Text>

          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>Birthdate</Text>
          <TextInput
            style={styles.textInput}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD (e.g. 1998-05-15)"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.genderRow}>
            {[
              { label: 'Female', val: Gender.WOMAN },
              { label: 'Male', val: Gender.MAN },
              { label: 'Non-binary', val: Gender.NON_BINARY },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                style={[
                  styles.genderChip,
                  gender === item.val && styles.activeGenderChip,
                ]}
                onPress={() => setGender(item.val)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    gender === item.val && styles.activeGenderChipText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bio & Location */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>About & Location</Text>

          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write something interesting about yourself..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.textInput}
            value={locationCity}
            onChangeText={setLocationCity}
            placeholder="e.g. Chennai"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.inputLabel}>Region / State</Text>
          <TextInput
            style={styles.textInput}
            value={locationRegion}
            onChangeText={setLocationRegion}
            placeholder="e.g. Tamil Nadu"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Dating Preferences Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Dating Preferences</Text>

          {/* Interested In */}
          <Text style={styles.inputLabel}>Interested In</Text>
          <View style={styles.genderRow}>
            {[
              { label: 'Women', genders: [Gender.WOMAN], mode: PreferredGenderMode.SELECTED },
              { label: 'Men', genders: [Gender.MAN], mode: PreferredGenderMode.SELECTED },
              { label: 'Everyone', genders: [Gender.WOMAN, Gender.MAN, Gender.NON_BINARY], mode: PreferredGenderMode.ANY },
            ].map((item) => {
              const isSelected =
                item.mode === PreferredGenderMode.ANY
                  ? genderMode === PreferredGenderMode.ANY
                  : genderMode !== PreferredGenderMode.ANY &&
                    selectedGenders.length === item.genders.length &&
                    selectedGenders.every((g) => item.genders.includes(g));

              return (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.genderChip, isSelected && styles.activeGenderChip]}
                  onPress={() => {
                    setGenderMode(item.mode);
                    setSelectedGenders(item.genders);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.genderChipText, isSelected && styles.activeGenderChipText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Relationship Intent */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Looking For</Text>
          <View style={styles.intentGrid}>
            {[
              { label: 'Long-term', val: RelationshipIntent.LONG_TERM },
              { label: 'Marriage', val: RelationshipIntent.MARRIAGE },
              { label: 'Serious Dating', val: RelationshipIntent.SERIOUS_DATING },
              { label: 'Open to Explore', val: RelationshipIntent.OPEN_TO_EXPLORE },
              { label: 'Casual', val: RelationshipIntent.CASUAL },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                style={[styles.intentChip, intent === item.val && styles.activeIntentChip]}
                onPress={() => setIntent(item.val)}
                activeOpacity={0.8}
              >
                <Text style={[styles.intentChipText, intent === item.val && styles.activeIntentChipText]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Age Preference */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Age Preference Range</Text>
          <View style={styles.ageRangeRow}>
            <View style={styles.ageInputCol}>
              <Text style={styles.ageInputSublabel}>Min Age</Text>
              <TextInput
                style={styles.textInput}
                value={minAge}
                onChangeText={setMinAge}
                keyboardType="numeric"
                maxLength={2}
                placeholder="18"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <Text style={styles.ageDivider}>to</Text>
            <View style={styles.ageInputCol}>
              <Text style={styles.ageInputSublabel}>Max Age</Text>
              <TextInput
                style={styles.textInput}
                value={maxAge}
                onChangeText={setMaxAge}
                keyboardType="numeric"
                maxLength={2}
                placeholder="35"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Photos Link */}
        <TouchableOpacity
          style={styles.photoLinkCard}
          onPress={() => router.push('/(onboarding)/photos?fromProfile=true' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.photoLinkLeft}>
            <Feather name="image" size={22} color={Colors.primary} />
            <View style={styles.photoLinkTextCol}>
              <Text style={styles.photoLinkTitle}>Manage Photos</Text>
              <Text style={styles.photoLinkSubtitle}>
                Add, reorder or change primary photo
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  completionCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  completionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  completionScore: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  completionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  activeGenderChip: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  genderChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeGenderChipText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  intentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  intentChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeIntentChip: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  intentChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeIntentChipText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  ageRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  ageInputCol: {
    flex: 1,
  },
  ageInputSublabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  ageDivider: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 16,
  },
  photoLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  photoLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoLinkTextCol: {
    flex: 1,
  },
  photoLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  photoLinkSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  saveButton: {
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
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
