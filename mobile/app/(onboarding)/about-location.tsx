import React, { useState, useEffect } from 'react';
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
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { useProfileStore } from '../../src/stores/profile-store';
import { Colors } from '../../src/theme/colors';

const POPULAR_CITIES = [
  { city: 'Chennai', region: 'Tamil Nadu' },
  { city: 'Bengaluru', region: 'Karnataka' },
  { city: 'Coimbatore', region: 'Tamil Nadu' },
  { city: 'Madurai', region: 'Tamil Nadu' },
  { city: 'Hyderabad', region: 'Telangana' },
  { city: 'Mumbai', region: 'Maharashtra' },
  { city: 'Delhi NCR', region: 'Delhi' },
  { city: 'Pune', region: 'Maharashtra' },
  { city: 'Kochi', region: 'Kerala' },
  { city: 'Kolkata', region: 'West Bengal' },
  { city: 'Tiruchirappalli', region: 'Tamil Nadu' },
  { city: 'Salem', region: 'Tamil Nadu' },
  { city: 'Pondicherry', region: 'Puducherry' },
];

const ALL_CITIES = [
  ...POPULAR_CITIES,
  { city: 'Ahmedabad', region: 'Gujarat' },
  { city: 'Jaipur', region: 'Rajasthan' },
  { city: 'Chandigarh', region: 'Punjab' },
  { city: 'Indore', region: 'Madhya Pradesh' },
  { city: 'Lucknow', region: 'Uttar Pradesh' },
  { city: 'Visakhapatnam', region: 'Andhra Pradesh' },
  { city: 'Thiruvananthapuram', region: 'Kerala' },
  { city: 'Goa', region: 'Goa' },
  { city: 'Nagpur', region: 'Maharashtra' },
  { city: 'Bhopal', region: 'Madhya Pradesh' },
  { city: 'Patna', region: 'Bihar' },
  { city: 'Vadodara', region: 'Gujarat' },
  { city: 'Surat', region: 'Gujarat' },
  { city: 'Mysuru', region: 'Karnataka' },
  { city: 'Tirunelveli', region: 'Tamil Nadu' },
  { city: 'Vellore', region: 'Tamil Nadu' },
];

const BIO_STARTERS = [
  '☕ Coffee lover & weekend explorer.',
  '🎵 Live music, good vibes & spontaneous trips.',
  '✨ Looking for genuine smiles & good conversation.',
  '📚 Bookworm by day, aspiring chef by night.',
];

