import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { useProfileStore } from '../../src/stores/profile-store';
import { Colors } from '../../src/theme/colors';

export default function ReadyScreen() {
  const router = useRouter();
  const { profile } = useProfileStore();

  const primaryPhotoObj =
    profile?.photos?.find((p) => p.isPrimary) ||
    profile?.photos?.[0];

  const photoUrl =
    primaryPhotoObj?.largeUrl ||
    primaryPhotoObj?.mediumUrl ||
    primaryPhotoObj?.thumbnailUrl ||
    null;

  const handleFinish = () => {
    router.replace('/discovery');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.celebrationSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={36} color={Colors.white} />
          </View>
          <Text style={styles.title}>You are All Set!</Text>
          <Text style={styles.subtitle}>
            Your Truelove profile is ready. Start discovering matches near you.
          </Text>
        </View>

        {/* Profile Card Preview */}
        <View style={styles.cardPreview}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.cardPhoto}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.cardPhoto,
                {
                  backgroundColor: Colors.backgroundSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons name="person" size={72} color={Colors.textMuted} />
            </View>
          )}

          <View style={styles.cardOverlay}>
            <Text style={styles.cardName}>
              {profile?.displayName || 'Your Name'}
              {profile?.age ? `, ${profile.age}` : ''}
            </Text>
            <Text style={styles.cardLocation}>
              {profile?.locationCity || 'Your City'}
            </Text>
          </View>
        </View>

        {/* Start Exploring CTA */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Finding Matches</Text>
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
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  celebrationSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  cardPreview: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  cardLocation: {
    fontSize: 13,
    color: '#D1D5DB',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: Colors.primary,
    height: 54,
    borderRadius: 27,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  startButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
