import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBillingStore } from '../src/stores/billing-store';
import { PaywallModal } from '../src/components/PaywallModal';
import { t } from '../src/i18n/strings';
import { SubscriptionTier } from '../../shared/src/types';

export default function PremiumScreen() {
  const router = useRouter();
  const {
    billingStatus,
    isLoading,
    fetchBillingStatus,
    openPaywall,
    cancelSubscription,
    restorePurchases,
    isRestoring,
  } = useBillingStore();

  useEffect(() => {
    fetchBillingStatus();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaywallModal />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← {t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{t('navPremium')}</Text>
        </View>

        {isLoading && !billingStatus ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#F59E0B" size="large" />
          </View>
        ) : (
          <>
            {/* Membership Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusBadgeRow}>
                <Text style={styles.tierEmoji}>
                  {tier === SubscriptionTier.GOLD
                    ? '👑'
                    : tier === SubscriptionTier.PLUS
                    ? '⚡'
                    : '🌱'}
                </Text>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierName}>
                    {tier === SubscriptionTier.GOLD
                      ? t('goldTier')
                      : tier === SubscriptionTier.PLUS
                      ? t('plusTier')
                      : t('freeTier')}
                  </Text>
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
                  activeOpacity={0.8}
                >
                  <Text style={styles.upgradeBtnText}>🚀 {t('upgradeToGold')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.activeBanner}>
                  <Text style={styles.activeBannerText}>✓ Active Membership</Text>
                </View>
              )}
            </View>

            {/* Active Capabilities / Entitlements */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Active Capabilities</Text>

              {billingStatus?.entitlements &&
              billingStatus.entitlements.length > 0 ? (
                billingStatus.entitlements.map((ent) => (
                  <View key={ent.id} style={styles.entitlementRow}>
                    <Text style={styles.entitlementCheck}>✓</Text>
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
                  <Text style={styles.emptyEntitlementsText}>
                    Free tier: 25 likes/day, standard matching & persistent chat.
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
                >
                  <Text style={styles.actionCardTitle}>Explore Spark Plus & Gold Plans</Text>
                  <Text style={styles.actionCardSub}>
                    Plans start from ₹299/month with INR pricing
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelCard}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelCardTitle}>{t('cancelSubscription')}</Text>
                  <Text style={styles.cancelCardSub}>{t('cancelSubscriptionDesc')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={restorePurchases}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <ActivityIndicator color="#A78BFA" size="small" />
                ) : (
                  <Text style={styles.restoreBtnText}>{t('restorePurchases')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0919',
  },
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierEmoji: {
    fontSize: 36,
    marginRight: 14,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  tierSubtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 3,
  },
  upgradeBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  activeBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeBannerText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  entitlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  entitlementCheck: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 12,
  },
  entitlementTextGroup: {
    flex: 1,
  },
  entitlementKey: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  entitlementSource: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  emptyEntitlements: {
    paddingVertical: 10,
  },
  emptyEntitlementsText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  actionsGroup: {
    gap: 14,
  },
  actionCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  actionCardTitle: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '700',
  },
  actionCardSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  cancelCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  cancelCardTitle: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelCardSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreBtnText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
