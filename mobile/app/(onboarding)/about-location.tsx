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
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { useProfileStore } from '../../src/stores/profile-store';
import { Colors } from '../../src/theme/colors';

export default function AboutLocationScreen() {
  const router = useRouter();
  const { profile, saveAboutLocation, isLoading, error, clearError } = useProfileStore();

  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.locationCity || '');
  const [region, setRegion] = useState(profile?.locationRegion || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.bio) setBio(profile.bio);
      if (profile.locationCity) setCity(profile.locationCity);
      if (profile.locationRegion) setRegion(profile.locationRegion);
    }
  }, [profile]);

  const handleComplete = async () => {
    setValidationError(null);
    clearError();

    const trimmedBio = bio.trim();
    if (trimmedBio.length < 10) {
      setValidationError('Please write a short bio (at least 10 characters).');
      return;
    }

    const trimmedCity = city.trim();
    if (trimmedCity.length < 2) {
      setValidationError('Please enter your city.');
      return;
    }

    const success = await saveAboutLocation({
      bio: trimmedBio,
      locationCity: trimmedCity,
      locationRegion: region.trim() || undefined,
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
        >
          <View style={styles.header}>
            <Text style={styles.title}>About & Location</Text>
            <Text style={styles.subtitle}>
              Tell potential matches a little about yourself and where you are located.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Bio Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Bio</Text>
              <TextInput
                style={styles.bioInput}
                placeholder="Write a few words about what you love, your passions, or what you're looking for..."
                placeholderTextColor={Colors.textMuted}
                value={bio}
                onChangeText={(text) => {
                  setBio(text);
                  if (validationError) setValidationError(null);
                }}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.counterText}>{bio.length}/500</Text>
            </View>

            {/* City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chennai, Coimbatore, Madurai"
                placeholderTextColor={Colors.textMuted}
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  if (validationError) setValidationError(null);
                }}
              />
            </View>

            {/* Region / State */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Region / State</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Tamil Nadu"
                placeholderTextColor={Colors.textMuted}
                value={region}
                onChangeText={setRegion}
              />
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
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 24,
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
    gap: 18,
  },
  inputGroup: {
    gap: 8,
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
  bioInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    height: 110,
    padding: 16,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  counterText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right',
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
