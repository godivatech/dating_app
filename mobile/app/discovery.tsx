import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useDiscoveryStore } from '../src/stores/discovery-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useBillingStore } from '../src/stores/billing-store';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { ProfileDetailModal } from '../src/components/ProfileDetailModal';
import { SendNoteModal } from '../src/components/SendNoteModal';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { ProfileCompletionCard } from '../src/components/ProfileCompletionCard';
import { ActionType } from '../../shared/src/types';
import { Colors } from '../src/theme/colors';
import { useScreenCapturePrevention } from '../src/hooks/useScreenCapturePrevention';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DiscoveryScreen() {
  const router = useRouter();
  const { profile: myProfile, completion, fetchProfile } = useProfileStore();
  const { openPaywall } = useBillingStore();
  const {
    candidates,
    currentIndex,
    isLoading,
    isActionLoading,
    eligibility,
    error,
    fetchDiscoveryFeed,
    recordAction,
    undoLastPass,
  } = useDiscoveryStore();

  const params = useLocalSearchParams<{ q?: string; interest?: string }>();
  const [searchQuery, setSearchQuery] = useState(params.q || params.interest || '');
  const [searchIndex, setSearchIndex] = useState(0);

  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount);

  const [selectedProfileForModal, setSelectedProfileForModal] = useState<any | null>(null);
  const [likeHeartAnim] = useState(new Animated.Value(0));
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  // Tactile swipe exit & feedback pill animation
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const [toastPill, setToastPill] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });
  const toastPillAnim = useRef(new Animated.Value(0)).current;
  const toastPillTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPill = (text: string) => {
    if (toastPillTimeout.current) clearTimeout(toastPillTimeout.current);
    setToastPill({ visible: true, text });
    Animated.spring(toastPillAnim, {
      toValue: 1,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();

    toastPillTimeout.current = setTimeout(() => {
      Animated.timing(toastPillAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setToastPill({ visible: false, text: '' }));
    }, 2200);
  };

  // Sync params query if navigation passes search or interest
  useEffect(() => {
    if (params.q) {
      setSearchQuery(params.q);
    } else if (params.interest) {
      setSearchQuery(params.interest);
    }
  }, [params.q, params.interest]);

  // Reset filtered index when search query changes
  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery]);

  // Protect member photos against unauthorized screenshots and recordings during discovery
  useScreenCapturePrevention(true);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchDiscoveryFeed();
      fetchUnreadCount();
    }, [fetchProfile, fetchDiscoveryFeed, fetchUnreadCount]),
  );

  // Filter candidates in real-time by Name, City, Region, Bio, or Interests
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = c.displayName?.toLowerCase() || '';
      const city = c.locationCity?.toLowerCase() || '';
      const region = c.locationRegion?.toLowerCase() || '';
      const bio = c.bio?.toLowerCase() || '';
      const interests =
        c.interests?.map((i) => i.name?.toLowerCase() || (i as any)?.interest?.name?.toLowerCase() || '').join(' ') || '';
      const intent = c.relationshipIntent?.toLowerCase() || '';
      return (
        name.includes(q) ||
        city.includes(q) ||
        region.includes(q) ||
        bio.includes(q) ||
        interests.includes(q) ||
        intent.includes(q)
      );
    });
  }, [candidates, searchQuery]);

  const isFiltering = searchQuery.trim().length > 0;
  const activeCandidates = isFiltering ? filteredCandidates : candidates;
  const activeIndex = isFiltering ? searchIndex : currentIndex;
  const candidate = activeCandidates[activeIndex];

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Reset photo index when candidate changes
  useEffect(() => {
    setActivePhotoIndex(0);
  }, [candidate?.profileId]);

  const handleNextPhoto = () => {
    if (candidate && activePhotoIndex < (candidate.photos?.length || 1) - 1) {
      setActivePhotoIndex((prev) => prev + 1);
    }
  };

  const handlePrevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhotoIndex((prev) => prev - 1);
    }
  };

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

    const currentCandidate = candidate;
    const targetX = actionType === ActionType.LIKE ? SCREEN_WIDTH * 1.25 : -SCREEN_WIDTH * 1.25;

    // 1. Instant tactile vibration & confirmation feedback
    try {
      if (actionType === ActionType.LIKE) {
        Vibration.vibrate(35);
        showPill(`❤️ Liked ${currentCandidate.displayName}!`);
      } else {
        Vibration.vibrate(20);
        showPill(`Passed on ${currentCandidate.displayName}`);
      }
    } catch {}

    // 2. Smooth card exit animation
    Animated.parallel([
      Animated.timing(cardTranslateX, {
        toValue: targetX,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // 3. Record action with backend and advance state
      const result = await recordAction(currentCandidate.profileId, actionType);

      if (isFiltering) {
        if (searchIndex < filteredCandidates.length - 1) {
          setSearchIndex((prev) => prev + 1);
        } else {
          setSearchIndex(filteredCandidates.length);
        }
      }

      // 4. Instant reset of card transform for the next incoming candidate
      cardTranslateX.setValue(0);
      cardOpacity.setValue(1);

      if (!result) {
        const storeError = useDiscoveryStore.getState().error;
        if (
          storeError &&
          (storeError.toLowerCase().includes('quota') || storeError.toLowerCase().includes('limit'))
        ) {
          openPaywall('DAILY_LIKES');
        }
      }
    });
  };

  const handleRewind = async () => {
    if (isFiltering && searchIndex > 0) {
      setSearchIndex((prev) => prev - 1);
      return;
    }
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

  const candidatePhotoObj = candidate?.photos?.[activePhotoIndex] || candidate?.photos?.[0];
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
            {unreadCount > 0 && <View style={styles.unreadBadgeDot} />}
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
            placeholder="Search partners by name, city, interest..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {isFiltering && (
          <View style={styles.searchFilterBadgeRow}>
            <View style={styles.searchFilterBadge}>
              <Ionicons name="filter" size={12} color={Colors.primary} />
              <Text style={styles.searchFilterBadgeText} numberOfLines={1}>
                {filteredCandidates.length > 0
                  ? `${filteredCandidates.length} profile${filteredCandidates.length === 1 ? '' : 's'} matching "${searchQuery}"`
                  : `No profiles matching "${searchQuery}"`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {isLoading && candidates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptySubText}>Finding partners near you...</Text>
        </View>
      ) : eligibility && !eligibility.eligible ? (
        <View style={{ flex: 1, paddingBottom: 80 }}>
          <ProfileCompletionCard
            profile={myProfile}
            completion={
              completion || {
                completionScore: eligibility.completionScore || 0,
                status: 'IN_PROGRESS' as any,
                missingFields: eligibility.missingFields || [],
                isReady: false,
              }
            }
            onRefresh={() => {
              fetchProfile();
              fetchDiscoveryFeed(true);
            }}
          />
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
      ) : isFiltering && !candidate ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Matching Partners</Text>
          <Text style={styles.emptySubText}>
            We couldn't find anyone matching "{searchQuery}". Try searching by another name, city, or interest.
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => setSearchQuery('')}
            activeOpacity={0.85}
          >
            <Text style={styles.refreshBtnText}>Clear Search</Text>
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
          <View style={styles.emptyActionRow}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => fetchDiscoveryFeed(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.refreshBtnText}>Refresh Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adjustPrefBtn}
              onPress={() => router.push('/(onboarding)/preferences' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="options-outline" size={16} color={Colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.adjustPrefBtnText}>Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cardContainer}>
          {/* Swiping Card with smooth slide & stamps */}
          <Animated.View
            style={[
              styles.animatedCardWrapper,
              {
                transform: [
                  { translateX: cardTranslateX },
                  {
                    rotate: cardTranslateX.interpolate({
                      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                      outputRange: ['-14deg', '0deg', '14deg'],
                    }),
                  },
                ],
                opacity: cardOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                setSelectedProfileForModal({
                  id: candidate.profileId,
                  name: candidate.displayName,
                  age: candidate.age,
                  city: candidate.locationCity
                    ? `${candidate.locationCity}${candidate.locationRegion ? `, ${candidate.locationRegion}` : ''}`
                    : 'Nearby',
                  bio: candidate.bio || undefined,
                  photos: candidate.photos,
                  interests: candidate.interests?.map((i) => i.name) || [],
                  distanceKm: candidate.distanceKm,
                  distanceDisplay: candidate.distanceDisplay,
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
                        i === activePhotoIndex && styles.indicatorBarActive,
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
                  handlePrevPhoto();
                }}
              />
              <TouchableOpacity
                style={styles.tapZoneRight}
                onPress={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
              />

              {/* LIKE Stamp Overlay */}
              <Animated.View
                style={[
                  styles.likeStamp,
                  {
                    opacity: cardTranslateX.interpolate({
                      inputRange: [0, 40, 120],
                      outputRange: [0, 0.6, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [{ rotate: '-15deg' }],
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.likeStampText}>LIKE</Text>
              </Animated.View>

              {/* NOPE Stamp Overlay */}
              <Animated.View
                style={[
                  styles.nopeStamp,
                  {
                    opacity: cardTranslateX.interpolate({
                      inputRange: [-120, -40, 0],
                      outputRange: [1, 0.6, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [{ rotate: '15deg' }],
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.nopeStampText}>NOPE</Text>
              </Animated.View>

              {/* Top Right Floating Chip: Dynamic Relative Distance */}
              <View style={styles.distancePill}>
                <Ionicons
                  name="location-sharp"
                  size={12}
                  color={Colors.white}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.distancePillText}>
                  {candidate.distanceDisplay ||
                    (candidate.locationCity
                      ? candidate.locationCity
                      : 'Nearby')}
                </Text>
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
                      {candidate.locationCity
                        ? `${candidate.locationCity}${candidate.locationRegion ? `, ${candidate.locationRegion}` : ''}`
                        : candidate.distanceDisplay || 'Nearby'}
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
          </Animated.View>

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
          showPill(`💌 Note delivered to ${candidate.displayName}!`);
          if (isFiltering) {
            setSearchIndex((prev) => prev + 1);
          }
        }}
      />

      {/* Floating Confirmation Pill Toast */}
      {toastPill.visible && (
        <Animated.View
          style={[
            styles.floatingToastPill,
            {
              opacity: toastPillAnim,
              transform: [
                {
                  translateY: toastPillAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.floatingToastPillText}>{toastPill.text}</Text>
        </Animated.View>
      )}

      {/* Discovery End */}
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
  clearSearchIconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  searchFilterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  searchFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexShrink: 1,
  },
  searchFilterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    flexShrink: 1,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginLeft: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  refreshBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  adjustPrefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  adjustPrefBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  animatedCardWrapper: {
    width: '100%',
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.58,
  },
  likeStamp: {
    position: 'absolute',
    top: 36,
    left: 24,
    borderWidth: 3,
    borderColor: '#4CD964',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  likeStampText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#4CD964',
    letterSpacing: 2,
  },
  nopeStamp: {
    position: 'absolute',
    top: 36,
    right: 24,
    borderWidth: 3,
    borderColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 99,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  nopeStampText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FF3B30',
    letterSpacing: 2,
  },
  floatingToastPill: {
    position: 'absolute',
    bottom: 95,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 18, 30, 0.94)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 110, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  floatingToastPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4B6E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
