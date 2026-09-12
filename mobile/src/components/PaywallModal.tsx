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
import { useBillingStore } from '../stores/billing-store';
import { t } from '../i18n/strings';
import { SubscriptionTier, SafeSubscriptionProduct } from '../../../shared/src/types';
import { Colors } from '../theme/colors';

export const PaywallModal: React.FC = () => {
  const {
    paywallVisible,
    paywallTriggerReason,
    paywallActiveTab,
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
  } = useBillingStore();

  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 36) : 0,
  );

  // Billing duration state: 'MONTHLY' or 'QUARTERLY' (default to best-value Quarterly)
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'QUARTERLY'>('QUARTERLY');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isBrowseMode, setIsBrowseMode] = useState<boolean>(false);

  // Identify if this is an in-the-moment trigger (Focused Mode)
  const isDirectNoteTrigger =
    paywallTriggerReason === 'DIRECT_NOTES' ||
    paywallTriggerReason === 'direct_notes_exceeded';
  const isBoostTrigger =
    paywallTriggerReason === 'BOOST' ||
    paywallTriggerReason === 'profile_boost';
  const isCallTrigger =
    paywallTriggerReason === 'CALL' ||
    paywallTriggerReason === 'vibe_check_complete' ||
    paywallTriggerReason === 'call_pass';
  const isRewindTrigger =
    paywallTriggerReason === 'REWIND_PASS' ||
    paywallTriggerReason === 'rewind_pass';

  const isFocusedMode =
    !isBrowseMode &&
    (isDirectNoteTrigger || isBoostTrigger || isCallTrigger || isRewindTrigger);

  useEffect(() => {
    if (paywallVisible) {
      fetchProducts();
      fetchCreditBalance();
      setIsBrowseMode(false);
    }
  }, [paywallVisible]);

  // Product groups
  const plusMonthly = products.find(
    (p) => p.productKey === 'TRUELOVE_PLUS_1M' || p.productKey === 'SPARK_PLUS_1M',
  );
  const plusQuarterly = products.find(
    (p) => p.productKey === 'TRUELOVE_PLUS_3M' || p.productKey === 'SPARK_PLUS_3M',
  );
  const goldMonthly = products.find(
    (p) => p.productKey === 'TRUELOVE_GOLD_1M' || p.productKey === 'SPARK_GOLD_1M',
  );
  const goldQuarterly = products.find(
    (p) => p.productKey === 'TRUELOVE_GOLD_3M' || p.productKey === 'SPARK_GOLD_3M',
  );

  const directNotePacks = useMemo(
    () =>
      products
        .filter((p) => p.productKey.startsWith('DIRECT_NOTES_'))
        .sort((a, b) => a.priceAmount - b.priceAmount),
    [products],
  );

  const boostPacks = useMemo(
    () =>
      products
        .filter((p) => p.productKey.startsWith('BOOST_PACK_') || p.productKey === 'BOOST_SINGLE')
        .sort((a, b) => a.priceAmount - b.priceAmount),
    [products],
  );

  const callPasses = useMemo(
    () =>
      products
        .filter((p) => p.productKey.startsWith('CALL_PASS_'))
        .sort((a, b) => a.priceAmount - b.priceAmount),
    [products],
  );

  const coinPacks = useMemo(() => {
    const list = products
      .filter((p) => p.productKey.startsWith('COIN_PACK_'))
      .sort((a, b) => a.priceAmount - b.priceAmount);
    if (list.length > 0) return list;

    // Fallback packs for immediate offline / instant display
    return [
      {
        id: 'cp-100',
        storeProductId: 'com.sparkdating.coins.100',
        productKey: 'COIN_PACK_100',
        displayName: '100 Truelove Coins',
        displayPrice: '₹99',
        priceAmount: 99,
        currency: 'INR',
        platform: 'ANDROID' as any,
        description: 'Starter Pack • 99p per coin',
        billingPeriod: null as any,
        tier: 'PACK' as any,
        isActive: true,
      },
      {
        id: 'cp-250',
        storeProductId: 'com.sparkdating.coins.250',
        productKey: 'COIN_PACK_250',
        displayName: '250 Truelove Coins',
        displayPrice: '₹199',
        priceAmount: 199,
        currency: 'INR',
        platform: 'ANDROID' as any,
        description: 'Popular Pack (+25% Extra Bonus)',
        billingPeriod: null as any,
        tier: 'PACK' as any,
        isActive: true,
      },
      {
        id: 'cp-700',
        storeProductId: 'com.sparkdating.coins.700',
        productKey: 'COIN_PACK_700',
        displayName: '700 Truelove Coins',
        displayPrice: '₹499',
        priceAmount: 499,
        currency: 'INR',
        platform: 'ANDROID' as any,
        description: 'Best Value (+40% Extra Bonus)',
        billingPeriod: null as any,
        tier: 'PACK' as any,
        isActive: true,
      },
    ] as unknown as SafeSubscriptionProduct[];
  }, [products]);

  const allProducts = useMemo(() => {
    const existingIds = new Set(products.map((p) => p.storeProductId));
    const merged = [...products];
    for (const cp of coinPacks) {
      if (!existingIds.has(cp.storeProductId)) {
        merged.push(cp);
      }
    }
    return merged;
  }, [products, coinPacks]);

  // Set default selected product intelligently based on context
  useEffect(() => {
    if (isFocusedMode) {
      const popCoin = coinPacks.find((p) => p.productKey === 'COIN_PACK_250') || coinPacks[0];
      if (popCoin && (!selectedProductId || !allProducts.some((p) => p.storeProductId === selectedProductId))) {
        setSelectedProductId(popCoin.storeProductId);
      }
    } else {
      if (paywallActiveTab === 'COINS') {
        const popCoin = coinPacks.find((p) => p.productKey === 'COIN_PACK_250') || coinPacks[0];
        if (popCoin) setSelectedProductId(popCoin.storeProductId);
      } else if (paywallActiveTab === 'SUBSCRIPTIONS') {
        const target =
          billingPeriod === 'QUARTERLY'
            ? goldQuarterly || goldMonthly
            : goldMonthly || goldQuarterly;
        if (target) setSelectedProductId(target.storeProductId);
      } else {
        const firstPack = directNotePacks[0] || boostPacks[0] || coinPacks[0];
        if (firstPack) setSelectedProductId(firstPack.storeProductId);
      }
    }
  }, [
    products,
    allProducts,
    coinPacks,
    isFocusedMode,
    isDirectNoteTrigger,
    isBoostTrigger,
    isCallTrigger,
    paywallActiveTab,
    billingPeriod,
    directNotePacks,
    boostPacks,
    callPasses,
    goldQuarterly,
    goldMonthly,
  ]);

  if (!paywallVisible) return null;

  const selectedProduct = allProducts.find((p) => p.storeProductId === selectedProductId);

  const handlePurchase = async () => {
    if (!selectedProductId) return;
    await purchaseProduct(selectedProductId);
  };

  // Helper for pack description & badges (clean, customer-friendly labels)
  const getUnitInfo = (prod: SafeSubscriptionProduct) => {
    if (prod.productKey.startsWith('COIN_PACK_')) {
      if (prod.productKey === 'COIN_PACK_100') {
        return { label: 'Starter Pack • ~6 Notes or 5 Calls', badge: null, bonus: null };
      }
      if (prod.productKey === 'COIN_PACK_250') {
        return { label: 'Popular Pack • +25% Bonus Coins', badge: '🔥 MOST POPULAR', bonus: '+25% EXTRA' };
      }
      if (prod.productKey === 'COIN_PACK_700') {
        return { label: 'Power Pack • +40% Bonus Coins', badge: '⭐ BEST VALUE', bonus: '+40% EXTRA' };
      }
    }
    if (prod.productKey.startsWith('DIRECT_NOTES_')) {
      if (prod.productKey.includes('5')) {
        return { label: 'Send 5 personal messages', badge: null, bonus: null };
      }
      if (prod.productKey.includes('15')) {
        return { label: 'Send 15 personal messages', badge: 'MOST POPULAR', bonus: null };
      }
      if (prod.productKey.includes('30') || prod.productKey.includes('35')) {
        return { label: 'Send 35 personal messages', badge: 'BEST VALUE', bonus: null };
      }
    }
    if (prod.productKey.startsWith('BOOST_')) {
      if (prod.productKey.includes('SINGLE') || prod.productKey.includes('1')) {
        return { label: '30-min instant reach', badge: null, bonus: null };
      }
      if (prod.productKey.includes('3')) {
        return { label: '3 × 30-min peak boosts', badge: 'SAVE 33% • POPULAR', bonus: null };
      }
    }
    if (prod.productKey.startsWith('CALL_PASS_')) {
      if (prod.productKey.includes('15')) {
        return { label: '15 mins audio & video calling', badge: null, bonus: null };
      }
      if (prod.productKey.includes('45')) {
        return { label: '45 mins audio & video calling', badge: 'POPULAR', bonus: null };
      }
    }
    return { label: prod.description, badge: null, bonus: null };
  };

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
        {/* Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={closePaywall}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          {isFocusedMode && (
            <TouchableOpacity
              onPress={() => setIsBrowseMode(true)}
              style={styles.browseAllBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.browseAllText}>Browse All Plans &gt;</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom, 24) + 90 },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* User Credit Vault Indicator */}
          {creditBalance && (
            <View style={styles.creditVaultCard}>
              <View style={[styles.creditItem, styles.creditItemCoins]}>
                <Text style={styles.creditIcon}>🪙</Text>
                <Text style={styles.creditLabel}>
                  <Text style={styles.creditBold}>{creditBalance.coins ?? 0}</Text> Coins
                </Text>
              </View>
              <View style={styles.creditDivider} />
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

          {/* ========================================================================= */}
          {/* 1. FOCUSED MODE: IN-THE-MOMENT HIGH-INTENT CONTEXTUAL SCREEN               */}
          {/* ========================================================================= */}
          {isFocusedMode ? (
            <View style={styles.focusedContainer}>
              {/* Header Hero */}
              <View style={styles.focusedHeader}>
                <View style={styles.focusedIconCircle}>
                  <Ionicons
                    name={
                      isDirectNoteTrigger
                        ? 'mail'
                        : isBoostTrigger
                          ? 'flash'
                          : isRewindTrigger
                            ? 'refresh-circle'
                            : 'videocam'
                    }
                    size={32}
                    color={Colors.primary}
                  />
                </View>
                <Text style={styles.focusedTitle}>
                  {isDirectNoteTrigger
                    ? 'Stand Out with a Direct Note'
                    : isBoostTrigger
                      ? 'Get 10x More Matches'
                      : isRewindTrigger
                        ? 'Rewind Your Last Swipe'
                        : 'Keep the Chemistry Going!'}
                </Text>
                <Text style={styles.focusedSubtitle}>
                  {isDirectNoteTrigger
                    ? 'Direct Notes appear at the top of their screen with 5x higher reply rates.'
                    : isBoostTrigger
                      ? 'Be the #1 profile in your city for 30 minutes during peak swipe hours.'
                      : isRewindTrigger
                        ? 'Changed your mind? Go back to that profile with just 5 Coins or Truelove Plus.'
                        : 'Grab a Call Pass or unlock Unlimited VIP Calling with Truelove Gold.'}
                </Text>
              </View>

              {/* Focused Coin Cost Banner */}
              <View style={styles.focusedCoinCostBanner}>
                <Text style={styles.focusedCoinCostEmoji}>🪙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.focusedCoinCostTitle}>
                    {isDirectNoteTrigger
                      ? 'Requires 15 Coins per Direct Note'
                      : isBoostTrigger
                        ? 'Requires 30 Coins for 30-min Profile Boost'
                        : isRewindTrigger
                          ? 'Requires 5 Coins to Rewind a Pass'
                          : 'Requires 20 Coins for 15-min Call Pass'}
                  </Text>
                  <Text style={styles.focusedCoinCostSubtitle}>
                    Current Wallet: {creditBalance?.coins ?? 0} Coins • 1-Tap UPI Recharge
                  </Text>
                </View>
              </View>

              {/* Context Pack Cards */}
              <Text style={styles.sectionHeading}>
                Recharge Truelove Coin Wallet
              </Text>

              <View style={styles.packsList}>
                {coinPacks.map((prod) => {
                  const isSelected = selectedProductId === prod.storeProductId;
                  const unitInfo = getUnitInfo(prod);

                  return (
                    <TouchableOpacity
                      key={prod.id}
                      style={[
                        styles.focusedPackCard,
                        isSelected && styles.focusedPackCardSelected,
                      ]}
                      onPress={() => setSelectedProductId(prod.storeProductId)}
                      activeOpacity={0.85}
                    >
                      {unitInfo.badge && (
                        <View style={styles.cardPopularBadge}>
                          <Text style={styles.cardPopularBadgeText}>{unitInfo.badge}</Text>
                        </View>
                      )}

                      <View style={styles.focusedPackRow}>
                        {/* Radio Selector */}
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleSelected,
                          ]}
                        >
                          {isSelected && <View style={styles.radioInner} />}
                        </View>

                        {/* Title & Description */}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.focusedPackTitle}>{prod.displayName}</Text>
                            {unitInfo.bonus && (
                              <View style={styles.bonusPill}>
                                <Text style={styles.bonusPillText}>{unitInfo.bonus}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.focusedPackUnit}>{unitInfo.label}</Text>
                        </View>

                        {/* Total Price */}
                        <Text
                          style={[
                            styles.focusedPackPrice,
                            isSelected && styles.focusedPackPriceSelected,
                          ]}
                        >
                          {prod.displayPrice}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Gold Upsell Anchor Card */}
              {goldQuarterly && (
                <TouchableOpacity
                  style={[
                    styles.goldUpsellCard,
                    selectedProductId === goldQuarterly.storeProductId && styles.goldUpsellCardSelected,
                  ]}
                  onPress={() => setSelectedProductId(goldQuarterly.storeProductId)}
                  activeOpacity={0.85}
                >
                  <View style={styles.goldUpsellBadge}>
                    <Text style={styles.goldUpsellBadgeText}>VIP UNLIMITED ACCESS</Text>
                  </View>
                  <View style={styles.goldUpsellHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goldUpsellTitle}>Truelove Gold</Text>
                      <Text style={styles.goldUpsellPerks}>
                        {isDirectNoteTrigger
                          ? '• Unlimited Direct Notes (Never buy packs again)\n• See Who Liked You + Weekly Free Boosts'
                          : isBoostTrigger
                            ? '• 1 Free Profile Boost every week\n• Unlimited Direct Notes + See Who Liked You'
                            : isRewindTrigger
                              ? '• Unlimited Rewinds on all passes\n• See Who Liked You + Unlimited Likes'
                              : '• Unlimited HD Video & Voice Calls\n• Unlimited Direct Notes + See Who Liked You'}
                      </Text>
                    </View>
                    <View style={styles.goldUpsellPriceBox}>
                      <Text style={styles.goldUpsellMonthlyPrice}>₹399</Text>
                      <Text style={styles.goldUpsellMonthlyLabel}>/ month</Text>
                      <Text style={styles.goldUpsellBilledText}>₹1,199 billed 3-mo</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* Browse All Link */}
              <TouchableOpacity
                onPress={() => setIsBrowseMode(true)}
                style={styles.switchModeLink}
                activeOpacity={0.7}
              >
                <Text style={styles.switchModeLinkText}>
                  View all memberships and instant packs &rarr;
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ========================================================================= */
            /* 2. BROWSE MODE: FULL CATALOG (MEMBERSHIPS & PACKS)                        */
            /* ========================================================================= */
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIconCircle}>
                  <Ionicons name="sparkles" size={28} color={Colors.primary} />
                </View>
                <Text style={styles.brandTitle}>Truelove Premium</Text>
                <Text style={styles.brandSubtitle}>
                  Unlock verified visibility, direct notes, and VIP calls
                </Text>
              </View>

              {/* Segment Switcher (3 Tabs: Coins, VIP Plans, Bundles) */}
              <View style={styles.mainSegmentContainer}>
                <TouchableOpacity
                  style={[
                    styles.mainSegmentBtn,
                    paywallActiveTab === 'COINS' && styles.mainSegmentBtnActive,
                  ]}
                  onPress={() => setPaywallActiveTab('COINS')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, marginRight: 5 }}>🪙</Text>
                  <Text
                    style={[
                      styles.mainSegmentText,
                      paywallActiveTab === 'COINS' && styles.mainSegmentTextActive,
                    ]}
                  >
                    Recharge
                  </Text>
                </TouchableOpacity>

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
                    size={14}
                    color={
                      paywallActiveTab === 'SUBSCRIPTIONS'
                        ? Colors.white
                        : Colors.textSecondary
                    }
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.mainSegmentText,
                      paywallActiveTab === 'SUBSCRIPTIONS' && styles.mainSegmentTextActive,
                    ]}
                  >
                    VIP Plans
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
                    size={14}
                    color={
                      paywallActiveTab === 'PACKS'
                        ? Colors.white
                        : Colors.textSecondary
                    }
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.mainSegmentText,
                      paywallActiveTab === 'PACKS' && styles.mainSegmentTextActive,
                    ]}
                  >
                    Bundles
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: COIN WALLET RECHARGE */}
              {paywallActiveTab === 'COINS' ? (
                <View style={styles.coinRechargeContainer}>
                  {/* Hero Wallet Card */}
                  <View style={styles.coinWalletHero}>
                    <View style={styles.coinWalletHeroRow}>
                      <View style={styles.coinWalletBadge}>
                        <Text style={styles.coinWalletBadgeEmoji}>🪙</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coinWalletBalanceTitle}>
                          {creditBalance?.coins ?? 0} Truelove Coins
                        </Text>
                        <Text style={styles.coinWalletBalanceSubtitle}>
                          Prepaid wallet • Use on any feature • Never expires
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Coin Utility Breakdown */}
                  <Text style={styles.sectionHeading}>Coins Utility Rate</Text>
                  <View style={styles.utilityMatrix}>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>💌</Text>
                      <Text style={styles.utilityChipTitle}>Direct Note</Text>
                      <Text style={styles.utilityChipCost}>15 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>⚡</Text>
                      <Text style={styles.utilityChipTitle}>Profile Boost</Text>
                      <Text style={styles.utilityChipCost}>30 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>📞</Text>
                      <Text style={styles.utilityChipTitle}>15m Call</Text>
                      <Text style={styles.utilityChipCost}>20 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>↩️</Text>
                      <Text style={styles.utilityChipTitle}>Rewind</Text>
                      <Text style={styles.utilityChipCost}>5 🪙</Text>
                    </View>
                  </View>

                  {/* 3 Core Recharge Cards */}
                  <Text style={[styles.sectionHeading, { marginTop: 14 }]}>
                    Select Recharge Amount
                  </Text>
                  <View style={styles.packsList}>
                    {coinPacks.map((prod) => {
                      const isSelected = selectedProductId === prod.storeProductId;
                      const unitInfo = getUnitInfo(prod);
                      const isBestValue = prod.productKey === 'COIN_PACK_700';

                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.coinPackCard,
                            isSelected && styles.coinPackCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(prod.storeProductId)}
                          activeOpacity={0.85}
                        >
                          {unitInfo.badge && (
                            <View
                              style={[
                                styles.cardPopularBadge,
                                isBestValue && { backgroundColor: '#10B981' },
                              ]}
                            >
                              <Text style={styles.cardPopularBadgeText}>
                                {unitInfo.badge}
                              </Text>
                            </View>
                          )}

                          <View style={styles.focusedPackRow}>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>

                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.focusedPackTitle}>{prod.displayName}</Text>
                                {unitInfo.bonus && (
                                  <View style={styles.bonusPill}>
                                    <Text style={styles.bonusPillText}>{unitInfo.bonus}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.focusedPackUnit}>{unitInfo.label}</Text>
                            </View>

                            <Text
                              style={[
                                styles.focusedPackPrice,
                                isSelected && styles.focusedPackPriceSelected,
                              ]}
                            >
                              {prod.displayPrice}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Trust Highlights */}
                  <View style={styles.trustBanner}>
                    <View style={styles.trustItem}>
                      <Ionicons name="flash-outline" size={16} color="#D97706" />
                      <Text style={styles.trustItemText}>Instant UPI</Text>
                    </View>
                    <View style={styles.trustDivider} />
                    <View style={styles.trustItem}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                      <Text style={styles.trustItemText}>No Auto-Debit</Text>
                    </View>
                    <View style={styles.trustDivider} />
                    <View style={styles.trustItem}>
                      <Ionicons name="infinite-outline" size={16} color={Colors.primary} />
                      <Text style={styles.trustItemText}>Never Expires</Text>
                    </View>
                  </View>
                </View>
              ) : paywallActiveTab === 'SUBSCRIPTIONS' ? (
                <>
                  {/* Duration Toggle (1 Month vs 3 Months with Savings) */}
                  <View style={styles.durationToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.durationBtn,
                        billingPeriod === 'MONTHLY' && styles.durationBtnActive,
                      ]}
                      onPress={() => setBillingPeriod('MONTHLY')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          billingPeriod === 'MONTHLY' && styles.durationBtnTextActive,
                        ]}
                      >
                        1 Month
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.durationBtn,
                        billingPeriod === 'QUARTERLY' && styles.durationBtnActive,
                      ]}
                      onPress={() => setBillingPeriod('QUARTERLY')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.durationSaveBadge}>
                        <Text style={styles.durationSaveBadgeText}>SAVE 22%</Text>
                      </View>
                      <Text
                        style={[
                          styles.durationBtnText,
                          billingPeriod === 'QUARTERLY' && styles.durationBtnTextActive,
                        ]}
                      >
                        3 Months
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Membership Cards (Side-by-Side Anchoring: Plus vs Gold) */}
                  <View style={styles.membershipsGrid}>
                    {/* Truelove Gold (Anchor & Best Value) */}
                    {(() => {
                      const goldProd =
                        billingPeriod === 'QUARTERLY' ? goldQuarterly : goldMonthly;
                      if (!goldProd) return null;
                      const isSelected = selectedProductId === goldProd.storeProductId;
                      const monthlyCost =
                        billingPeriod === 'QUARTERLY' ? '₹399' : '₹499';
                      const dailyCost =
                        billingPeriod === 'QUARTERLY' ? '₹13/day' : '₹16/day';

                      return (
                        <TouchableOpacity
                          style={[
                            styles.membershipCard,
                            styles.membershipCardGold,
                            isSelected && styles.membershipCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(goldProd.storeProductId)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.cardHeaderBadgeGold}>
                            <Text style={styles.cardHeaderBadgeTextGold}>
                              MOST POPULAR • BEST DEAL
                            </Text>
                          </View>

                          <View style={styles.membershipCardTop}>
                            <View>
                              <Text style={styles.membershipTitleGold}>Truelove Gold</Text>
                              <Text style={styles.membershipSubtext}>The ultimate VIP experience</Text>
                            </View>
                            <View style={styles.membershipPriceBox}>
                              <Text style={styles.membershipMonthlyPriceGold}>
                                {monthlyCost}
                              </Text>
                              <Text style={styles.membershipMonthlyLabel}>/ mo</Text>
                            </View>
                          </View>

                          <Text style={styles.membershipBillingSubtext}>
                            {billingPeriod === 'QUARTERLY'
                              ? `Billed as ₹1,199 every 3 months (${dailyCost})`
                              : 'Billed monthly. Cancel anytime.'}
                          </Text>

                          <View style={styles.perksList}>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                              <Text style={styles.perkTextBold}>Unlimited Direct Notes</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                              <Text style={styles.perkTextBold}>See Who Liked You (Unblur)</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                              <Text style={styles.perkText}>1 Free Weekly Profile Boost</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                              <Text style={styles.perkText}>Unlimited HD Video & Audio Calls</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                              <Text style={styles.perkText}>Unlimited Swipes & Rewind Pass</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Truelove Plus */}
                    {(() => {
                      const plusProd =
                        billingPeriod === 'QUARTERLY' ? plusQuarterly : plusMonthly;
                      if (!plusProd) return null;
                      const isSelected = selectedProductId === plusProd.storeProductId;
                      const monthlyCost =
                        billingPeriod === 'QUARTERLY' ? '₹233' : '₹299';
                      const dailyCost =
                        billingPeriod === 'QUARTERLY' ? '₹7.7/day' : '₹9.9/day';

                      return (
                        <TouchableOpacity
                          style={[
                            styles.membershipCard,
                            isSelected && styles.membershipCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(plusProd.storeProductId)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.membershipCardTop}>
                            <View>
                              <Text style={styles.membershipTitle}>Truelove Plus</Text>
                              <Text style={styles.membershipSubtext}>Core dating essentials</Text>
                            </View>
                            <View style={styles.membershipPriceBox}>
                              <Text style={styles.membershipMonthlyPrice}>
                                {monthlyCost}
                              </Text>
                              <Text style={styles.membershipMonthlyLabel}>/ mo</Text>
                            </View>
                          </View>

                          <Text style={styles.membershipBillingSubtext}>
                            {billingPeriod === 'QUARTERLY'
                              ? `Billed as ₹699 every 3 months (${dailyCost})`
                              : 'Billed monthly. Cancel anytime.'}
                          </Text>

                          <View style={styles.perksList}>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                              <Text style={styles.perkText}>Unlimited Swipes & Likes</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                              <Text style={styles.perkText}>Rewind Pass (Undo left swipe)</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                              <Text style={styles.perkText}>5 Direct Notes daily</Text>
                            </View>
                            <View style={styles.perkRow}>
                              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                              <Text style={styles.perkText}>5 Super Likes daily</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </>
              ) : (
                /* TAB 2: INSTANT PACKS (CLEAN SECTIONED LIST) */
                <View style={styles.allPacksContainer}>
                  {/* Direct Notes Section */}
                  <View style={styles.packSection}>
                    <View style={styles.packSectionHeader}>
                      <Text style={styles.packSectionTitle}>💌 Direct Note Packs</Text>
                      <Text style={styles.packSectionSubtitle}>
                        Skip the line with a personal note
                      </Text>
                    </View>
                    {directNotePacks.map((prod) => {
                      const isSelected = selectedProductId === prod.storeProductId;
                      const unitInfo = getUnitInfo(prod);
                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.sectionPackCard,
                            isSelected && styles.sectionPackCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(prod.storeProductId)}
                          activeOpacity={0.85}
                        >
                          {unitInfo.badge && (
                            <View style={styles.cardPopularBadge}>
                              <Text style={styles.cardPopularBadgeText}>{unitInfo.badge}</Text>
                            </View>
                          )}
                          <View style={styles.sectionPackRow}>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.sectionPackName}>{prod.displayName}</Text>
                              <Text style={styles.sectionPackUnit}>{unitInfo.label}</Text>
                            </View>
                            <Text
                              style={[
                                styles.sectionPackPrice,
                                isSelected && styles.sectionPackPriceSelected,
                              ]}
                            >
                              {prod.displayPrice}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Profile Boosts Section */}
                  <View style={styles.packSection}>
                    <View style={styles.packSectionHeader}>
                      <Text style={styles.packSectionTitle}>⚡ Profile Boost Packs</Text>
                      <Text style={styles.packSectionSubtitle}>
                        Get 10x visibility for 30 minutes
                      </Text>
                    </View>
                    {boostPacks.map((prod) => {
                      const isSelected = selectedProductId === prod.storeProductId;
                      const unitInfo = getUnitInfo(prod);
                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.sectionPackCard,
                            isSelected && styles.sectionPackCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(prod.storeProductId)}
                          activeOpacity={0.85}
                        >
                          {unitInfo.badge && (
                            <View style={styles.cardPopularBadge}>
                              <Text style={styles.cardPopularBadgeText}>{unitInfo.badge}</Text>
                            </View>
                          )}
                          <View style={styles.sectionPackRow}>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.sectionPackName}>{prod.displayName}</Text>
                              <Text style={styles.sectionPackUnit}>{unitInfo.label}</Text>
                            </View>
                            <Text
                              style={[
                                styles.sectionPackPrice,
                                isSelected && styles.sectionPackPriceSelected,
                              ]}
                            >
                              {prod.displayPrice}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Call Passes Section */}
                  <View style={styles.packSection}>
                    <View style={styles.packSectionHeader}>
                      <Text style={styles.packSectionTitle}>📞 Call Passes</Text>
                      <Text style={styles.packSectionSubtitle}>
                        Extend video & audio calls with mutual matches
                      </Text>
                    </View>
                    {callPasses.map((prod) => {
                      const isSelected = selectedProductId === prod.storeProductId;
                      const unitInfo = getUnitInfo(prod);
                      return (
                        <TouchableOpacity
                          key={prod.id}
                          style={[
                            styles.sectionPackCard,
                            isSelected && styles.sectionPackCardSelected,
                          ]}
                          onPress={() => setSelectedProductId(prod.storeProductId)}
                          activeOpacity={0.85}
                        >
                          {unitInfo.badge && (
                            <View style={styles.cardPopularBadge}>
                              <Text style={styles.cardPopularBadgeText}>{unitInfo.badge}</Text>
                            </View>
                          )}
                          <View style={styles.sectionPackRow}>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.sectionPackName}>{prod.displayName}</Text>
                              <Text style={styles.sectionPackUnit}>{unitInfo.label}</Text>
                            </View>
                            <Text
                              style={[
                                styles.sectionPackPrice,
                                isSelected && styles.sectionPackPriceSelected,
                              ]}
                            >
                              {prod.displayPrice}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Legal / INR Guarantee */}
          <Text style={styles.legalNotice}>
            All transactions are processed securely in INR (₹). Auto-renewable subscriptions can be canceled anytime via Google Play / App Store.
          </Text>

          {/* Subtle Bottom Restore Purchases Link (Compliant with Apple / Google Store Review) */}
          <TouchableOpacity
            style={styles.restoreLinkContainer}
            onPress={restorePurchases}
            disabled={isRestoring}
            activeOpacity={0.6}
          >
            {isRestoring ? (
              <ActivityIndicator color={Colors.textSecondary} size="small" />
            ) : (
              <Text style={styles.restoreLinkText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Sticky Primary Purchase CTA Bar */}
        <View
          style={[
            styles.stickyBottomBar,
            { paddingBottom: Math.max(insets.bottom, 12) + 6 },
          ]}
        >
          <TouchableOpacity
            style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedProductId}
            activeOpacity={0.88}
          >
            {isPurchasing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.ctaButtonText}>
                {selectedProduct
                  ? selectedProduct.productKey.startsWith('COIN_PACK_')
                    ? `Recharge Now • ${selectedProduct.displayPrice}`
                    : `Continue • ${selectedProduct.displayPrice}`
                  : 'Select an Option'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSecondary,
  },
  browseAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Credit Vault Bar */
  creditVaultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  creditItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditIcon: {
    fontSize: 15,
    marginRight: 6,
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
    backgroundColor: Colors.border,
  },

  /* Focused Mode */
  focusedContainer: {
    marginTop: 4,
  },
  focusedHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  focusedIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  focusedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  focusedSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  packsList: {
    marginBottom: 16,
  },
  focusedPackCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  focusedPackCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  cardPopularBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  cardPopularBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  focusedPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  focusedPackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  focusedPackUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  focusedPackPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  focusedPackPriceSelected: {
    color: Colors.primary,
  },

  /* Gold Upsell Anchor Card */
  goldUpsellCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 16,
    position: 'relative',
  },
  goldUpsellCardSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  goldUpsellBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  goldUpsellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.6,
  },
  goldUpsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  goldUpsellTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  goldUpsellPerks: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  goldUpsellPriceBox: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  goldUpsellMonthlyPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#92400E',
  },
  goldUpsellMonthlyLabel: {
    fontSize: 11,
    color: '#78350F',
    marginTop: -2,
  },
  goldUpsellBilledText: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 2,
  },
  switchModeLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  switchModeLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Browse Mode Header */
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  /* Segment Switcher */
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
    paddingVertical: 9,
    borderRadius: 10,
  },
  mainSegmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  mainSegmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  mainSegmentTextActive: {
    color: Colors.white,
  },

  /* Duration Toggle */
  durationToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    position: 'relative',
  },
  durationBtnActive: {
    backgroundColor: Colors.backgroundSecondary,
  },
  durationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  durationBtnTextActive: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  durationSaveBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationSaveBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.white,
  },

  /* Memberships Cards */
  membershipsGrid: {
    gap: 12,
  },
  membershipCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  membershipCardGold: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFCF2',
    position: 'relative',
  },
  membershipCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  cardHeaderBadgeGold: {
    position: 'absolute',
    top: -10,
    left: 16,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardHeaderBadgeTextGold: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  membershipCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  membershipTitleGold: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400E',
  },
  membershipTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  membershipSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  membershipPriceBox: {
    alignItems: 'flex-end',
  },
  membershipMonthlyPriceGold: {
    fontSize: 22,
    fontWeight: '900',
    color: '#92400E',
  },
  membershipMonthlyPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  membershipMonthlyLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  membershipBillingSubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginVertical: 8,
  },
  perksList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 6,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perkText: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  perkTextBold: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 8,
  },

  /* All Packs Sectioned List */
  allPacksContainer: {
    gap: 16,
  },
  packSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  packSectionHeader: {
    marginBottom: 10,
  },
  packSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  packSectionSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  sectionPackCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  sectionPackCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.05)',
  },
  sectionPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionPackName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sectionPackUnit: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  sectionPackPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionPackPriceSelected: {
    color: Colors.primary,
  },

  /* Sticky Bottom CTA Bar */
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  restoreLinkContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 80,
  },
  restoreLinkText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  legalNotice: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  creditItemCoins: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  focusedCoinCostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  focusedCoinCostEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  focusedCoinCostTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  focusedCoinCostSubtitle: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  coinRechargeContainer: {
    marginBottom: 10,
  },
  coinWalletHero: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coinWalletHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinWalletBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coinWalletBadgeEmoji: {
    fontSize: 22,
  },
  coinWalletBalanceTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  coinWalletBalanceSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  utilityMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  utilityChip: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  utilityChipEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  utilityChipTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  utilityChipCost: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  coinPackCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  coinPackCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  coinPackCardPopular: {
    borderColor: '#F59E0B',
  },
  bonusPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  bonusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.3,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    marginBottom: 10,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  trustDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
});
