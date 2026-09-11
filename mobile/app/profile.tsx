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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useBillingStore } from '../src/stores/billing-store';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { Colors } from '../src/theme/colors';
import { ProfileVisibility } from '../../shared/src/types';
import { registerForPushNotificationsAsync } from '../src/services/push-notification.service';
import { setLocale, getLocale, Locale } from '../src/i18n/strings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { profile, toggleVisibility, fetchProfile, uploadPhoto } = useProfileStore();
  const { billingStatus, openPaywall } = useBillingStore();

  const [locale, setLocalLocale] = useState<Locale>(getLocale());
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showLegalModal, setShowLegalModal] = useState<'TERMS' | 'PRIVACY' | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  const avatarUrl =
    profile?.photos?.find((p) => p.isPrimary)?.mediumUrl ||
    profile?.photos?.[0]?.mediumUrl ||
    profile?.photos?.[0]?.thumbnailUrl ||
    null;

  const isProfileVisible = profile?.visibility !== ProfileVisibility.HIDDEN;

  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Update your profile picture', [
      {
        text: 'Upload New Photo',
        onPress: handlePickAndUploadAvatar,
      },
      {
        text: 'Manage All Photos',
        onPress: () => router.push('/(onboarding)/photos?fromProfile=true' as any),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickAndUploadAvatar = async () => {
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
        setIsUploadingAvatar(true);
        const fileName = asset.uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        const fileSize = asset.fileSize || 1024 * 500;

        const success = await uploadPhoto(asset.uri, mimeType, fileSize);
        setIsUploadingAvatar(false);
        if (success) {
          await fetchProfile();
          Alert.alert('Success', 'Profile photo updated successfully.');
        } else {
          Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
        }
      }
    } catch (err: any) {
      setIsUploadingAvatar(false);
      Alert.alert('Error', err.message || 'Failed to select photo.');
    }
  };

  const handleToggleVisibility = async (enabled: boolean) => {
    setIsTogglingVisibility(true);
    const targetVisibility = enabled ? ProfileVisibility.VISIBLE : ProfileVisibility.HIDDEN;
    const success = await toggleVisibility(targetVisibility);
    setIsTogglingVisibility(false);
    if (!success) {
      Alert.alert(
        'Cannot Enable Discovery',
        'Please ensure your profile has a name, birthday, city, and at least 1 photo before enabling discovery.',
      );
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (enabled) {
      await registerForPushNotificationsAsync();
    }
  };

  const handleToggleLanguage = () => {
    const nextLocale = locale === 'en' ? 'ta' : 'en';
    setLocale(nextLocale);
    setLocalLocale(nextLocale);
    Alert.alert(
      'Language Updated',
      nextLocale === 'ta' ? 'Switched to Tamil (தமிழ்)' : 'Switched to English',
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Truelove?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setShowSettingsModal(false);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Deleting your account will permanently remove your profile, photos, matches, and conversation history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setShowSettingsModal(false);
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
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
      {/* Top Banner with Brand Accent */}
      <View style={styles.topBanner}>
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
        {/* Center Circular Profile Avatar */}
        <View style={styles.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={48} color={Colors.textMuted} />
            </View>
          )}

          {isUploadingAvatar ? (
            <View style={styles.avatarUploadingOverlay}>
              <ActivityIndicator size="small" color={Colors.white} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.avatarEditBadge}
              onPress={handleAvatarPress}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={14} color={Colors.white} />
            </TouchableOpacity>
          )}
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
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuText}>Settings</Text>
              </View>
              <View style={styles.menuRightValue}>
                <Text style={styles.settingStateSub}>
                  {isProfileVisible ? 'Active' : 'Ghost Mode'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Language */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleToggleLanguage}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <Ionicons name="language-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.menuText}>Language</Text>
              </View>
              <View style={styles.menuRightValue}>
                <Text style={styles.langValueText}>
                  {locale === 'en' ? 'English' : 'Tamil (தமிழ்)'}
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
                  name="sparkles-outline"
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
                <Ionicons name="sparkles" size={18} color={Colors.primary} />
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

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalContent}>
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Settings</Text>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsScroll}>
              {/* Section: Discovery & Visibility */}
              <Text style={styles.settingsSectionTitle}>Discovery</Text>
              <View style={styles.settingsCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Show me on Truelove</Text>
                    <Text style={styles.settingDesc}>
                      {isProfileVisible
                        ? 'Your profile is active and discoverable by new singles.'
                        : 'Ghost Mode active. You are hidden from the discovery deck.'}
                    </Text>
                  </View>
                  <Switch
                    value={isProfileVisible}
                    onValueChange={handleToggleVisibility}
                    disabled={isTogglingVisibility}
                    trackColor={{ false: '#CBD5E1', true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => {
                    setShowSettingsModal(false);
                    router.push('/(onboarding)/preferences?fromProfile=true' as any);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Match Preferences</Text>
                    <Text style={styles.settingDesc}>
                      {profile?.preferences
                        ? `${profile.preferences.preferredGenders?.map((g) => (g === 'WOMAN' ? 'Women' : g === 'MAN' ? 'Men' : 'Everyone')).join(', ') || 'Everyone'} • Age ${profile.preferences.minAge || 18}-${profile.preferences.maxAge || 99}`
                        : 'Gender, Age & Intent filters'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Section: Notifications */}
              <Text style={styles.settingsSectionTitle}>Notifications</Text>
              <View style={styles.settingsCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Push Notifications</Text>
                    <Text style={styles.settingDesc}>
                      Receive instant alerts for new matches, chat messages, and missed calls.
                    </Text>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    trackColor={{ false: '#CBD5E1', true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>

              {/* Section: Account Information */}
              <Text style={styles.settingsSectionTitle}>Account</Text>
              <View style={styles.settingsCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{user?.phoneNumber || 'Not registered'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Account Status</Text>
                  <Text style={[styles.infoValue, { color: isGoodStanding ? '#10B981' : Colors.warning }]}>
                    {standingBadgeLabel}
                  </Text>
                </View>
              </View>

              {/* Section: Legal & App Information */}
              <Text style={styles.settingsSectionTitle}>About</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => setShowLegalModal('TERMS')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkLabel}>Terms of Service</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => setShowLegalModal('PRIVACY')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkLabel}>Privacy Policy</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>App Version</Text>
                  <Text style={styles.infoValue}>v1.0.0 (Build 1)</Text>
                </View>
              </View>

              {/* Section: Danger Zone */}
              <Text style={[styles.settingsSectionTitle, { color: Colors.error }]}>Account Actions</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={handleDeleteAccount}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.linkLabel, { color: Colors.error }]}>Delete Account</Text>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
                <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
              </View>
              <TouchableOpacity
                onPress={() => setShowSafetyModal(false)}
                style={styles.safetyCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.safetyModalTitle}>Trust & Member Safety</Text>
            <Text style={styles.safetyModalSubtitle}>
              We enforce community standards to ensure a respectful dating environment.
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
                  size={18}
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
                <Ionicons name="camera-reverse-outline" size={20} color={Colors.primary} />
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
                    Multi-lingual AI moderation actively filters abusive language in Tamil, Tanglish, Hindi, and English.
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

      {/* Legal Dialog Modal */}
      <Modal
        visible={showLegalModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLegalModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.legalModalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>
                {showLegalModal === 'TERMS' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowLegalModal(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.legalScroll} showsVerticalScrollIndicator={false}>
              {showLegalModal === 'TERMS' ? (
                <View>
                  <Text style={styles.legalParagraph}>
                    Welcome to Truelove. By creating an account, you agree to treat all members with respect, honesty, and dignity.
                  </Text>
                  <Text style={styles.legalHeading}>1. Eligibility</Text>
                  <Text style={styles.legalParagraph}>
                    You must be at least 18 years of age to register or use Truelove. Accounts impersonating others or misrepresenting age are permanently banned.
                  </Text>
                  <Text style={styles.legalHeading}>2. Community Standards</Text>
                  <Text style={styles.legalParagraph}>
                    Harassment, hate speech, financial fraud, and unsolicited solicitations are strictly prohibited.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.legalParagraph}>
                    Your privacy is our priority. Truelove is built with privacy-by-design architecture.
                  </Text>
                  <Text style={styles.legalHeading}>1. Data Protection</Text>
                  <Text style={styles.legalParagraph}>
                    We never sell your personal data to third parties. Private photos and media are stored in encrypted cloud storage.
                  </Text>
                  <Text style={styles.legalHeading}>2. Media Protection</Text>
                  <Text style={styles.legalParagraph}>
                    Screenshot prevention is active across chats and video calls to prevent non-consensual capture.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.safetyUnderstoodBtn}
              onPress={() => setShowLegalModal(null)}
            >
              <Text style={styles.safetyUnderstoodBtnText}>Close</Text>
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
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  userLocation: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  menuScrollContent: {
    paddingHorizontal: 20,
  },
  menuGroup: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuRightValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingStateSub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  langValueText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  tierBadgeText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  safetyGoodStandingBadge: {
    fontSize: 12,
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '600',
    overflow: 'hidden',
  },
  monetizationBanner: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 20,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    marginVertical: 12,
  },
  upgradeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradeLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    marginBottom: 24,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsScroll: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  settingsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingTextCol: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  linkLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  safetyModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  safetyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  safetyIconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  safetyModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  safetyStatusBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  safetyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  safetyStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  safetyStatusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 26,
  },
  safetyPillarsList: {
    gap: 14,
    marginBottom: 20,
  },
  safetyPillarItem: {
    flexDirection: 'row',
    gap: 12,
  },
  safetyPillarTextCol: {
    flex: 1,
  },
  safetyPillarHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  safetyPillarBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  safetyUnderstoodBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  safetyUnderstoodBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  legalModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '75%',
  },
  legalScroll: {
    marginVertical: 16,
  },
  legalHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  legalParagraph: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
});
