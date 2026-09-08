import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useDiscoveryStore } from '../src/stores/discovery-store';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { useBillingStore } from '../src/stores/billing-store';
import { ButterflyLogo } from '../src/components/ButterflyLogo';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { PaywallModal } from '../src/components/PaywallModal';
import { ProfileCompletionCard } from '../src/components/ProfileCompletionCard';
import { ProfileDetailModal, ProfileDetailData } from '../src/components/ProfileDetailModal';
import { Colors } from '../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SAMPLE_STORIES = [
  { id: '1', name: 'Priya', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', hasStory: true },
  { id: '2', name: 'Kavitha', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&auto=format&fit=crop&q=80', hasStory: true },
  { id: '3', name: 'Ananya', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80', hasStory: true },
  { id: '4', name: 'Deepika', image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80', hasStory: true },
];

const SAMPLE_NEAR_YOU = [
  { id: '1', name: 'Priya', distance: '1.2km', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Kavitha', distance: '2.5km', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&auto=format&fit=crop&q=80' },
  { id: '3', name: 'Ananya', distance: '3.1km', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop&q=80' },
];

export default function IndexScreen() {
  const router = useRouter();
  const { status: authStatus, user } = useAuthStore();
  const { profile, completion, fetchProfile, isLoading: isProfileLoading } = useProfileStore();
  const { candidates, fetchDiscoveryFeed } = useDiscoveryStore();
  const { unreadCount, fetchUnreadCount } = useNotificationsStore();
  const { fetchBillingStatus } = useBillingStore();

  const [selectedProfileForModal, setSelectedProfileForModal] = useState<ProfileDetailData | null>(null);

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

  // Loading state
  if (
    authStatus === 'CHECKING_SESSION' ||
    (authStatus === 'AUTHENTICATED' && isProfileLoading && !profile)
  ) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Truelove...</Text>
      </View>
    );
  }

  // Unauthenticated Welcome / Splash Screen
  if (authStatus === 'UNAUTHENTICATED' || !user) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <View style={styles.splashContent}>
          <View style={styles.splashLogoSection}>
            <ButterflyLogo size={64} />
            <Text style={styles.splashBrandTitle}>Truelove</Text>
            <Text style={styles.splashBrandSubtitle}>
              Find authentic connections and match with people nearby.
            </Text>
          </View>

          <View style={styles.splashActionSection}>
            <TouchableOpacity
              style={styles.splashButton}
              onPress={() => router.push('/(auth)/login' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.splashButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const myAvatarUrl =
    profile?.photos?.find((p) => p.isPrimary)?.mediumUrl ||
    profile?.photos?.[0]?.mediumUrl ||
    profile?.photos?.[0]?.thumbnailUrl ||
    null;

  const liveNearYou = candidates.length > 0
    ? candidates.map((c, idx) => ({
      id: c.profileId,
      name: c.displayName.split(' ')[0],
      distance: `${(1.2 + idx * 0.7).toFixed(1)}km`,
      image:
        c.photos?.[0]?.largeUrl ||
        c.photos?.[0]?.mediumUrl ||
        c.photos?.[0]?.thumbnailUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      rawCandidate: c,
    }))
    : SAMPLE_NEAR_YOU.map((p) => ({ ...p, rawCandidate: null }));

  const liveStories = candidates.length > 0
    ? candidates.slice(0, 6).map((c) => ({
      id: c.profileId,
      name: c.displayName.split(' ')[0],
      image:
        c.photos?.[0]?.mediumUrl ||
        c.photos?.[0]?.thumbnailUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      hasStory: true,
      rawCandidate: c,
    }))
    : SAMPLE_STORIES.map((s) => ({ ...s, rawCandidate: null }));

  const handleCardPress = (person: any) => {
    if (person.rawCandidate) {
      const c = person.rawCandidate;
      setSelectedProfileForModal({
        id: c.profileId,
        name: c.displayName,
        age: c.age,
        city: c.locationCity || 'Chennai, Tamil Nadu',
        bio: c.bio || undefined,
        photos: c.photos?.map((p: any) => ({
          url: p.largeUrl || p.mediumUrl || p.thumbnailUrl || '',
          id: p.id,
        })),
        primaryPhotoUrl: c.photos?.[0]?.largeUrl || c.photos?.[0]?.mediumUrl || person.image,
        interests: c.interests?.map((i: any) => (typeof i === 'string' ? i : i.name)) || [],
        distanceKm: parseFloat(person.distance) || 2.5,
      });
    } else {
      router.push('/discovery' as any);
    }
  };

  return (
    <SafeAreaView style={styles.homeContainer}>
      {/* Top Header */}
      <View style={styles.homeHeader}>
        {/* User Avatar with Green Active Dot */}
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

        {/* Right Action Icons (Search & Notifications) */}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Location & Title */}
        <View style={styles.headlineSection}>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={14} color={Colors.textMuted} />
            <Text style={styles.locationText}>
              {profile?.locationCity ? `${profile.locationCity}, ${profile.locationRegion || 'TN'}` : 'Chennai, Tamil Nadu'}
            </Text>
          </View>
          <Text style={styles.mainTitle}>Find the one for you</Text>
        </View>

        {/* Compact Profile Completion Banner (if incomplete) */}
        {authStatus === 'AUTHENTICATED' && profile && (
          <ProfileCompletionCard
            profile={profile}
            completion={completion}
            compact={true}
          />
        )}

        {/* Stories Horizontal Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesRow}
        >
          {/* My Story */}
          <View style={styles.storyItem}>
            <View style={styles.myStoryCircle}>
              {myAvatarUrl ? (
                <Image
                  source={{ uri: myAvatarUrl }}
                  style={styles.storyImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.storyImg, styles.placeholderAvatar]}>
                  <Ionicons name="person" size={20} color={Colors.textMuted} />
                </View>
              )}
              <View style={styles.plusStoryBadge}>
                <Ionicons name="add" size={12} color={Colors.white} />
              </View>
            </View>
            <Text style={styles.storyName}>My Story</Text>
          </View>

          {/* Partner Stories */}
          {liveStories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.storyItem}
              onPress={() => handleCardPress(story)}
              activeOpacity={0.8}
            >
              <View style={styles.storyRing}>
                <Image
                  source={{ uri: story.image }}
                  style={styles.storyImg}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.storyName}>{story.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* "Near You" Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Near You</Text>
          <TouchableOpacity
            onPress={() => router.push('/discovery' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nearYouRow}
        >
          {liveNearYou.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.nearCard}
              onPress={() => handleCardPress(person)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: person.image }}
                style={styles.nearCardPhoto}
                resizeMode="cover"
              />
              {/* Top Distance Chip */}
              <View style={styles.nearDistanceChip}>
                <Text style={styles.nearDistanceText}>{person.distance}</Text>
              </View>
              {/* Bottom Name Overlay */}
              <View style={styles.nearNameOverlay}>
                <Text style={styles.nearNameText}>{person.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* "Make Friends" / Interests Scenic Card */}
        <View style={styles.sectionHeader}>
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
        onStartChat={() => {
          setSelectedProfileForModal(null);
          router.push('/conversations' as any);
        }}
      />

      {/* Paywall Modal */}
      <PaywallModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  splashLogoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashBrandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 16,
  },
  splashBrandSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 260,
  },
  splashActionSection: {
    paddingBottom: 16,
  },
  splashButton: {
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
  splashButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  homeContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  homeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundSecondary,
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
    borderColor: Colors.white,
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
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 100,
  },
  headlineSection: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  storiesRow: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 24,
  },
  storyItem: {
    alignItems: 'center',
    width: 60,
  },
  myStoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  storyRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  storyImg: {
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  plusStoryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  storyName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  nearYouRow: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  nearCard: {
    width: 115,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nearCardPhoto: {
    width: '100%',
    height: '100%',
  },
  nearDistanceChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nearDistanceText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '600',
  },
  nearNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nearNameText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  scenicCard: {
    marginHorizontal: 20,
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
});
