import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useDiscoveryStore } from '../src/stores/discovery-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useBillingStore } from '../src/stores/billing-store';
import { PaywallModal } from '../src/components/PaywallModal';
import { ProfileDetailModal } from '../src/components/ProfileDetailModal';
import { SendNoteModal } from '../src/components/SendNoteModal';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { ActionType } from '../../shared/src/types';
import { Colors } from '../src/theme/colors';
import { useScreenCapturePrevention } from '../src/hooks/useScreenCapturePrevention';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DiscoveryScreen() {
  const router = useRouter();
  const { profile: myProfile } = useProfileStore();
  const { openPaywall } = useBillingStore();
  const {
    candidates,
    currentIndex,
    currentPhotoIndex,
    isLoading,
    isActionLoading,
    eligibility,
    error,
    fetchDiscoveryFeed,
    nextPhoto,
    prevPhoto,
    recordAction,
    undoLastPass,
  } = useDiscoveryStore();

  const [selectedProfileForModal, setSelectedProfileForModal] = useState<any | null>(null);
  const [likeHeartAnim] = useState(new Animated.Value(0));
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  // Protect member photos against unauthorized screenshots and recordings during discovery
  useScreenCapturePrevention(true);

  useEffect(() => {
    fetchDiscoveryFeed();
  }, [fetchDiscoveryFeed]);

  const candidate = candidates[currentIndex];

  const triggerHeartAnimation = () => {
    setShowHeartOverlay(true);
    likeHeartAnim.setValue(0);
    Animated.sequence([
      Animated.spring(likeHeartAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(likeHeartAnim, {
        toValue: 0,
        duration: 300,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowHeartOverlay(false));
  };

  const handleAction = async (actionType: ActionType) => {
    if (!candidate || isActionLoading) return;

    if (actionType === ActionType.LIKE) {
      triggerHeartAnimation();
    }

    const result = await recordAction(candidate.profileId, actionType);
    if (!result) {
      const storeError = useDiscoveryStore.getState().error;
      if (
        storeError &&
        (storeError.toLowerCase().includes('quota') || storeError.toLowerCase().includes('limit'))
      ) {
        openPaywall('DAILY_LIKES');
      }
    }
  };

  const handleRewind = async () => {
    const success = await undoLastPass();
    if (!success) {
      const storeError = useDiscoveryStore.getState().error;
      if (
        storeError &&
        (storeError.toLowerCase().includes('rewind') || storeError.toLowerCase().includes('entitlement'))
      ) {
        openPaywall('REWIND_PASS');
      }
    }
  };

  const candidatePhotoObj = candidate?.photos?.[currentPhotoIndex] || candidate?.photos?.[0];
  const currentPhotoUrl =
    candidatePhotoObj?.largeUrl ||
    candidatePhotoObj?.mediumUrl ||
    candidatePhotoObj?.thumbnailUrl ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';

  const myAvatarUrl =
    myProfile?.photos?.find((p) => p.isPrimary)?.mediumUrl ||
    myProfile?.photos?.[0]?.mediumUrl ||
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        {/* User Avatar with Green Active Dot */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => router.push('/profile' as any)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: myAvatarUrl }} style={styles.myAvatar} />
          <View style={styles.onlineDot} />
        </TouchableOpacity>

        {/* Right Header Actions (Favorites & Filter) */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerSquareBtn}
            onPress={() => router.push('/matches' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={18} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerSquareBtn}
            onPress={() => router.push('/(onboarding)/preferences' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Partners"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading && candidates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptySubText}>Finding partners near you...</Text>
        </View>
      ) : eligibility && !eligibility.eligible ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="person" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Complete Your Profile</Text>
          <Text style={styles.emptySubText}>
            {eligibility.message || 'Complete your profile setup to start discovering matches.'}
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.refreshBtnText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cloud-offline-outline" size={32} color={Colors.error} />
          </View>
          <Text style={styles.emptyTitle}>Connection Issue</Text>
          <Text style={styles.emptySubText}>{error}</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchDiscoveryFeed(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.refreshBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !candidate ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="sparkles" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySubText}>
            Check back soon for more discoverable profiles near you.
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchDiscoveryFeed(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.refreshBtnText}>Refresh Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardContainer}>
          {/* Swiping Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              setSelectedProfileForModal({
                id: candidate.profileId,
                name: candidate.displayName,
                age: candidate.age,
                city: candidate.locationCity || 'Stuttgart, Germany',
                bio: candidate.bio || undefined,
                photos: candidate.photos,
                interests: candidate.interests?.map((i) => i.name) || [],
                distanceKm: 2.5,
              })
            }
            activeOpacity={0.95}
          >
            {/* Card Main Photo */}
            <Image
              source={{ uri: currentPhotoUrl }}
              style={styles.cardPhoto}
              resizeMode="cover"
            />

            {/* Photo Step Indicators */}
            {candidate.photos.length > 1 && (
              <View style={styles.photoIndicators}>
                {candidate.photos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.indicatorBar,
                      i === currentPhotoIndex && styles.indicatorBarActive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Left / Right Tap zones for multiple photos */}
            <TouchableOpacity
              style={styles.tapZoneLeft}
              onPress={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
            />
            <TouchableOpacity
              style={styles.tapZoneRight}
              onPress={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
            />

            {/* Top Right Floating Chip: 2.5Km Away */}
            <View style={styles.distancePill}>
              <Text style={styles.distancePillText}>2.5Km Away</Text>
            </View>

            {/* Bottom Card Info Overlay */}
            <View style={styles.cardOverlay}>
              <View style={styles.infoRow}>
                {/* 75% Match Circle */}
                <View style={styles.matchCircle}>
                  <Text style={styles.matchScoreText}>75%</Text>
                </View>

                {/* Name & Location */}
                <View style={styles.nameBlock}>
                  <Text style={styles.candidateName}>
                    {candidate.displayName}
                    {candidate.age ? `, ${candidate.age}` : ''}
                  </Text>
                  <Text style={styles.candidateLocation}>
                    {candidate.locationCity || 'Stuttgart, Germany'}
                  </Text>
                </View>

                {/* Social Badges on Bottom Right */}
                <View style={styles.socialBadges}>
                  <View style={styles.socialIconBox}>
                    <Ionicons name="logo-twitter" size={14} color={Colors.white} />
                  </View>
                  <View style={styles.socialIconBox}>
                    <Ionicons name="logo-instagram" size={14} color={Colors.white} />
                  </View>
                </View>
              </View>
            </View>

            {/* Heart Animation Overlay */}
            {showHeartOverlay && (
              <Animated.View
                style={[
                  styles.heartAnimContainer,
                  {
                    transform: [
                      {
                        scale: likeHeartAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1.3],
                        }),
                      },
                    ],
                    opacity: likeHeartAnim,
                  },
                ]}
              >
                <View style={styles.heartAnimCircle}>
                  <Ionicons name="heart" size={54} color={Colors.white} />
                </View>
              </Animated.View>
            )}
          </TouchableOpacity>

          {/* Action Row Below Card */}
          <View style={styles.actionButtonsRow}>
            {/* Rewind */}
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={handleRewind}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Pass (✕) */}
            <TouchableOpacity
              style={styles.squareActionBtn}
              onPress={() => handleAction(ActionType.PASS)}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Like (Heart - Elevated Black Button) */}
            <TouchableOpacity
              style={styles.heroLikeBtn}
              onPress={() => handleAction(ActionType.LIKE)}
              disabled={isActionLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="heart" size={32} color={Colors.white} />
            </TouchableOpacity>

            {/* Direct Note (💌) */}
            <TouchableOpacity
              style={styles.squareActionBtn}
              onPress={() => setNoteModalVisible(true)}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>

            {/* Bookmark / Star (★) */}
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => openPaywall('SUPER_LIKE' as any)}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Bottom Tab Bar */}
      <BottomTabBar activeTab="home" />

      {/* Profile Detail Bottom Sheet Modal */}
      <ProfileDetailModal
        visible={!!selectedProfileForModal}
        profile={selectedProfileForModal}
        onClose={() => setSelectedProfileForModal(null)}
        onLike={() => handleAction(ActionType.LIKE)}
        onPass={() => handleAction(ActionType.PASS)}
      />

      {/* Direct Note Modal */}
      <SendNoteModal
        visible={noteModalVisible}
        candidate={candidate}
        onClose={() => setNoteModalVisible(false)}
        onSent={() => {
          triggerHeartAnimation();
        }}
      />

      {/* Paywall Modal */}
      <PaywallModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  myAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerSquareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 24,
    height: 44,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  card: {
    width: '100%',
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.58,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.dark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoIndicators: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  indicatorBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  indicatorBarActive: {
    backgroundColor: Colors.white,
  },
  tapZoneLeft: {
    position: 'absolute',
    top: 0,
    bottom: 80,
    left: 0,
    width: '40%',
    zIndex: 5,
  },
  tapZoneRight: {
    position: 'absolute',
    top: 0,
    bottom: 80,
    right: 0,
    width: '40%',
    zIndex: 5,
  },
  distancePill: {
    position: 'absolute',
    top: 28,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  distancePillText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  matchScoreText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
  },
  candidateName: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  candidateLocation: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: 2,
  },
  socialBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  socialIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartAnimContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  heartAnimCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
  },
  secondaryActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  heroLikeBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
