import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useBillingStore } from '../src/stores/billing-store';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { Colors } from '../src/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { profile, toggleVisibility } = useProfileStore();
  const { billingStatus, openPaywall } = useBillingStore();

  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);

  const avatarUrl =
    profile?.photos?.find((p) => p.isPrimary)?.mediumUrl ||
    profile?.photos?.[0]?.mediumUrl ||
    profile?.photos?.[0]?.thumbnailUrl ||
    null;

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Truelove?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const isGoldMember = !!billingStatus?.activeSubscription;
  const userAccountStatus = user?.status || 'ACTIVE';
  const isGoodStanding = userAccountStatus === 'ACTIVE';
  const standingBadgeLabel = isGoodStanding
    ? 'Good Standing'
    : userAccountStatus === 'SUSPENDED'
    ? 'Suspended'
    : userAccountStatus === 'BANNED'
    ? 'Banned'
    : 'Inactive';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Banner with Coral Background */}
      <View style={styles.topBanner}>
        {/* Top Floating Actions */}
        <View style={styles.bannerHeader}>
          <TouchableOpacity
            style={styles.bannerCircleBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bannerCircleBtn}
            onPress={() => router.push('/profile/edit' as any)}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Decorative Wave/Heart overlay */}
        <View style={styles.bannerDeco}>
          <Ionicons
            name="heart-outline"
            size={160}
            color="rgba(255, 255, 255, 0.12)"
            style={styles.decoHeart}
          />
        </View>
      </View>

      {/* Main White Content Card overlapping Banner */}
      <View style={styles.mainCard}>
        {/* Center Circular Profile Avatar with White Border */}
        <View style={styles.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={48} color={Colors.textMuted} />
            </View>
          )}
          <TouchableOpacity
            style={styles.avatarEditBadge}
            onPress={() => router.push('/(onboarding)/photos' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* User Name & Location */}
        <View style={styles.nameBlock}>
          <Text style={styles.userName}>
            {profile?.displayName || (user?.phoneNumber ? `Member (${user.phoneNumber.slice(-4)})` : 'Member')}
            {profile?.age ? `, ${profile.age}` : ''}
          </Text>
          <Text style={styles.userLocation}>
            {profile?.locationCity
              ? `${profile.locationCity}${profile?.locationRegion ? `, ${profile.locationRegion}` : ''}`
              : 'Location not set'}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.menuScrollContent, { paddingBottom: 110 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Settings Menu List Items */}
          <View style={styles.menuGroup}>
            {/* My Account */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/edit' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="person-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuText}>My Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(onboarding)/preferences' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuText}>Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setLanguage(language === 'en' ? 'ta' : 'en');
                Alert.alert(
                  'Language Changed',
                  language === 'en' ? 'Switched to Tamil (தமிழ்)' : 'Switched to English'
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="language-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuText}>Language</Text>
              </View>
              <View style={styles.menuRightValue}>
                <Text style={styles.langValueText}>
                  {language === 'en' ? 'English' : 'Tamil (தமிழ்)'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Premium Membership Status */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/premium' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name="sparkles"
                  size={20}
                  color={isGoldMember ? Colors.gold : Colors.primary}
                />
                <Text style={styles.menuText}>Membership Tier</Text>
              </View>
              <View style={styles.menuRightValue}>
                <Text style={styles.tierBadgeText}>
                  {isGoldMember ? 'Truelove Gold' : 'Free Tier'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Trust & Safety Center */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowSafetyModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={Colors.primary}
                />
                <Text style={styles.menuText}>Trust & Safety Center</Text>
              </View>
              <View style={styles.menuRightValue}>
                <Text
                  style={[
                    styles.safetyGoodStandingBadge,
                    !isGoodStanding && { color: Colors.warning, backgroundColor: '#FEF3C7' },
                  ]}
                >
                  {standingBadgeLabel}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* "Get more matches" Monetization Banner */}
          <View style={styles.monetizationBanner}>
            <View style={styles.bannerTopRow}>
              <View style={styles.starIconBox}>
                <Ionicons name="star" size={20} color={Colors.primary} />
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerHeading}>Get more matches</Text>
                <Text style={styles.bannerSubheading}>
                  Be seen by more people in Encounters
                </Text>
              </View>
            </View>

            <View style={styles.bannerDivider} />

            <TouchableOpacity
              style={styles.upgradeLinkBtn}
              onPress={() => openPaywall('SEE_LIKES')}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeLinkText}>Upgrade to Premium</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Log Out */}
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Floating Bottom Tab Bar */}
      <BottomTabBar activeTab="profile" />

      {/* Trust & Safety Modal */}
      <Modal
        visible={showSafetyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSafetyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.safetyModalContent}>
            <View style={styles.safetyModalHeader}>
              <View style={styles.safetyIconBubble}>
                <Ionicons name="shield-checkmark" size={26} color={Colors.primary} />
              </View>
              <TouchableOpacity
                onPress={() => setShowSafetyModal(false)}
                style={styles.safetyCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.safetyModalTitle}>Trust & Member Safety</Text>
            <Text style={styles.safetyModalSubtitle}>
              We enforce strict community standards to ensure a respectful and secure dating environment.
            </Text>

            <View
              style={[
                styles.safetyStatusBox,
                !isGoodStanding && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
              ]}
            >
              <View style={styles.safetyStatusRow}>
                <Ionicons
                  name={isGoodStanding ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={isGoodStanding ? '#10B981' : Colors.warning}
                />
                <Text style={styles.safetyStatusText}>Account Status: {standingBadgeLabel}</Text>
              </View>
              <Text style={styles.safetyStatusSub}>
                {isGoodStanding
                  ? '0 Safety Strikes • All privileges active'
                  : 'Your account has active restrictions or is under review'}
              </Text>
            </View>

            <View style={styles.safetyPillarsList}>
              <View style={styles.safetyPillarItem}>
                <Ionicons name="camera-reverse" size={20} color={Colors.primary} />
                <View style={styles.safetyPillarTextCol}>
                  <Text style={styles.safetyPillarHeading}>Screenshot & Screen Recording Guard</Text>
                  <Text style={styles.safetyPillarBody}>
                    Screenshots and recordings are blocked on private chat, discovery cards, matches, and calls to protect member privacy.
                  </Text>
                </View>
              </View>

              <View style={styles.safetyPillarItem}>
                <Ionicons name="chatbubbles-outline" size={20} color={Colors.primary} />
                <View style={styles.safetyPillarTextCol}>
                  <Text style={styles.safetyPillarHeading}>Zero Harassment & Hate Speech</Text>
                  <Text style={styles.safetyPillarBody}>
                    Multi-lingual AI moderation actively filters abusive language in Tamil, Tanglish, Hindi, Hinglish, and English.
                  </Text>
                </View>
              </View>

              <View style={styles.safetyPillarItem}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
                <View style={styles.safetyPillarTextCol}>
                  <Text style={styles.safetyPillarHeading}>Anti-Scam & Contact Leak Protection</Text>
                  <Text style={styles.safetyPillarBody}>
                    Unsolicited phone numbers (+91), UPI handles, and financial solicitations are blocked automatically.
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.safetyUnderstoodBtn}
              onPress={() => setShowSafetyModal(false)}
            >
              <Text style={styles.safetyUnderstoodBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  topBanner: {
    height: 180,
    backgroundColor: Colors.primary,
    position: 'relative',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 10,
  },
  bannerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDeco: {
    position: 'absolute',
    top: -20,
    right: -20,
  },
  decoHeart: {
    transform: [{ rotate: '20deg' }],
  },
  mainCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -40,
    paddingTop: 0,
    position: 'relative',
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: -55,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.white,
    backgroundColor: Colors.backgroundSecondary,
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  nameBlock: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  userLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  menuScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  menuGroup: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuRightValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langValueText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  monetizationBanner: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  bannerSubheading: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bannerDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  upgradeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  upgradeLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.error,
  },
  safetyGoodStandingBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  safetyModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  safetyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  safetyIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyCloseBtn: {
    padding: 6,
  },
  safetyModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  safetyModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  safetyStatusBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  safetyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  safetyStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  safetyStatusSub: {
    fontSize: 12,
    color: '#047857',
    marginTop: 3,
    marginLeft: 28,
  },
  safetyPillarsList: {
    gap: 16,
    marginBottom: 24,
  },
  safetyPillarItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  safetyPillarTextCol: {
    flex: 1,
  },
  safetyPillarHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  safetyPillarBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  safetyUnderstoodBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyUnderstoodBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
