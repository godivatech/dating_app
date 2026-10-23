import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  Vibration,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useDiscoveryStore } from '../src/stores/discovery-store';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { useBillingStore } from '../src/stores/billing-store';
import { toast } from '../src/stores/toast-store';
import { ButterflyLogo } from '../src/components/ButterflyLogo';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { ProfileCompletionCard } from '../src/components/ProfileCompletionCard';
import { ProfileDetailModal, ProfileDetailData } from '../src/components/ProfileDetailModal';
import { SendNoteModal } from '../src/components/SendNoteModal';
import { WelcomeScreen } from '../src/components/WelcomeScreen';
import { BrandedSplashScreen } from '../src/components/BrandedSplashScreen';
import { ActionType, DiscoveryCandidate, Gender, RelationshipIntent, InterestStatus, PhotoStatus } from '../../shared/src/types';
import { Colors } from '../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const nowIso = new Date().toISOString();

// High-quality local fallback candidates to guarantee a rich interactive feed
const FALLBACK_CANDIDATES: DiscoveryCandidate[] = [
  {
    profileId: 'sample-1',
    userId: 'user-sample-1',
    displayName: 'Priya',
    age: 23,
    gender: Gender.WOMAN,
    bio: 'Classical dancer & architect. Looking for genuine conversations over hot filter coffee ☕✨',
    languages: ['Tamil', 'English'],
    locationCity: 'Chennai',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'India',
    relationshipIntent: RelationshipIntent.LONG_TERM,
    distanceKm: 2.4,
    distanceDisplay: '2 km away',
    isBoosted: true,
    algorithmVersion: 'sample-v1',
    interests: [
      { id: '1', name: 'Classical Dance', category: 'Arts', status: InterestStatus.ACTIVE },
      { id: '2', name: 'Filter Coffee', category: 'Food & Drink', status: InterestStatus.ACTIVE },
      { id: '3', name: 'Architecture', category: 'Lifestyle', status: InterestStatus.ACTIVE },
    ],
    photos: [
      {
        id: 'p1',
        profileId: 'sample-1',
        isPrimary: true,
        position: 0,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'p1_2',
        profileId: 'sample-1',
        isPrimary: false,
        position: 1,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  },
  {
    profileId: 'sample-2',
    userId: 'user-sample-2',
    displayName: 'Kavitha',
    age: 24,
    gender: Gender.WOMAN,
    bio: 'Software engineer by weekday, foodie by weekend. Always hunting for the city’s best biryani 🍛',
    languages: ['Tamil', 'English'],
    locationCity: 'Coimbatore',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'India',
    relationshipIntent: RelationshipIntent.LONG_TERM,
    distanceKm: 5.1,
    distanceDisplay: '5 km away',
    isBoosted: false,
    algorithmVersion: 'sample-v1',
    interests: [
      { id: '4', name: 'Coding', category: 'Tech', status: InterestStatus.ACTIVE },
      { id: '5', name: 'Foodie', category: 'Food & Drink', status: InterestStatus.ACTIVE },
      { id: '6', name: 'Indie Music', category: 'Music', status: InterestStatus.ACTIVE },
    ],
    photos: [
      {
        id: 'p2',
        profileId: 'sample-2',
        isPrimary: true,
        position: 0,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  },
  {
    profileId: 'sample-3',
    userId: 'user-sample-3',
    displayName: 'Ananya',
    age: 22,
    gender: Gender.WOMAN,
    bio: 'Visual artist & film enthusiast. Let’s talk about photography, books, and favourite road trips 🎨🎸',
    languages: ['Tamil', 'English'],
    locationCity: 'Madurai',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'India',
    relationshipIntent: RelationshipIntent.CASUAL,
    distanceKm: 8.3,
    distanceDisplay: '8 km away',
    isBoosted: false,
    algorithmVersion: 'sample-v1',
    interests: [
      { id: '7', name: 'Photography', category: 'Arts', status: InterestStatus.ACTIVE },
      { id: '8', name: 'Road Trips', category: 'Travel', status: InterestStatus.ACTIVE },
      { id: '9', name: 'Reading', category: 'Lifestyle', status: InterestStatus.ACTIVE },
    ],
    photos: [
      {
        id: 'p3',
        profileId: 'sample-3',
        isPrimary: true,
        position: 0,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  },
  {
    profileId: 'sample-4',
    userId: 'user-sample-4',
    displayName: 'Deepika',
    age: 25,
    gender: Gender.WOMAN,
    bio: 'Yoga lover & content creator. Believer in good vibes, kindness, and spontaneous beach sunsets 🌅',
    languages: ['Tamil', 'English'],
    locationCity: 'Chennai',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'India',
    relationshipIntent: RelationshipIntent.LONG_TERM,
    distanceKm: 12.0,
    distanceDisplay: '12 km away',
    isBoosted: true,
    algorithmVersion: 'sample-v1',
    interests: [
      { id: '10', name: 'Yoga', category: 'Fitness', status: InterestStatus.ACTIVE },
      { id: '11', name: 'Sunsets', category: 'Nature', status: InterestStatus.ACTIVE },
      { id: '12', name: 'Podcasts', category: 'Media', status: InterestStatus.ACTIVE },
    ],
    photos: [
      {
        id: 'p4',
        profileId: 'sample-4',
        isPrimary: true,
        position: 0,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  },
  {
    profileId: 'sample-5',
    userId: 'user-sample-5',
    displayName: 'Sneha',
    age: 23,
    gender: Gender.WOMAN,
    bio: 'Golden retriever mom 🐶. Love weekend hill treks, chai, and acoustic playlist recommendations!',
    languages: ['Tamil', 'English'],
    locationCity: 'Salem',
    locationRegion: 'Tamil Nadu',
    locationCountry: 'India',
    relationshipIntent: RelationshipIntent.LONG_TERM,
    distanceKm: 16.5,
    distanceDisplay: '16 km away',
    isBoosted: false,
    algorithmVersion: 'sample-v1',
    interests: [
      { id: '13', name: 'Dogs', category: 'Pets', status: InterestStatus.ACTIVE },
      { id: '14', name: 'Trekking', category: 'Outdoor', status: InterestStatus.ACTIVE },
      { id: '15', name: 'Acoustic', category: 'Music', status: InterestStatus.ACTIVE },
    ],
    photos: [
      {
        id: 'p5',
        profileId: 'sample-5',
        isPrimary: true,
        position: 0,
        status: PhotoStatus.APPROVED,
        largeUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&auto=format&fit=crop&q=80',
        mediumUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
        width: 900,
        height: 1200,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
  },
];

// Global module-level flag so splash only runs once on initial cold boot
let globalHasShownSplash = false;

export default function IndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status: authStatus, user } = useAuthStore();
  const { profile, completion, fetchProfile, isLoading: isProfileLoading } = useProfileStore();
  const { candidates, fetchDiscoveryFeed, recordAction, isLoading: isDiscoveryLoading } = useDiscoveryStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const { fetchBillingStatus, openPaywall } = useBillingStore();

  const [selectedProfileForModal, setSelectedProfileForModal] = useState<ProfileDetailData | null>(null);
  const [noteCandidate, setNoteCandidate] = useState<DiscoveryCandidate | null>(null);
  const [dismissedProfileIds, setDismissedProfileIds] = useState<Set<string>>(new Set());
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  // Toast confirmation pill
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

  // Cold launch splash logic
  const [minSplashElapsed, setMinSplashElapsed] = useState(globalHasShownSplash);
  const [isSplashDone, setIsSplashDone] = useState(globalHasShownSplash);

  useEffect(() => {
    if (globalHasShownSplash) return;
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (globalHasShownSplash) {
      if (!isSplashDone) setIsSplashDone(true);
      return;
    }
    if (minSplashElapsed && authStatus !== 'IDLE' && authStatus !== 'CHECKING_SESSION') {
      globalHasShownSplash = true;
      setIsSplashDone(true);
    }
  }, [minSplashElapsed, authStatus, isSplashDone]);

  useFocusEffect(
    useCallback(() => {
      if (authStatus === 'AUTHENTICATED') {
        fetchProfile();
        fetchUnreadCount();
        fetchBillingStatus();
        fetchDiscoveryFeed();
      }
    }, [authStatus, fetchProfile, fetchUnreadCount, fetchBillingStatus, fetchDiscoveryFeed]),
  );

  const onPullRefresh = async () => {
    setIsPullRefreshing(true);
    try {
      setDismissedProfileIds(new Set());
      await Promise.all([fetchProfile(), fetchDiscoveryFeed(true), fetchUnreadCount()]);
    } catch (_err) {
      // ignore
    } finally {
      setIsPullRefreshing(false);
    }
  };

  // Direct Like Action right from the Home Feed card
  const handleFeedLike = async (candidate: DiscoveryCandidate) => {
    const personName = candidate.displayName.split(' ')[0] || candidate.displayName;
    Vibration.vibrate(35);
    showPill(`❤️ Liked ${personName}!`);

    // Optimistically dismiss from vertical feed
    setDismissedProfileIds((prev) => new Set([...prev, candidate.profileId]));

    if (candidate.profileId.startsWith('sample-')) {
      // For sample candidates, simulate immediate match for Priya
      if (candidate.profileId === 'sample-1') {
        setTimeout(() => {
          toast.match(
            "🎉 It's a Match!",
            `You and ${personName} liked each other! Start chatting now.`,
            '/conversations',
          );
        }, 600);
      }
      return;
    }

    try {
      const result = await recordAction(candidate.profileId, ActionType.LIKE);
      if (result?.matched) {
        toast.match(
          "🎉 It's a Match!",
          `You and ${personName} liked each other! Start chatting now.`,
          '/conversations',
        );
      } else if (!result) {
        const storeError = useDiscoveryStore.getState().error;
        if (
          storeError &&
          (storeError.toLowerCase().includes('quota') || storeError.toLowerCase().includes('limit'))
        ) {
          openPaywall('DAILY_LIKES');
        }
      }
    } catch (_err) {
      // non-blocking
    }
  };

  // Direct Pass Action right from the Home Feed card
  const handleFeedPass = async (candidate: DiscoveryCandidate) => {
    const personName = candidate.displayName.split(' ')[0] || candidate.displayName;
    Vibration.vibrate(20);
    showPill(`Passed on ${personName}`);

    // Dismiss from vertical feed
    setDismissedProfileIds((prev) => new Set([...prev, candidate.profileId]));

    if (candidate.profileId.startsWith('sample-')) {
      return;
    }

    try {
      await recordAction(candidate.profileId, ActionType.PASS);
    } catch (_err) {
      // non-blocking
    }
  };

  // Direct Note Button from Home Feed card
  const handleFeedNote = (candidate: DiscoveryCandidate) => {
    setNoteCandidate(candidate);
  };

  // Open Full Profile Detail Modal
  const handleOpenDetails = (candidate: DiscoveryCandidate) => {
    setSelectedProfileForModal({
      id: candidate.profileId,
      name: candidate.displayName,
      age: candidate.age,
      city: candidate.locationCity
        ? `${candidate.locationCity}${candidate.locationRegion ? `, ${candidate.locationRegion}` : ''}`
        : 'Tamil Nadu, India',
      bio: candidate.bio || undefined,
      photos: candidate.photos?.map((p: any) => ({
        url: p.largeUrl || p.mediumUrl || p.thumbnailUrl || '',
        id: p.id,
      })),
      primaryPhotoUrl:
        candidate.photos?.find((p) => p.isPrimary)?.largeUrl ||
        candidate.photos?.[0]?.largeUrl ||
        candidate.photos?.[0]?.mediumUrl ||
        '',
      interests: candidate.interests?.map((i: any) => (typeof i === 'string' ? i : i.name)) || [],
      distanceKm: candidate.distanceKm,
      distanceDisplay: candidate.distanceDisplay,
    });
  };

  // Unauthenticated Welcome
  if (!isSplashDone) {
    return (
      <BrandedSplashScreen
        locationCity={profile?.locationCity}
        locationRegion={profile?.locationRegion}
      />
    );
  }

  if (authStatus === 'UNAUTHENTICATED' || !user) {
    return (
      <WelcomeScreen
        onGetStarted={() => router.push('/(auth)/login' as any)}
        onSignIn={() => router.push('/(auth)/login' as any)}
      />
    );
  }

  const myAvatarUrl =
    profile?.photos?.find((p) => p.isPrimary)?.mediumUrl ||
    profile?.photos?.[0]?.mediumUrl ||
    profile?.photos?.[0]?.thumbnailUrl ||
    null;

  // Build the pool of candidates for the vertical feed
  const candidatePool: DiscoveryCandidate[] =
    candidates.length > 0 ? candidates : FALLBACK_CANDIDATES;

  // Filter out profiles already liked/passed in this session
  const activeFeedProfiles = candidatePool.filter(
    (c) => !dismissedProfileIds.has(c.profileId),
  );

  return (
    <SafeAreaView style={styles.homeContainer}>
      {/* Top Header */}
      <View style={styles.homeHeader}>
        {/* Left: User Avatar with Green Active Dot */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={() => router.push('/profile' as any)}
          activeOpacity={0.8}
        >
          {myAvatarUrl ? (
            <Image
              source={{ uri: myAvatarUrl }}
              style={styles.homeAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.homeAvatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={22} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.onlineDot} />
        </TouchableOpacity>

        {/* Center: Brand Identity */}
        <View style={styles.headerBrandCenter}>
          <ButterflyLogo size={20} />
          <Text style={styles.headerBrandTitle}>Genzdate</Text>
        </View>

        {/* Right: Search & Notification Icons */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerSquareBtn}
            onPress={() => router.push('/explore' as any)}
            activeOpacity={0.7}
          >
            <Feather name="search" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerSquareBtn}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWithBadge}>
              <Feather name="bell" size={18} color={Colors.textPrimary} />
              {unreadCount > 0 && <View style={styles.bellBadgeDot} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Vertical Scroll Feed */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={onPullRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Location & Title */}
        <View style={styles.headlineSection}>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color={Colors.primary} />
            <Text style={styles.locationText}>
              {profile?.locationCity
                ? `${profile.locationCity}, ${profile.locationRegion || 'Tamil Nadu'}`
                : 'Tamil Nadu, India'}
            </Text>
          </View>
          <Text style={styles.mainTitle}>Find the one for you</Text>
        </View>

        {/* Profile Completion Card (if incomplete) */}
        {authStatus === 'AUTHENTICATED' && profile && (
          <View style={styles.completionCardWrap}>
            <ProfileCompletionCard
              profile={profile}
              completion={completion}
              compact={true}
            />
          </View>
        )}

        {/* Vertical Profiles Feed Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Near You</Text>
            <View style={styles.liveCountBadge}>
              <Text style={styles.liveCountText}>{activeFeedProfiles.length} active</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/discovery' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>Swipe Deck →</Text>
          </TouchableOpacity>
        </View>

        {/* Vertical Feed Cards List */}
        {activeFeedProfiles.length > 0 ? (
          activeFeedProfiles.map((candidate) => (
            <VerticalFeedCard
              key={candidate.profileId}
              candidate={candidate}
              onLike={() => handleFeedLike(candidate)}
              onPass={() => handleFeedPass(candidate)}
              onNote={() => handleFeedNote(candidate)}
              onPressDetails={() => handleOpenDetails(candidate)}
            />
          ))
        ) : (
          /* Empty State when all nearby candidates are reviewed */
          <View style={styles.allCaughtUpCard}>
            <View style={styles.allCaughtUpIconCircle}>
              <Ionicons name="heart-circle" size={54} color={Colors.primary} />
            </View>
            <Text style={styles.allCaughtUpTitle}>You're All Caught Up!</Text>
            <Text style={styles.allCaughtUpSubtitle}>
              You've reviewed the active singles nearby. Pull down to refresh or check out profiles in nearby cities.
            </Text>
            <TouchableOpacity
              style={styles.refreshFeedBtn}
              onPress={() => setDismissedProfileIds(new Set())}
              activeOpacity={0.85}
            >
              <Ionicons name="reload" size={16} color={Colors.white} />
              <Text style={styles.refreshFeedBtnText}>Refresh Feed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exploreCitiesBtn}
              onPress={() => router.push('/explore' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.exploreCitiesBtnText}>Explore Other Cities</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* "Make Friends" Curated Interests Section */}
        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Make Friends</Text>
        </View>

        <TouchableOpacity
          style={styles.scenicCard}
          onPress={() => router.push('/explore' as any)}
          activeOpacity={0.9}
        >
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
            }}
            style={styles.scenicPhoto}
            resizeMode="cover"
          />
          <View style={styles.scenicBadge}>
            <Text style={styles.scenicBadgeText}>Travel & Outdoor</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Bottom Tab Bar */}
      <BottomTabBar activeTab="home" />

      {/* Profile Detail Modal */}
      <ProfileDetailModal
        visible={!!selectedProfileForModal}
        profile={selectedProfileForModal}
        onClose={() => setSelectedProfileForModal(null)}
        onLike={(profileId) => {
          const candidate = candidatePool.find((c) => c.profileId === profileId);
          if (candidate) handleFeedLike(candidate);
          setSelectedProfileForModal(null);
        }}
        onPass={(profileId) => {
          const candidate = candidatePool.find((c) => c.profileId === profileId);
          if (candidate) handleFeedPass(candidate);
          setSelectedProfileForModal(null);
        }}
        onStartChat={() => {
          setSelectedProfileForModal(null);
          router.push('/conversations' as any);
        }}
      />

      {/* Send Direct Note Modal */}
      {noteCandidate && (
        <SendNoteModal
          visible={!!noteCandidate}
          candidate={noteCandidate}
          onClose={() => setNoteCandidate(null)}
          onSent={(matched) => {
            const name = noteCandidate.displayName.split(' ')[0];
            setDismissedProfileIds((prev) => new Set([...prev, noteCandidate.profileId]));
            setNoteCandidate(null);
            showPill(`💌 Note sent to ${name}!`);
            if (matched) {
              toast.match(
                "🎉 It's a Match!",
                `You and ${name} are now connected!`,
                '/conversations',
              );
            }
          }}
        />
      )}

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
    </SafeAreaView>
  );
}

/**
 * Vertical Dating Profile Card Component with Direct Like & Dislike
 */
interface VerticalFeedCardProps {
  candidate: DiscoveryCandidate;
  onLike: () => void;
  onPass: () => void;
  onNote: () => void;
  onPressDetails: () => void;
}

function VerticalFeedCard({
  candidate,
  onLike,
  onPass,
  onNote,
  onPressDetails,
}: VerticalFeedCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = candidate.photos && candidate.photos.length > 0 ? candidate.photos : [];
  const currentPhoto =
    photos[photoIndex]?.largeUrl ||
    photos[photoIndex]?.mediumUrl ||
    photos[0]?.largeUrl ||
    photos[0]?.mediumUrl ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80';

  const handlePhotoTap = (e: any) => {
    if (photos.length <= 1) {
      onPressDetails();
      return;
    }
    const locationX = e.nativeEvent.locationX;
    const cardWidth = SCREEN_WIDTH - 32;

    if (locationX < cardWidth * 0.35) {
      // Tap left -> Previous photo
      if (photoIndex > 0) setPhotoIndex((p) => p - 1);
    } else if (locationX > cardWidth * 0.65) {
      // Tap right -> Next photo
      if (photoIndex < photos.length - 1) setPhotoIndex((p) => p + 1);
    } else {
      // Tap center -> open profile details
      onPressDetails();
    }
  };

  return (
    <View style={styles.verticalCard}>
      {/* Photo Container with Top Indicators & Badges */}
      <TouchableOpacity
        activeOpacity={0.96}
        style={styles.cardPhotoWrapper}
        onPress={handlePhotoTap}
      >
        <Image
          source={{ uri: currentPhoto }}
          style={styles.cardPhoto}
          resizeMode="cover"
        />

        {/* Multi-Photo Story Indicators Bar */}
        {photos.length > 1 && (
          <View style={styles.photoIndicatorsRow}>
            {photos.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.photoIndicatorBar,
                  idx === photoIndex && styles.photoIndicatorBarActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Top Badges (Distance & Verified/Boosted) */}
        <View style={styles.cardTopBadgesRow}>
          <View style={styles.cardDistanceBadge}>
            <Ionicons name="location-sharp" size={11} color="#FFFFFF" />
            <Text style={styles.cardDistanceText}>
              {candidate.distanceDisplay || (candidate.locationCity ? `${candidate.locationCity}` : 'Nearby')}
            </Text>
          </View>

          {candidate.isBoosted ? (
            <View style={styles.cardBoostedBadge}>
              <Ionicons name="flash" size={11} color="#FFFFFF" />
              <Text style={styles.cardBoostedText}>Boosted</Text>
            </View>
          ) : (
            <View style={styles.cardVerifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#FFFFFF" />
              <Text style={styles.cardVerifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {/* Ambient Dark Gradient Layer at bottom of photo */}
        <View style={styles.cardPhotoGradient} />

        {/* Name, Age, & City on Photo */}
        <View style={styles.cardPhotoOverlay}>
          <View style={styles.cardNameAgeRow}>
            <Text style={styles.cardName}>{candidate.displayName},</Text>
            <Text style={styles.cardAge}>{candidate.age}</Text>
          </View>
          <View style={styles.cardLocationRow}>
            <Ionicons name="navigate-outline" size={13} color="rgba(255, 255, 255, 0.9)" />
            <Text style={styles.cardLocationText}>
              {candidate.locationCity
                ? `${candidate.locationCity}${candidate.locationRegion ? `, ${candidate.locationRegion}` : ''}`
                : 'Tamil Nadu, India'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Card Body: Bio, Interests, and Direct Action Row */}
      <View style={styles.cardBody}>
        {/* Bio snippet */}
        {candidate.bio ? (
          <Text style={styles.cardBioText} numberOfLines={2}>
            {candidate.bio}
          </Text>
        ) : null}

        {/* Interest Tags */}
        {candidate.interests && candidate.interests.length > 0 ? (
          <View style={styles.cardInterestsRow}>
            {candidate.interests.slice(0, 3).map((item: any, idx: number) => {
              const name = typeof item === 'string' ? item : item.name;
              return (
                <View key={idx} style={styles.cardInterestChip}>
                  <Text style={styles.cardInterestChipText}>{name}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Direct Action Buttons: Pass ✖️, Note 💌, Like ❤️ */}
        <View style={styles.cardActionRow}>
          {/* Pass / Dislike Button */}
          <TouchableOpacity
            style={styles.actionPassBtn}
            onPress={onPass}
            activeOpacity={0.8}
            accessibilityLabel="Pass"
          >
            <Ionicons name="close" size={26} color="#64748B" />
          </TouchableOpacity>

          {/* Send Direct Note Button */}
          <TouchableOpacity
            style={styles.actionNoteBtn}
            onPress={onNote}
            activeOpacity={0.8}
            accessibilityLabel="Send Note"
          >
            <Ionicons name="mail" size={20} color={Colors.primary} />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity
            style={styles.actionLikeBtn}
            onPress={onLike}
            activeOpacity={0.85}
            accessibilityLabel="Like"
          >
            <Ionicons name="heart" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarWrapper: {
    position: 'relative',
  },
  homeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerBrandCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBrandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSquareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWithBadge: {
    position: 'relative',
  },
  bellBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  headlineSection: {
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  completionCardWrap: {
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  liveCountBadge: {
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  liveCountText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Vertical Profile Card Styles */
  verticalCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  cardPhotoWrapper: {
    width: '100%',
    height: 420,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoIndicatorsRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  photoIndicatorBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  photoIndicatorBarActive: {
    backgroundColor: '#FFFFFF',
  },
  cardTopBadgesRow: {
    position: 'absolute',
    top: 20,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  cardDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardDistanceText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  cardVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardVerifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardBoostedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(253, 93, 101, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardBoostedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardPhotoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  cardPhotoOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
  },
  cardNameAgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  cardName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  cardAge: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardLocationText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  cardBioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 10,
  },
  cardInterestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  cardInterestChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardInterestChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionPassBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  actionNoteBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  actionLikeBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
    elevation: 6,
  },

  /* Empty state */
  allCaughtUpCard: {
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  allCaughtUpIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  allCaughtUpTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  allCaughtUpSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshFeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  refreshFeedBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  exploreCitiesBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exploreCitiesBtnText: {
    color: Colors.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Scenic Card */
  scenicCard: {
    marginHorizontal: 16,
    height: 160,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  scenicPhoto: {
    width: '100%',
    height: '100%',
  },
  scenicBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  scenicBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  /* Floating Toast Pill */
  floatingToastPill: {
    position: 'absolute',
    top: 75,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  floatingToastPillText: {
    color: Colors.white,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