export default function AboutLocationScreen() {
  const router = useRouter();
  const { profile, saveAboutLocation, isLoading, error, clearError } = useProfileStore();

  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.locationCity || '');
  const [region, setRegion] = useState(profile?.locationRegion || '');
  const [latitude, setLatitude] = useState<number | undefined>(profile?.latitude || undefined);
  const [longitude, setLongitude] = useState<number | undefined>(profile?.longitude || undefined);

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.bio) setBio(profile.bio);
      if (profile.locationCity) setCity(profile.locationCity);
      if (profile.locationRegion) setRegion(profile.locationRegion);
    }
  }, [profile]);

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setValidationError(null);
    clearError();
    try {
      const res = await fetch('https://freeipapi.com/api/json');
      if (res.ok) {
        const data = await res.json();
        if (data.cityName) {
          setCity(data.cityName);
          setRegion(data.regionName || 'Tamil Nadu');
          if (data.latitude && data.longitude) {
            setLatitude(data.latitude);
            setLongitude(data.longitude);
          }
          setDetectedLocation(`${data.cityName}, ${data.regionName || ''}`);
        }
      }
    } catch {
      setValidationError('Could not auto-detect location. Please choose a city below.');
    } finally {
      setIsDetecting(false);
    }
  };

  const selectCityPreset = (preset: { city: string; region: string }) => {
    setCity(preset.city);
    setRegion(preset.region);
    setDetectedLocation(null);
    if (validationError) setValidationError(null);
    if (error) clearError();
  };

  const applyBioStarter = (starter: string) => {
    if (!bio.trim()) {
      setBio(starter);
    } else {
      setBio(`${bio.trim()} ${starter}`);
    }
    if (validationError) setValidationError(null);
    if (error) clearError();
  };

  // Suggestions while typing
  const trimmedCityQuery = city.trim().toLowerCase();
  const citySuggestions =
    trimmedCityQuery.length >= 1
      ? ALL_CITIES.filter(
          (c) =>
            c.city.toLowerCase().includes(trimmedCityQuery) &&
            c.city.toLowerCase() !== trimmedCityQuery,
        ).slice(0, 3)
      : [];

  const handleComplete = async () => {
    setValidationError(null);
    clearError();

    const trimmedBio = bio.trim();
    if (trimmedBio.length < 10) {
      setValidationError('Please write a short bio (at least 10 characters).');
      return;
    }
    if (trimmedBio.length > 500) {
      setValidationError('Bio cannot exceed 500 characters.');
      return;
    }

    const trimmedCity = city.trim();
    if (trimmedCity.length < 2) {
      setValidationError('Please select or enter your city (at least 2 characters).');
      return;
    }
    if (trimmedCity.length > 60) {
      setValidationError('City name cannot exceed 60 characters.');
      return;
    }

    const trimmedRegion = region.trim();
    if (trimmedRegion.length > 60) {
      setValidationError('Region/State cannot exceed 60 characters.');
      return;
    }

    const success = await saveAboutLocation({
      bio: trimmedBio,
      locationCity: trimmedCity,
      locationRegion: trimmedRegion || undefined,
      latitude,
      longitude,
    });

    if (success) {
      router.push('/(onboarding)/ready');
    }
  };

  const displayedError = validationError || error;

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
          keyboardShouldPersistTaps="handled"
        >
          {/* Stepper Progress Bar: 05 active */}
          <StepperHeader currentStep={5} />

          <View style={styles.header}>
            <Text style={styles.title}>About & Location</Text>
            <Text style={styles.subtitle}>
              Tell matches what makes you unique and where you are located.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Bio Input */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.label}>Your Bio</Text>
                <Text style={styles.counterText}>{bio.length}/500</Text>
              </View>
              <TextInput
                style={styles.bioInput}
                placeholder="Write a few words about what you love, your passions, or what you're looking for..."
                placeholderTextColor={Colors.textMuted}
                value={bio}
                onChangeText={(text) => {
                  setBio(text);
                  if (validationError) setValidationError(null);
                  if (error) clearError();
                }}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Bio Inspiration Chips */}
              <View style={styles.bioStartersContainer}>
                <Text style={styles.bioStartersHeader}>Need inspiration? Tap to add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.startersScroll}>
                  {BIO_STARTERS.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.starterChip}
                      onPress={() => applyBioStarter(item)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.starterChipText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Location Section */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.label}>Your Location</Text>
                {/* 1-Tap Auto Detect Button */}
                <TouchableOpacity
                  style={styles.detectBtn}
                  onPress={handleAutoDetect}
                  disabled={isDetecting}
                  activeOpacity={0.8}
                >
                  {isDetecting ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={13} color={Colors.primary} />
                      <Text style={styles.detectBtnText}>Auto-Detect</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {detectedLocation ? (
                <View style={styles.detectedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.detectedBadgeText}>Detected: {detectedLocation}</Text>
                </View>
              ) : null}

              {/* Popular Cities 1-Tap Chips */}
              <Text style={styles.popularLabel}>Popular Cities (1-Tap Select):</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularCitiesRow}
              >
                {POPULAR_CITIES.map((item) => {
                  const isSelected = city === item.city;
                  return (
                    <TouchableOpacity
                      key={item.city}
                      style={[styles.cityChip, isSelected && styles.cityChipSelected]}
                      onPress={() => selectCityPreset(item)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="location-sharp"
                        size={12}
                        color={isSelected ? Colors.white : Colors.primary}
                      />
                      <Text style={[styles.cityChipText, isSelected && styles.cityChipTextSelected]}>
                        {item.city}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* City Input with Autocomplete */}
              <View style={styles.cityInputWrapper}>
                <Text style={styles.subLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chennai, Coimbatore, Madurai"
                  placeholderTextColor={Colors.textMuted}
                  value={city}
                  maxLength={60}
                  onChangeText={(text) => {
                    setCity(text);
                    setDetectedLocation(null);
                    if (validationError) setValidationError(null);
                    if (error) clearError();
                  }}
                />
              </View>

              {/* Autocomplete Suggestions Dropdown */}
              {citySuggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {citySuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.city}
                      style={styles.suggestionItem}
                      onPress={() => selectCityPreset(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="location-outline" size={14} color={Colors.primary} />
                      <Text style={styles.suggestionText}>
                        {item.city}, <Text style={styles.suggestionRegion}>{item.region}</Text>
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Region / State */}
              <View style={styles.cityInputWrapper}>
                <Text style={styles.subLabel}>Region / State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Tamil Nadu"
                  placeholderTextColor={Colors.textMuted}
                  value={region}
                  maxLength={60}
                  onChangeText={(text) => {
                    setRegion(text);
                    if (validationError) setValidationError(null);
                    if (error) clearError();
                  }}
                />
              </View>
            </View>

            {displayedError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{displayedError}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueButtonText}>Save & Proceed</Text>
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
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  cityInputWrapper: {
    marginTop: 6,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  bioInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 100,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  counterText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bioStartersContainer: {
    marginTop: 4,
  },
  bioStartersHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  startersScroll: {
    flexDirection: 'row',
  },
  starterChip: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  starterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  detectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  detectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  detectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  popularLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  popularCitiesRow: {
    gap: 8,
    paddingVertical: 4,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cityChipTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  suggestionsBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  suggestionRegion: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
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
    marginTop: 32,
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
