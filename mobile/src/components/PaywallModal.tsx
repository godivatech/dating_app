import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useBillingStore, PaywallTab, PaywallPackCategory } from '../stores/billing-store';
import { t } from '../i18n/strings';
import { SubscriptionTier, SafeSubscriptionProduct } from '../../../shared/src/types';
import { Colors } from '../theme/colors';

export const PaywallModal: React.FC = () => {
  const {
    paywallVisible,
    paywallTriggerReason,
    paywallActiveTab,
    paywallPackCategory,
    products,
    creditBalance,
    isPurchasing,
    isRestoring,
    error,
    closePaywall,
    purchaseProduct,
    restorePurchases,
    fetchProducts,
    fetchCreditBalance,
    setPaywallActiveTab,
    setPaywallPackCategory,
  } = useBillingStore();

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 36) : 0,
  );

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.GOLD);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (paywallVisible) {
      if (products.length === 0) {
        fetchProducts();
      }
      fetchCreditBalance();
    }
  }, [paywallVisible, products.length]);

  // Set default selected product whenever tab, tier, or pack category changes
  useEffect(() => {
    if (paywallActiveTab === 'SUBSCRIPTIONS') {
      const tierProducts = products.filter((p) => p.tier === selectedTier);
      if (tierProducts.length > 0) {
        setSelectedProductId(tierProducts[0].storeProductId);
      }
    } else {
      // Micro-Packs tab
      const packProducts = products.filter((p) => p.tier === SubscriptionTier.A_LA_CARTE);
      const filtered = packProducts.filter((p) => {
        if (paywallPackCategory === 'DIRECT_NOTES') return p.productKey.startsWith('DIRECT_NOTES_');
        if (paywallPackCategory === 'BOOST') return p.productKey.startsWith('BOOST_PACK_');
        if (paywallPackCategory === 'CALL') return p.productKey.startsWith('CALL_PASS_');
        return true;
      });
      if (filtered.length > 0) {
        setSelectedProductId(filtered[0].storeProductId);
      }
    }
  }, [products, paywallActiveTab, selectedTier, paywallPackCategory]);

  if (!paywallVisible) return null;

  const currentTierProducts = products.filter((p) => p.tier === selectedTier);
  const aLaCarteProducts = products.filter((p) => p.tier === SubscriptionTier.A_LA_CARTE);

  const filteredPacks = aLaCarteProducts.filter((p) => {
    if (paywallPackCategory === 'DIRECT_NOTES') return p.productKey.startsWith('DIRECT_NOTES_');
    if (paywallPackCategory === 'BOOST') return p.productKey.startsWith('BOOST_PACK_');
    if (paywallPackCategory === 'CALL') return p.productKey.startsWith('CALL_PASS_');
    return true;
  });

  const selectedProduct = products.find((p) => p.storeProductId === selectedProductId);

  const handlePurchase = async () => {
    if (!selectedProductId) return;
    await purchaseProduct(selectedProductId);
  };

  const getReasonBanner = () => {
    if (!paywallTriggerReason) return null;
    if (paywallTriggerReason === 'daily_likes_exceeded') {
      return {
        title: t('outOfLikesTitle'),
        desc: 'You have reached your 25 daily likes. Upgrade to Truelove Plus or Gold for unlimited swipes!',
        icon: 'heart' as const,
      };
    }
    if (paywallTriggerReason === 'rewind_pass') {
      return {
        title: t('rewindLockTitle'),
        desc: 'Accidental left swipe? Rewind and get a second chance with Truelove Plus or Gold.',
        icon: 'reload' as const,
      };
    }
    if (paywallTriggerReason === 'see_likes') {
      return {
        title: t('seeWhoLikedYou'),
        desc: 'Unblur your secret admirers and match instantly with Truelove Gold.',
        icon: 'eye' as const,
      };
    }
    if (
      paywallTriggerReason === 'DIRECT_NOTES' ||
      paywallTriggerReason === 'direct_notes_exceeded'
    ) {
      return {
        title: 'Direct Note Limit Reached',
        desc: 'Attach a personalized note to stand out! Get a Direct Note pack or unlock Unlimited Notes with Gold.',
        icon: 'mail' as const,
      };
    }
    if (paywallTriggerReason === 'BOOST' || paywallTriggerReason === 'profile_boost') {
      return {
        title: 'Supercharge Your Matches ⚡',
        desc: 'Profile Boost puts you at the front of discovery in your area for 30 minutes with 10x visibility.',
        icon: 'flash' as const,
      };
    }
    if (
      paywallTriggerReason === 'CALL' ||
      paywallTriggerReason === 'vibe_check_complete' ||
      paywallTriggerReason === 'call_pass'
    ) {
      return {
        title: '1-Minute Vibe Check Ended! ✨',
        desc: 'Vibe was electric! Grab a 30-Min Call Pass for ₹49 or unlock Unlimited Video & Voice Calling with Gold.',
        icon: 'videocam' as const,
      };
    }
    return null;
  };

  const banner = getReasonBanner();

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={false}
      onRequestClose={closePaywall}
    >
      <StatusBar style="dark" />
      <View style={[styles.safeArea, { paddingTop: topInset + 10 }]}>
        {/* Navigation Bar Row */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={closePaywall}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 24) + 30 },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="sparkles" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.brandTitle}>Truelove Premium</Text>
            <Text style={styles.brandSubtitle}>
              Elevate your dating journey with verified visibility, instant direct notes, and VIP calls
            </Text>
          </View>

          {/* Context Trigger Reason Banner */}
          {banner && (
            <View style={styles.reasonBanner}>
              <Ionicons
                name={banner.icon}
                size={20}
                color={Colors.primary}
                style={{ marginRight: 10, marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonTitle}>{banner.title}</Text>
                <Text style={styles.reasonDesc}>{banner.desc}</Text>
              </View>
            </View>
          )}

          {/* Top Segment Switcher (Subscriptions vs Micro-Packs) */}
          <View style={styles.mainSegmentContainer}>
            <TouchableOpacity
              style={[
                styles.mainSegmentBtn,
                paywallActiveTab === 'SUBSCRIPTIONS' && styles.mainSegmentBtnActive,
              ]}
              onPress={() => setPaywallActiveTab('SUBSCRIPTIONS')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={paywallActiveTab === 'SUBSCRIPTIONS' ? Colors.white : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.mainSegmentText,
                  paywallActiveTab === 'SUBSCRIPTIONS' && styles.mainSegmentTextActive,
                ]}
              >
                Memberships
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainSegmentBtn,
                paywallActiveTab === 'PACKS' && styles.mainSegmentBtnActive,
              ]}
              onPress={() => setPaywallActiveTab('PACKS')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={16}
                color={paywallActiveTab === 'PACKS' ? Colors.white : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.mainSegmentText,
                  paywallActiveTab === 'PACKS' && styles.mainSegmentTextActive,
                ]}
              >
                Instant Packs
              </Text>
            </TouchableOpacity>
          </View>

          {/* User Credit Balance Bar */}
          {creditBalance && (
            <View style={styles.creditBalanceBar}>
              <View style={styles.creditItem}>
                <Text style={styles.creditIcon}>💌</Text>
                <Text style={styles.creditLabel}>
                  <Text style={styles.creditBold}>{creditBalance.directNotes}</Text> Notes
                </Text>
              </View>
              <View style={styles.creditDivider} />
              <View style={styles.creditItem}>
                <Text style={styles.creditIcon}>⚡</Text>
                <Text style={styles.creditLabel}>
                  <Text style={styles.creditBold}>{creditBalance.profileBoosts}</Text> Boosts
                </Text>
              </View>
              <View style={styles.creditDivider} />
              <View style={styles.creditItem}>
                <Text style={styles.creditIcon}>📞</Text>
                <Text style={styles.creditLabel}>
                  <Text style={styles.creditBold}>{creditBalance.callPassMinutes}</Text>m Calls
                </Text>
              </View>
            </View>
          )}

          {/* CONTENT: SUBSCRIPTIONS TAB */}
          {paywallActiveTab === 'SUBSCRIPTIONS' ? (
            <>
              {/* Tier Switcher Tabs */}
              <View style={styles.tierSwitcher}>
                <TouchableOpacity
                  style={[
                    styles.tierTab,
                    selectedTier === SubscriptionTier.PLUS && styles.tierTabActive,
                  ]}
                  onPress={() => setSelectedTier(SubscriptionTier.PLUS)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tierTabText,
                      selectedTier === SubscriptionTier.PLUS && styles.tierTabTextActive,
                    ]}
                  >
                    Truelove Plus
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tierTab,
                    selectedTier === SubscriptionTier.GOLD && styles.tierTabActive,
                  ]}
                  onPress={() => setSelectedTier(SubscriptionTier.GOLD)}
                  activeOpacity={0.8}
                >
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                  </View>
                  <Text
                    style={[
                      styles.tierTabText,
                      selectedTier === SubscriptionTier.GOLD && styles.tierTabTextActive,
                    ]}
                  >
                    Truelove Gold
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Product Plans Grid */}
              <View style={styles.plansContainer}>
                {currentTierProducts.map((prod) => {
                  const isSelected = selectedProductId === prod.storeProductId;
                  const isThreeMonth = prod.billingPeriod === 'QUARTERLY';

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => setSelectedProductId(prod.storeProductId)}
                      activeOpacity={0.8}
                    >
                      {isThreeMonth && (
                        <View style={styles.saveBadge}>
                          <Text style={styles.saveBadgeText}>SAVE 22%</Text>
                        </View>
                      )}
                      <Text
                        style={[styles.planDuration, isSelected && styles.planDurationSelected]}
                      >
                        {isThreeMonth ? '3 Months' : '1 Month'}
                      </Text>
                      <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                        {prod.displayPrice}
                      </Text>
                      <Text style={styles.planSubtext}>
                        {isThreeMonth
                          ? `₹${Math.round(prod.priceAmount / 300)}/mo`
                          : 'Billed monthly'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Feature Matrix */}
              <View style={styles.featuresCard}>
                <Text style={styles.featuresHeader}>
                  Included in{' '}
                  {selectedTier === SubscriptionTier.GOLD ? 'Truelove Gold 👑' : 'Truelove Plus ⚡'}
                </Text>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="heart" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>Unlimited Swipes & Likes</Text>
                    <Text style={styles.featureDesc}>
                      Never run out of likes. Connect freely with all candidates.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="reload" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>Rewind Pass</Text>
                    <Text style={styles.featureDesc}>
                      Undo accidental left swipes with infinite rewinds.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="mail" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>
                      {selectedTier === SubscriptionTier.GOLD
                        ? 'Unlimited Direct Notes 💌'
                        : '5 Direct Notes Daily 💌'}
                    </Text>
                    <Text style={styles.featureDesc}>
                      {selectedTier === SubscriptionTier.GOLD
                        ? 'Attach a note before matching to any profile you like.'
                        : '5 daily high-priority icebreakers delivered directly.'}
                    </Text>
                  </View>
                </View>

                {selectedTier === SubscriptionTier.GOLD && (
                  <>
                    <View style={styles.featureRow}>
                      <View style={styles.featureIconBox}>
                        <Ionicons name="eye" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>See Who Liked You</Text>
                        <Text style={styles.featureDesc}>
                          Instantly unblur secret admirers and match on the spot.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.featureRow}>
                      <View style={styles.featureIconBox}>
                        <Ionicons name="videocam" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Unlimited HD Video & Audio Calls</Text>
                        <Text style={styles.featureDesc}>
                          Talk with mutual matches with zero time limits and HD Agora RTC.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.featureRow}>
                      <View style={styles.featureIconBox}>
                        <Ionicons name="flash" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>1 Free Weekly Profile Boost</Text>
                        <Text style={styles.featureDesc}>
                          Get 10x profile reach every week automatically.
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </>
          ) : (
            /* CONTENT: MICRO-PACKS TAB */
            <>
              {/* Category Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPillsContainer}
              >
                {[
                  { key: 'ALL', label: 'All Packs' },
                  { key: 'DIRECT_NOTES', label: '💌 Direct Notes' },
                  { key: 'BOOST', label: '⚡ Profile Boosts' },
                  { key: 'CALL', label: '📞 Call Passes' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.categoryPill,
                      paywallPackCategory === item.key && styles.categoryPillActive,
                    ]}
                    onPress={() => setPaywallPackCategory(item.key as PaywallPackCategory)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        paywallPackCategory === item.key && styles.categoryPillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Pack Product Cards */}
              <View style={styles.packsGrid}>
                {filteredPacks.map((prod) => {
                  const isSelected = selectedProductId === prod.storeProductId;
                  const isDirectNote = prod.productKey.startsWith('DIRECT_NOTES_');
                  const isBoost = prod.productKey.startsWith('BOOST_PACK_');
                  const isCall = prod.productKey.startsWith('CALL_PASS_');

                  let badgeText = '';
                  let iconName: any = 'flash';
                  if (prod.productKey.includes('15') || prod.productKey.includes('3')) {
                    badgeText = 'BEST VALUE';
                  } else if (prod.productKey.includes('30')) {
                    badgeText = 'SUPER SAVER';
                  }

                  if (isDirectNote) iconName = 'mail';
                  else if (isBoost) iconName = 'flash';
                  else if (isCall) iconName = 'videocam';

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[styles.packCard, isSelected && styles.packCardSelected]}
                      onPress={() => setSelectedProductId(prod.storeProductId)}
                      activeOpacity={0.8}
                    >
                      {badgeText !== '' && (
                        <View style={styles.packBadge}>
                          <Text style={styles.packBadgeText}>{badgeText}</Text>
                        </View>
                      )}
                      <View style={styles.packHeaderRow}>
                        <View
                          style={[
                            styles.packIconBox,
                            isBoost && { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
                            isCall && { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
                          ]}
                        >
                          <Ionicons
                            name={iconName}
                            size={22}
                            color={
                              isBoost
                                ? '#D97706'
                                : isCall
                                  ? '#0284C7'
                                  : Colors.primary
                            }
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.packTitle}>{prod.displayName}</Text>
                          <Text style={styles.packDescription}>{prod.description}</Text>
                        </View>
                        <View style={styles.packPriceBox}>
                          <Text style={[styles.packPrice, isSelected && styles.packPriceSelected]}>
                            {prod.displayPrice}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Primary Purchase CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedProductId}
            activeOpacity={0.85}
          >
            {isPurchasing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.ctaButtonText}>
                {selectedProduct
                  ? `Unlock ${selectedProduct.displayName} • ${selectedProduct.displayPrice}`
                  : 'Select a Plan'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Secondary Restore Actions */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={restorePurchases}
            disabled={isRestoring}
            activeOpacity={0.7}
          >
            {isRestoring ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>{t('restorePurchases')}</Text>
            )}
          </TouchableOpacity>

          {/* Legal / INR Notice */}
          <Text style={styles.legalNotice}>
            All transactions are processed securely in INR (₹) inclusive of GST. Pay via UPI (GPay, PhonePe), NetBanking, or App Store.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    paddingHorizontal: 20,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  reasonBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253, 93, 101, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 2,
  },
  reasonDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  mainSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  mainSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  mainSegmentBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  mainSegmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  mainSegmentTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  creditBalanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  creditItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  creditLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  creditBold: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  creditDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  tierSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tierTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  tierTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tierTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tierTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  saveBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  planDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  planDurationSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  planPriceSelected: {
    color: Colors.primary,
  },
  planSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  featuresCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  featuresHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  categoryPillsContainer: {
    paddingVertical: 4,
    gap: 8,
    marginBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  packsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  packCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  packCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.04)',
  },
  packBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
  },
  packHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  packDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  packPriceBox: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  packPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  packPriceSelected: {
    color: Colors.primary,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  legalNotice: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 8,
  },
});
