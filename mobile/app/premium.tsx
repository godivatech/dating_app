import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBillingStore } from '../src/stores/billing-store';
import { WalletPassbookModal } from '../src/components/WalletPassbookModal';
import { t } from '../src/i18n/strings';
import { SubscriptionTier } from '../../shared/src/types';
import { Colors } from '../src/theme/colors';

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showPassbookModal, setShowPassbookModal] = useState(false);
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 36) : 0,
  );
  const {
    billingStatus,
    creditBalance,
    isLoading,
    fetchBillingStatus,
    fetchCreditBalance,
    openPaywall,
    cancelSubscription,
    restorePurchases,
    isRestoring,
  } = useBillingStore();

  useEffect(() => {
    fetchBillingStatus();
    fetchCreditBalance();
  }, []);

  const handleCancel = () => {
    Alert.alert(
      t('cancelSubscription'),
      'Are you sure you want to cancel auto-renewal? You will keep your premium benefits until your current billing period ends.',
      [
        { text: 'Keep Benefits', style: 'cancel' },
        {
          text: 'Cancel Auto-Renewal',
          style: 'destructive',
          onPress: async () => {
            const success = await cancelSubscription();
            if (success) {
              Alert.alert('Success', 'Auto-renewal has been canceled. Your benefits remain active until expiration.');
            }
          },
        },
      ],
    );
  };

  const isSubscribed = billingStatus?.isSubscribed;
  const tier = billingStatus?.tier || SubscriptionTier.FREE;

  const renderTierIcon = () => {
    if (tier === SubscriptionTier.GOLD) {
      return (
        <View style={[styles.tierIconContainer, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="sparkles" size={26} color="#D97706" />
        </View>
      );
    }
    if (tier === SubscriptionTier.PLUS) {
      return (
        <View style={[styles.tierIconContainer, { backgroundColor: Colors.primaryLight }]}>
          <Ionicons name="flash" size={26} color={Colors.primary} />
        </View>
      );
    }
    return (
      <View style={[styles.tierIconContainer, { backgroundColor: Colors.surfaceLight }]}>
        <Ionicons name="shield-outline" size={26} color={Colors.textSecondary} />
      </View>
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: topInset + 6 }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{t('navPremium')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading && !billingStatus ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Membership Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusBadgeRow}>
                {renderTierIcon()}
                <View style={styles.tierInfo}>
                  <View style={styles.tierNameRow}>
                    <Text style={styles.tierName}>
                      {tier === SubscriptionTier.GOLD
                        ? t('goldTier')
                        : tier === SubscriptionTier.PLUS
                        ? t('plusTier')
                        : t('freeTier')}
                    </Text>
                    {isSubscribed && (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.tierSubtitle}>
                    {isSubscribed
                      ? t('subscribedUntil', {
                          date: billingStatus?.activeSubscription?.expiresAt
                            ? new Date(
                                billingStatus.activeSubscription.expiresAt,
                              ).toLocaleDateString()
                            : '',
                        })
                      : t('dailyLikesLeft', {
                          count: billingStatus?.dailyLikesRemaining ?? 25,
                        })}
                  </Text>
                </View>
              </View>

              {!isSubscribed ? (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => openPaywall()}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={16} color={Colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.upgradeBtnText}>{t('upgradeToGold')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.activeBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} style={{ marginRight: 6 }} />
                  <Text style={styles.activeBannerText}>Active Membership</Text>
                </View>
              )}
            </View>

            {/* Truelove Prepaid Coin Wallet & Consumable Credits */}
            <View style={styles.coinVaultCard}>
              <View style={styles.coinVaultHeader}>
                <View style={styles.coinVaultIconBox}>
                  <Text style={{ fontSize: 20 }}>🪙</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coinVaultTitle}>Truelove Coin Wallet</Text>
                  <Text style={styles.coinVaultSub}>
                    Prepaid wallet for 1-tap micro-recharges
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.passbookPillBtn}
                    onPress={() => setShowPassbookModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="receipt-outline" size={12} color="#475569" style={{ marginRight: 3 }} />
                    <Text style={styles.passbookPillText}>Passbook</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rechargePillBtn}
                    onPress={() => openPaywall('COINS')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flash" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.rechargePillText}>Recharge</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.coinVaultBalanceBox}>
                <Text style={styles.coinVaultBalanceValue}>
                  🪙 {creditBalance?.coins ?? 0}
                </Text>
                <Text style={styles.coinVaultBalanceLabel}>
                  Coins Available • Instant UPI
                </Text>
              </View>

              {/* Consumable Balances Row */}
              <View style={styles.consumablesGrid}>
                <View style={styles.consumableItem}>
                  <Text style={styles.consumableCount}>{creditBalance?.directNotes ?? 0}</Text>
                  <Text style={styles.consumableLabel}>Direct Notes</Text>
                </View>
                <View style={styles.consumableItem}>
                  <Text style={styles.consumableCount}>{creditBalance?.profileBoosts ?? 0}</Text>
                  <Text style={styles.consumableLabel}>Profile Boosts</Text>
                </View>
                <View style={styles.consumableItem}>
                  <Text style={styles.consumableCount}>{creditBalance?.callPassMinutes ?? 0}m</Text>
                  <Text style={styles.consumableLabel}>Call Minutes</Text>
                </View>
              </View>
            </View>

            {/* Active Capabilities / Entitlements */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Active Capabilities</Text>

              {billingStatus?.entitlements &&
              billingStatus.entitlements.length > 0 ? (
                billingStatus.entitlements.map((ent) => (
                  <View key={ent.id} style={styles.entitlementRow}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={{ marginRight: 12 }} />
                    <View style={styles.entitlementTextGroup}>
                      <Text style={styles.entitlementKey}>{ent.entitlementKey}</Text>
                      <Text style={styles.entitlementSource}>
                        Source: {ent.source} • Unlocked
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyEntitlements}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} style={{ marginRight: 10 }} />
                  <Text style={styles.emptyEntitlementsText}>
                    Free tier: 25 likes/day, standard discovery & persistent chat.
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsGroup}>
              {!isSubscribed ? (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => openPaywall('view_plans')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionCardHeader}>
                    <View style={styles.actionIconBox}>
                      <Ionicons name="card-outline" size={20} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionCardTitle}>Explore Truelove Plus & Gold Plans</Text>
                      <Text style={styles.actionCardSub}>
                        Plans start from ₹299/month with regional pricing
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelCard}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelCardTitle}>{t('cancelSubscription')}</Text>
                  <Text style={styles.cancelCardSub}>{t('cancelSubscriptionDesc')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={restorePurchases}
                disabled={isRestoring}
                activeOpacity={0.7}
              >
                {isRestoring ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Text style={styles.restoreBtnText}>{t('restorePurchases')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Truelove Wallet Passbook Modal */}
      <WalletPassbookModal
        visible={showPassbookModal}
        onClose={() => setShowPassbookModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 38,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  tierIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tierInfo: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierName: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  activePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activePillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  upgradeBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  activeBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
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
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  entitlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  entitlementTextGroup: {
    flex: 1,
  },
  entitlementKey: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  entitlementSource: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyEntitlements: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  emptyEntitlementsText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  actionsGroup: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionCardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  actionCardSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  cancelCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  cancelCardTitle: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelCardSub: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  restoreBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  coinVaultCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  coinVaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinVaultIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  coinVaultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  coinVaultSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  passbookPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  passbookPillText: {
    color: '#78350F',
    fontSize: 11.5,
    fontWeight: '700',
  },
  rechargePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rechargePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  coinVaultBalanceBox: {
    backgroundColor: '#FEF9C3',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE047',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinVaultBalanceValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#78350F',
  },
  coinVaultBalanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  consumablesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  consumableItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  consumableCount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  consumableLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
  },
});
