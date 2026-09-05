import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useBillingStore } from '../stores/billing-store';
import { t } from '../i18n/strings';
import { SubscriptionTier, SafeSubscriptionProduct } from '../../../shared/src/types';

const { width } = Dimensions.get('window');

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

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.GOLD);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (paywallVisible) {
      fetchProducts();
    }
  }, [paywallVisible]);

  useEffect(() => {
    // Select default product for current tier
    const tierProducts = products.filter((p) => p.tier === selectedTier);
    if (tierProducts.length > 0) {
      // Default to 1-month or first product
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
      onRequestClose={closePaywall}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          {/* Header & Close Button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={closePaywall}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.brandTitle}>✨ {t('navPremium')} ✨</Text>
            <Text style={styles.brandSubtitle}>
              Elevate your Tamil Nadu dating journey with exclusive perks
            </Text>
          </View>

          {/* Context Trigger Reason Banner */}
          {banner && (
            <View style={styles.reasonBanner}>
              <Text style={styles.reasonTitle}>⚡ {banner.title}</Text>
              <Text style={styles.reasonDesc}>{banner.desc}</Text>
            </View>
          )}

          {/* Tier Switcher Tabs */}
          <View style={styles.tierSwitcher}>
            <TouchableOpacity
              style={[
                styles.tierTab,
                selectedTier === SubscriptionTier.PLUS && styles.tierTabActivePlus,
              ]}
              onPress={() => setSelectedTier(SubscriptionTier.PLUS)}
            >
              <Text
                style={[
                  styles.tierTabText,
                  selectedTier === SubscriptionTier.PLUS && styles.tierTabTextActive,
                ]}
              >
                Spark Plus
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tierTab,
                selectedTier === SubscriptionTier.GOLD && styles.tierTabActiveGold,
              ]}
              onPress={() => setSelectedTier(SubscriptionTier.GOLD)}
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
                👑 Spark Gold
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
                    isSelected &&
                      (selectedTier === SubscriptionTier.GOLD
                        ? styles.planCardSelectedGold
                        : styles.planCardSelectedPlus),
                  ]}
                  onPress={() => setSelectedProductId(prod.storeProductId)}
                  activeOpacity={0.8}
                >
                  {isThreeMonth && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveBadgeText}>SAVE 22%</Text>
                    </View>
                  )}
                  <Text style={styles.planDuration}>
                    {isThreeMonth ? '3 Months' : '1 Month'}
                  </Text>
                  <Text style={styles.planPrice}>{prod.displayPrice}</Text>
                  <Text style={styles.planSubtext}>
                    {isThreeMonth ? `₹${Math.round(prod.priceAmount / 300)}/mo` : 'Billed monthly'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feature Matrix */}
          <View style={styles.featuresCard}>
            <Text style={styles.featuresHeader}>Included in {selectedTier === SubscriptionTier.GOLD ? 'Spark Gold' : 'Spark Plus'}</Text>

            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>❤️</Text>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{t('unlimitedLikes')}</Text>
                <Text style={styles.featureDesc}>{t('unlimitedLikesDesc')}</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>⏪</Text>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{t('rewindPass')}</Text>
                <Text style={styles.featureDesc}>{t('rewindPassDesc')}</Text>
              </View>
            </View>

            {selectedTier === SubscriptionTier.GOLD && (
              <>
                <View style={styles.featureRow}>
                  <Text style={styles.featureIcon}>👀</Text>
                  <View style={styles.featureInfo}>
                    <Text style={styles.featureTitle}>{t('seeWhoLikedYou')}</Text>
                    <Text style={styles.featureDesc}>{t('seeWhoLikedYouDesc')}</Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <Text style={styles.featureIcon}>🚀</Text>
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
              selectedTier === SubscriptionTier.GOLD
                ? styles.ctaButtonGold
                : styles.ctaButtonPlus,
              isPurchasing && styles.ctaButtonDisabled,
            ]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedProductId}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
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
          >
            {isRestoring ? (
              <ActivityIndicator color="#A78BFA" size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>{t('restorePurchases')}</Text>
            )}
          </TouchableOpacity>

          {/* Legal / INR Notice */}
          <Text style={styles.legalNotice}>
            Prices shown in INR (₹) inclusive of applicable taxes. Auto-renews until canceled in store settings.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0919',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  brandTitle: {
    color: '#F59E0B',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  reasonBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  reasonTitle: {
    color: '#FBBF24',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonDesc: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  tierSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tierTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  tierTabActivePlus: {
    backgroundColor: '#3B82F6',
  },
  tierTabActiveGold: {
    backgroundColor: '#D97706',
  },
  tierTabText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  tierTabTextActive: {
    color: '#FFFFFF',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelectedPlus: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  planCardSelectedGold: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  planDuration: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 6,
  },
  planSubtext: {
    color: '#94A3B8',
    fontSize: 11,
  },
  featuresCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  featuresHeader: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  featureDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  ctaButtonPlus: {
    backgroundColor: '#2563EB',
  },
  ctaButtonGold: {
    backgroundColor: '#D97706',
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 14,
  },
  restoreButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalNotice: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
