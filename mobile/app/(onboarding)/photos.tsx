import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useProfileStore } from '../../src/stores/profile-store';
import { TrueloveHeader } from '../../src/components/TrueloveHeader';
import { StepperHeader } from '../../src/components/StepperHeader';
import { Colors } from '../../src/theme/colors';
import { SafeProfilePhoto } from '../../../shared/src/types';

export default function PhotosScreen() {
  const router = useRouter();
  const {
    profile,
    fetchProfile,
    uploadPhoto,
    deletePhoto,
    setPrimaryPhoto,
    isLoading,
    isUploadingPhoto,
    error,
  } = useProfileStore();

  const [localUploading, setLocalUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const photos = profile?.photos || [];

  const handlePickAndUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera roll permission is required to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setLocalUploading(true);
        const fileSize = asset.fileSize || 1024 * 1024;
        const mimeType = asset.mimeType || 'image/jpeg';
        await uploadPhoto(asset.uri, mimeType, fileSize);
        await fetchProfile();
        setLocalUploading(false);
      }
    } catch (err: any) {
      setLocalUploading(false);
      Alert.alert('Upload Failed', err?.message || 'Unable to upload photo.');
    }
  };

  const primaryPhoto = photos.find((p: SafeProfilePhoto) => p.isPrimary) || photos[0];
  const secondaryPhotos = photos.filter((p: SafeProfilePhoto) => p.id !== primaryPhoto?.id);

  const handleNext = () => {
    if (photos.length === 0) {
      Alert.alert(
        'Photo Required',
        'Please upload at least 1 photo before continuing, or proceed with demo profile.',
        [
          { text: 'Upload', style: 'cancel' },
          { text: 'Proceed', onPress: () => router.push('/(onboarding)/interests') },
        ]
      );
      return;
    }
    router.push('/(onboarding)/interests');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TrueloveHeader showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper Progress Bar: 02 active */}
        <StepperHeader currentStep={2} />

        {/* Big Primary Photo Container */}
        <View style={styles.primaryPhotoCard}>
          {primaryPhoto ? (
            <Image
              source={{
                uri:
                  primaryPhoto.largeUrl ||
                  primaryPhoto.mediumUrl ||
                  primaryPhoto.thumbnailUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
              }}
              style={styles.primaryPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderPrimary}>
              <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.placeholderText}>No photo uploaded yet</Text>
            </View>
          )}

          {/* Floating Change Photo Glass Pill */}
          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={handlePickAndUpload}
            disabled={localUploading || isUploadingPhoto}
            activeOpacity={0.85}
          >
            {localUploading || isUploadingPhoto ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Feather name="camera" size={14} color={Colors.white} />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Hanging Photo Gallery on Wire / Rope */}
        <View style={styles.hangingSection}>
          <View style={styles.wireLine} />

          <View style={styles.hangingCardsRow}>
            {[0, 1, 2].map((slotIndex) => {
              const photo = secondaryPhotos[slotIndex];

              return (
                <View key={slotIndex} style={styles.hangingSlot}>
                  {/* Clothespeg Clip */}
                  <View style={styles.pegClip} />

                  {/* Photo Card */}
                  <View style={styles.secondaryCard}>
                    {photo ? (
                      <>
                        <Image
                          source={{
                            uri:
                              photo.mediumUrl ||
                              photo.thumbnailUrl ||
                              photo.largeUrl ||
                              '',
                          }}
                          style={styles.secondaryImg}
                        />
                        <TouchableOpacity
                          style={styles.deleteBadge}
                          onPress={() => deletePhoto(photo.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close" size={12} color={Colors.white} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.emptySecondary}
                        onPress={handlePickAndUpload}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="image-outline" size={24} color={Colors.borderDashed} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* + Add Coral Pill Button */}
                  {!photo && (
                    <TouchableOpacity
                      style={styles.addPillBtn}
                      onPress={handlePickAndUpload}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={12} color={Colors.white} />
                      <Text style={styles.addPillText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Next Step CTA */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>Next</Text>
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
  },
  primaryPhotoCard: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryPhoto: {
    width: '100%',
    height: '100%',
  },
  placeholderPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  changePhotoText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  hangingSection: {
    marginTop: 28,
    position: 'relative',
    paddingTop: 14,
  },
  wireLine: {
    position: 'absolute',
    top: 6,
    left: -10,
    right: -10,
    height: 2,
    backgroundColor: '#D1D5DB',
  },
  hangingCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  hangingSlot: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  pegClip: {
    width: 8,
    height: 14,
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
    marginBottom: -6,
    zIndex: 10,
  },
  secondaryCard: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryImg: {
    width: '100%',
    height: '100%',
  },
  emptySecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  deleteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8,
  },
  addPillText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  nextButton: {
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
  nextButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
