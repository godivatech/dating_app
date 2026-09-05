import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiClient } from '../services/api-client';
import { ViewableProfileDto, ActionType, ReportTargetType } from '../../../shared/src/types';
import { ReportModal } from './ReportModal';
import { useSafetyStore } from '../stores/safety-store';
import { t } from '../i18n/strings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FullProfileModalProps {
  visible: boolean;
  profileId: string | null;
  onClose: () => void;
  onLike?: () => void;
  onPass?: () => void;
  showActions?: boolean;
}

export const FullProfileModal: React.FC<FullProfileModalProps> = ({
  visible,
  profileId,
  onClose,
  onLike,
  onPass,
  showActions = true,
}) => {
  const [profile, setProfile] = useState<ViewableProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [isReportModalVisible, setIsReportModalVisible] = useState<boolean>(false);

  const blockUser = useSafetyStore((s) => s.blockUser);

  useEffect(() => {
    if (visible && profileId) {
      loadProfile(profileId);
    } else {
      setProfile(null);
      setError(null);
      setActivePhotoIndex(0);
    }
  }, [visible, profileId]);

  const loadProfile = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ViewableProfileDto>(`/profile/view/${id}`);
      setProfile(res.data);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Unable to view profile. It may be private or restricted.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = () => {
    if (!profile) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile.displayName}? You will no longer see each other.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(profile.userId, 'Blocked from full profile view');
            onClose();
          },
        },
      ],
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{profile?.displayName || 'Profile'}</Text>
          <TouchableOpacity
            onPress={() => {
              if (profile) setIsReportModalVisible(true);
            }}
            style={styles.headerButton}
          >
            <Text style={styles.safetyIcon}>🛡️</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#FF4458" />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Text style={styles.errorEmoji}>🔒</Text>
            <Text style={styles.errorTitle}>Profile Unavailable</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onClose}>
              <Text style={styles.retryButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        ) : profile ? (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Photo Carousel */}
              <View style={styles.photoContainer}>
                {profile.photos && profile.photos.length > 0 ? (
                  <>
                    <Image
                      source={{
                        uri:
                          profile.photos[activePhotoIndex]?.mediumUrl ||
                          profile.photos[activePhotoIndex]?.thumbnailUrl ||
                          'https://via.placeholder.com/400x500',
                      }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                    {/* Photo Carousel Indicators */}
                    {profile.photos.length > 1 && (
                      <View style={styles.indicatorContainer}>
                        {profile.photos.map((_, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[
                              styles.indicatorBar,
                              idx === activePhotoIndex && styles.indicatorBarActive,
                            ]}
                            onPress={() => setActivePhotoIndex(idx)}
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.noPhotoBox}>
                    <Text style={styles.noPhotoText}>No Approved Photos</Text>
                  </View>
                )}
              </View>

              {/* Profile Details Container */}
              <View style={styles.detailsContainer}>
                {/* Name & Age */}
                <View style={styles.nameRow}>
                  <Text style={styles.displayName}>
                    {profile.displayName}, {profile.age}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✓</Text>
                  </View>
                </View>

                {/* Location */}
                {(profile.locationCity || profile.locationRegion) && (
                  <Text style={styles.locationText}>
                    📍 {[profile.locationCity, profile.locationRegion].filter(Boolean).join(', ')}
                  </Text>
                )}

                {/* Bio Section */}
                {profile.bio && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('aboutMe')}</Text>
                    <Text style={styles.bioText}>{profile.bio}</Text>
                  </View>
                )}

                {/* The Basics Grid */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('basics')}</Text>
                  <View style={styles.tagsGrid}>
                    {profile.gender && (
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>⚧ {profile.gender}</Text>
                      </View>
                    )}
                    {profile.relationshipIntent && (
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>
                          🎯 {profile.relationshipIntent.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    )}
                    {(profile.locationCity || profile.locationRegion) && (
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText}>
                          📍 {[profile.locationCity, profile.locationRegion, profile.locationCountry]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Interests Section */}
                {profile.interests && profile.interests.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('interests')}</Text>
                    <View style={styles.tagsGrid}>
                      {profile.interests.map((interest) => (
                        <View key={interest.id} style={styles.interestTag}>
                          <Text style={styles.interestTagText}>✨ {interest.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Safety Actions */}
                <View style={styles.safetySection}>
                  <TouchableOpacity style={styles.blockButton} onPress={handleBlock}>
                    <Text style={styles.blockButtonText}>🚫 {t('blockUser')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reportButton}
                    onPress={() => setIsReportModalVisible(true)}
                  >
                    <Text style={styles.reportButtonText}>⚠️ {t('reportUser')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Bottom Action Footer (Like / Pass) */}
            {showActions && (
              <View style={styles.actionFooter}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.passButton]}
                  onPress={() => {
                    if (onPass) onPass();
                    onClose();
                  }}
                >
                  <Text style={styles.passButtonText}>✕</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.likeButton]}
                  onPress={() => {
                    if (onLike) onLike();
                    onClose();
                  }}
                >
                  <Text style={styles.likeButtonText}>♥</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        {/* Safety Report Modal */}
        {profile && (
          <ReportModal
            visible={isReportModalVisible}
            targetUserId={profile.userId}
            targetType={ReportTargetType.USER}
            targetId={profile.userId}
            targetName={profile.displayName}
            onClose={() => setIsReportModalVisible(false)}
            onSuccess={() => {
              setIsReportModalVisible(false);
              onClose();
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: '#242836',
  },
  headerButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 20,
    color: '#E1E4EA',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  safetyIcon: {
    fontSize: 20,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#8E94A5',
    fontSize: 15,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: '#8E94A5',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#242836',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.15,
    backgroundColor: '#1E2330',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  noPhotoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    color: '#8E94A5',
    fontSize: 16,
  },
  indicatorContainer: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 6,
  },
  indicatorBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  indicatorBarActive: {
    backgroundColor: '#FFFFFF',
  },
  detailsContainer: {
    padding: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  locationText: {
    fontSize: 15,
    color: '#8E94A5',
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E1E4EA',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bioText: {
    fontSize: 15,
    color: '#CCD0DC',
    lineHeight: 22,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    backgroundColor: '#1E2330',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A3042',
  },
  tagText: {
    color: '#CCD0DC',
    fontSize: 14,
  },
  interestTag: {
    backgroundColor: 'rgba(255, 68, 88, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 88, 0.3)',
  },
  interestTagText: {
    color: '#FF6B7D',
    fontSize: 14,
    fontWeight: '600',
  },
  safetySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#242836',
    flexDirection: 'row',
    gap: 12,
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1E2330',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3042',
  },
  blockButtonText: {
    color: '#E1E4EA',
    fontWeight: '600',
    fontSize: 13,
  },
  reportButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2A1F24',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A2830',
  },
  reportButtonText: {
    color: '#FF6B7D',
    fontWeight: '600',
    fontSize: 13,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#161922',
    borderTopWidth: 1,
    borderTopColor: '#242836',
    gap: 32,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  passButton: {
    backgroundColor: '#242836',
    borderWidth: 1,
    borderColor: '#3A4054',
  },
  passButtonText: {
    fontSize: 28,
    color: '#8E94A5',
    fontWeight: 'bold',
  },
  likeButton: {
    backgroundColor: '#FF4458',
  },
  likeButtonText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
