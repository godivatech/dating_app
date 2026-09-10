import React, { useState, useEffect } from 'react';
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
import { useBillingStore } from '../stores/billing-store';
import { t } from '../i18n/strings';
import { SubscriptionTier } from '../../../shared/src/types';
import { Colors } from '../theme/colors';

export const PaywallModal: React.FC = () => {
  const {
    paywallVisible,
    paywallTriggerReason,
    products,
    isPurchasing,
    isRestoring,
    error,
    closePaywall,
    purchaseProduct,
    restorePurchases,
    fetchProducts,
  } = useBillingStore();

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 36) : 0,
  );

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.GOLD);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (paywallVisible && products.length === 0) {
      fetchProducts();
    }
  }, [paywallVisible, products.length]);

  useEffect(() => {
    // Select default product for current tier
    const tierProducts = products.filter((p) => p.tier === selectedTier);
    if (tierProducts.length > 0) {
      const defaultProd = tierProducts[0];
      setSelectedProductId(defaultProd.storeProductId);
    }
  }, [products, selectedTier]);

  if (!paywallVisible) return null;

  const currentTierProducts = products.filter((p) => p.tier === selectedTier);

  const handlePurchase = async () => {
    if (!selectedProductId) return;
    await purchaseProduct(selectedProductId);
  };

  const getReasonBanner = () => {
    if (!paywallTriggerReason) return null;
    if (paywallTriggerReason === 'daily_likes_exceeded') {
      return {
        title: t('outOfLikesTitle'),
        desc: t('outOfLikesDesc'),
      };
    }
    if (paywallTriggerReason === 'rewind_pass') {
      return {
        title: t('rewindLockTitle'),
        desc: t('rewindLockDesc'),
      };
    }
    if (paywallTriggerReason === 'see_likes') {
      return {
        title: t('seeWhoLikedYou'),
        desc: t('seeWhoLikedYouDesc'),
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
        {/* Dedicated Navigation Bar Row for Close Button */}
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
          contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="sparkles" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.brandTitle}>{t('navPremium')}</Text>
            <Text style={styles.brandSubtitle}>
              Elevate your dating experience with exclusive perks and verified visibility
            </Text>
          </View>

          {/* Context Trigger Reason Banner */}
          {banner && (
            <View style={styles.reasonBanner}>
              <Ionicons name="flash" size={18} color={Colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonTitle}>{banner.title}</Text>
                <Text style={styles.reasonDesc}>{banner.desc}</Text>
              </View>
            </View>
          )}

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
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedProductId(prod.storeProductId)}
                  activeOpacity={0.8}
                >
                  {isThreeMonth && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>SAVE 22%</Text>
                    </View>
                  )}
                  <Text style={[styles.planDuration, isSelected && styles.planDurationSelected]}>
                    {isThreeMonth ? '3 Months' : '1 Month'}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {prod.displayPrice}
                  </Text>
                  <Text style={styles.planSubtext}>
                    {isThreeMonth ? `₹${Math.round(prod.priceAmount / 300)}/mo` : 'Billed monthly'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feature Matrix */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresHeader}>
              Included in {selectedTier === SubscriptionTier.GOLD ? 'Truelove Gold' : 'Truelove Plus'}
            </Text>

            <View style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <Ionicons name="heart" size={18} color={Colors.primary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{t('unlimitedLikes')}</Text>
                <Text style={styles.featureDesc}>{t('unlimitedLikesDesc')}</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <Ionicons name="reload" size={18} color={Colors.primary} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{t('rewindPass')}</Text>
                <Text style={styles.featureDesc}>{t('rewindPassDesc')}</Text>
              </View>
            </View>

            {selectedTier === SubscriptionTier.GOLD && (
              <>
                <View style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="eye" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>{t('seeWhoLikedYou')}</Text>
                    <Text style={styles.featureDesc}>{t('seeWhoLikedYouDesc')}</Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <Ionicons name="trending-up" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>{t('profileBoost')}</Text>
                    <Text style={styles.featureDesc}>{t('profileBoostDesc')}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Primary Upgrade CTA Button */}
          <TouchableOpacity
            style={[
              styles.ctaButton,
              isPurchasing && styles.ctaButtonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedProductId}
            activeOpacity={0.85}
          >
            {isPurchasing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.ctaButtonText}>
                {selectedTier === SubscriptionTier.GOLD
                  ? t('upgradeToGold')
                  : t('upgradeToPlus')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Secondary Actions */}
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
            Prices shown in INR (₹) inclusive of applicable taxes. Auto-renews until canceled in store settings.
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
    marginBottom: 20,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  reasonBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight,
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  reasonTitle: {
    color: Colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  reasonDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  tierSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tierTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 11,
    position: 'relative',
  },
  tierTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tierTabText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tierTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
  plansContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF9F9',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  planDuration: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  planDurationSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  planPrice: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 6,
  },
  planPriceSelected: {
    color: Colors.textPrimary,
  },
  planSubtext: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  featuresCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderColor: Colors.border,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  featuresHeader: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  featureDesc: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 14,
  },
  restoreButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalNotice: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10,
  },
});
