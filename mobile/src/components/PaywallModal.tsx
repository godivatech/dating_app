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
    paywallTriggerReason === 'direct_notes_exceeded' ||
    paywallTriggerReason === 'SUPER_LIKE';
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
  const isPassportTrigger =
    paywallTriggerReason === 'PASSPORT' ||
    paywallTriggerReason === 'city_passport' ||
    paywallTriggerReason === 'target_city';

  const isFocusedMode =
    !isBrowseMode &&
    (isDirectNoteTrigger ||
      isBoostTrigger ||
      isCallTrigger ||
      isRewindTrigger ||
      isPassportTrigger);

  useEffect(() => {
    if (paywallVisible) {
      fetchProducts();
      fetchCreditBalance();
      setIsBrowseMode(false);
    }
  }, [paywallVisible]);

  // Guaranteed Fallback Subscriptions so VIP Plans cards NEVER disappear or return null
  const plusMonthly: SafeSubscriptionProduct = useMemo(() => {
    return (
      products.find(
        (p) => p.productKey === 'TRUELOVE_PLUS_1M' || p.productKey === 'SPARK_PLUS_1M',
      ) || {
        id: 'fallback-plus-1m',
        storeProductId: 'com.truelove.plus.1m',
        productKey: 'TRUELOVE_PLUS_1M',
        displayName: 'Truelove Plus',
        displayPrice: '₹299',
        priceAmount: 299,
        currency: 'INR',
        tier: SubscriptionTier.PLUS,
        billingPeriod: 'MONTHLY' as any,
        isActive: true,
        platform: Platform.OS === 'ios' ? ('IOS' as any) : ('ANDROID' as any),
        description: 'Core dating essentials: unlimited likes & rewinds',
      }
    );
  }, [products]);

  const plusQuarterly: SafeSubscriptionProduct = useMemo(() => {
    return (
      products.find(
        (p) => p.productKey === 'TRUELOVE_PLUS_3M' || p.productKey === 'SPARK_PLUS_3M',
      ) || {
        id: 'fallback-plus-3m',
        storeProductId: 'com.truelove.plus.3m',
        productKey: 'TRUELOVE_PLUS_3M',
        displayName: 'Truelove Plus (3 Months)',
        displayPrice: '₹699',
        priceAmount: 699,
        currency: 'INR',
        tier: SubscriptionTier.PLUS,
        billingPeriod: 'QUARTERLY' as any,
        isActive: true,
        platform: Platform.OS === 'ios' ? ('IOS' as any) : ('ANDROID' as any),
        description: 'Save 22% • ₹233/month billed quarterly',
      }
    );
  }, [products]);

  const goldMonthly: SafeSubscriptionProduct = useMemo(() => {
    return (
      products.find(
        (p) => p.productKey === 'TRUELOVE_GOLD_1M' || p.productKey === 'SPARK_GOLD_1M',
      ) || {
        id: 'fallback-gold-1m',
        storeProductId: 'com.truelove.gold.1m',
        productKey: 'TRUELOVE_GOLD_1M',
        displayName: 'Truelove Gold VIP',
        displayPrice: '₹499',
        priceAmount: 499,
        currency: 'INR',
        tier: SubscriptionTier.GOLD,
        billingPeriod: 'MONTHLY' as any,
        isActive: true,
        platform: Platform.OS === 'ios' ? ('IOS' as any) : ('ANDROID' as any),
        description: 'The ultimate VIP experience: see likes, passport mode & unlimited notes',
      }
    );
  }, [products]);

  const goldQuarterly: SafeSubscriptionProduct = useMemo(() => {
    return (
      products.find(
        (p) => p.productKey === 'TRUELOVE_GOLD_3M' || p.productKey === 'SPARK_GOLD_3M',
      ) || {
        id: 'fallback-gold-3m',
        storeProductId: 'com.truelove.gold.3m',
        productKey: 'TRUELOVE_GOLD_3M',
        displayName: 'Truelove Gold VIP (3 Months)',
        displayPrice: '₹1,199',
        priceAmount: 1199,
        currency: 'INR',
        tier: SubscriptionTier.GOLD,
        billingPeriod: 'QUARTERLY' as any,
        isActive: true,
        platform: Platform.OS === 'ios' ? ('IOS' as any) : ('ANDROID' as any),
        description: 'Best deal • ₹399/month billed quarterly',
      }
    );
  }, [products]);

  const coinPacks = useMemo(() => {
    const list = products
      .filter((p) => p.productKey.startsWith('COIN_PACK_'))
      .sort((a, b) => a.priceAmount - b.priceAmount);
    if (list.length > 0) return list;

    // Fallback packs for immediate offline / instant display
    return [
      {
        id: 'cp-100',
        storeProductId: 'com.truelove.coins.100',
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
        storeProductId: 'com.truelove.coins.250',
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
        storeProductId: 'com.truelove.coins.700',
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
    const guaranteed = [
      plusMonthly,
      plusQuarterly,
      goldMonthly,
      goldQuarterly,
      ...coinPacks,
    ];
    for (const item of guaranteed) {
      if (!existingIds.has(item.storeProductId)) {
        merged.push(item);
        existingIds.add(item.storeProductId);
      }
    }
    return merged;
  }, [products, plusMonthly, plusQuarterly, goldMonthly, goldQuarterly, coinPacks]);

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
          billingPeriod === 'QUARTERLY' ? goldQuarterly : goldMonthly;
        if (target) setSelectedProductId(target.storeProductId);
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
    isPassportTrigger,
    paywallActiveTab,
    billingPeriod,
    goldQuarterly,
    goldMonthly,
  ]);

  const handleSelectPeriod = (period: 'MONTHLY' | 'QUARTERLY') => {
    setBillingPeriod(period);
    const isPlusSelected =
      selectedProductId === plusMonthly.storeProductId ||
      selectedProductId === plusQuarterly.storeProductId;
    if (isPlusSelected) {
      setSelectedProductId(
        period === 'QUARTERLY' ? plusQuarterly.storeProductId : plusMonthly.storeProductId,
      );
    } else {
      setSelectedProductId(
        period === 'QUARTERLY' ? goldQuarterly.storeProductId : goldMonthly.storeProductId,
      );
    }
  };

  if (!paywallVisible) return null;

  const selectedProduct = allProducts.find((p) => p.storeProductId === selectedProductId);

  const handlePurchase = async () => {
    if (!selectedProductId) return;
    await purchaseProduct(selectedProductId);
  };

  // Helper to extract clean coin pack title without duplicated badge text
  const getCoinTitle = (prod: SafeSubscriptionProduct) => {
    if (prod.productKey === 'COIN_PACK_100') return '100 Coins';
    if (prod.productKey === 'COIN_PACK_250') return '250 Coins';
    if (prod.productKey === 'COIN_PACK_700') return '700 Coins';
    return prod.displayName.replace(/\s*\(\+.*?\)/g, '').replace(/\s*\(Starter\)/g, '');
  };

  // Helper for pack description & badges (clean, customer-friendly labels)
  const getUnitInfo = (prod: SafeSubscriptionProduct) => {
    if (prod.productKey.startsWith('COIN_PACK_')) {
      if (prod.productKey === 'COIN_PACK_100') {
        return { label: 'Starter Pack • ~6 Notes or 5 Calls', badge: null, bonus: null };
      }
      if (prod.productKey === 'COIN_PACK_250') {
        return { label: 'Popular Pack • ~16 Notes or 12 Calls', badge: 'MOST POPULAR', bonus: '+25% Extra' };
      }
      if (prod.productKey === 'COIN_PACK_700') {
        return { label: 'Power Pack • ~46 Notes or 35 Calls', badge: 'BEST VALUE', bonus: '+40% Extra' };
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
          {creditBalance !== null && (
            <View style={styles.creditVaultCard}>
              <View style={styles.creditItemCoins}>
                <Text style={styles.creditCoinEmoji}>🪙</Text>
                <View>
                  <Text style={styles.creditCoinsAmount}>
                    {creditBalance?.coins ?? 0} <Text style={styles.creditCoinsUnit}>Coins</Text>
                  </Text>
                  <Text style={styles.creditCoinsSub}>Wallet Balance</Text>
                </View>
              </View>
              <View style={styles.creditQuickRates}>
                <Text style={styles.creditRateTag}>15c Note</Text>
                <Text style={styles.creditRateTag}>30c Boost</Text>
                <Text style={styles.creditRateTag}>20c Call</Text>
                <Text style={styles.creditRateTag}>30c City</Text>
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
                            : isPassportTrigger
                              ? 'airplane'
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
                        : isPassportTrigger
                          ? 'Date Singles in Any City'
                          : 'Keep the Chemistry Going!'}
                </Text>
                <Text style={styles.focusedSubtitle}>
                  {isDirectNoteTrigger
                    ? 'Direct Notes appear at the top of their screen with 5x higher reply rates.'
                    : isBoostTrigger
                      ? 'Be the #1 profile in your city for 30 minutes during peak swipe hours.'
                      : isRewindTrigger
                        ? 'Changed your mind? Go back to that profile with just 5 Coins or Truelove Plus.'
                        : isPassportTrigger
                          ? 'Passport Mode lets you explore, match, and date in any city worldwide.'
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
                          : isPassportTrigger
                            ? 'Requires 30 Coins per City Trip'
                            : 'Requires 20 Coins for 15-min Call Pass'}
                  </Text>
                  <Text style={styles.focusedCoinCostSubtitle}>
                    Current Wallet: {creditBalance?.coins ?? 0} Coins • 1-Tap Instant UPI Recharge
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
                        <View
                          style={[
                            styles.cardTopRibbon,
                            prod.productKey === 'COIN_PACK_700'
                              ? styles.cardTopRibbonBestValue
                              : styles.cardTopRibbonPopular,
                          ]}
                        >
                          <Text style={styles.cardTopRibbonText}>{unitInfo.badge}</Text>
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

                        {/* Title & Description Column */}
                        <View style={styles.packContentColumn}>
                          <View style={styles.packTitleRow}>
                            <Text style={styles.focusedPackTitle} numberOfLines={1}>
                              {getCoinTitle(prod)}
                            </Text>
                            {unitInfo.bonus && (
                              <View style={styles.bonusPill}>
                                <Text style={styles.bonusPillText}>{unitInfo.bonus}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.focusedPackUnit} numberOfLines={1}>
                            {unitInfo.label}
                          </Text>
                        </View>

                        {/* Total Price Column */}
                        <View style={styles.packPriceColumn}>
                          <Text
                            style={[
                              styles.focusedPackPrice,
                              isSelected && styles.focusedPackPriceSelected,
                            ]}
                          >
                            {prod.displayPrice}
                          </Text>
                        </View>
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
                  <View style={styles.goldUpsellBody}>
                    <View style={styles.goldUpsellHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goldUpsellTitle}>Truelove Gold VIP</Text>
                        <Text style={styles.goldUpsellPerks}>
                          {isDirectNoteTrigger
                            ? '• Unlimited Direct Notes (Never spend coins on notes)\n• See Who Liked You + Weekly Free Boosts'
                            : isBoostTrigger
                              ? '• 1 Free Profile Boost every week (₹99 value)\n• Unlimited Direct Notes + See Who Liked You'
                              : isRewindTrigger
                                ? '• Unlimited Rewinds on all passes\n• See Who Liked You + Unlimited Likes'
                                : isPassportTrigger
                                  ? '• Unlimited Target City Passport Included\n• See Who Liked You + Unlimited Direct Notes'
                                  : '• Unlimited HD Video & Voice Calls\n• Unlimited Direct Notes + See Who Liked You'}
                        </Text>
                      </View>
                      <View style={styles.goldUpsellPriceBox}>
                        <Text style={styles.goldUpsellMonthlyPrice}>₹399</Text>
                        <Text style={styles.goldUpsellMonthlyLabel}>/ month</Text>
                        <Text style={styles.goldUpsellBilledText}>₹1,199 billed 3-mo</Text>
                      </View>
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
                  Explore VIP Plans & Coin Wallet &rarr;
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

              {/* Segment Switcher (2 Tabs: Coins & VIP Plans) */}
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
                    Coin Recharge
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
                    name="sparkles"
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
                          Prepaid wallet • Use on notes, boosts, calls & travel • Never expires
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Coin Utility Breakdown */}
                  <Text style={styles.sectionHeading}>Coins Utility Rate</Text>
                  <View style={styles.utilityMatrix}>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>💌</Text>
                      <Text style={styles.utilityChipTitle} numberOfLines={1}>Direct Note</Text>
                      <Text style={styles.utilityChipCost}>15 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>⚡</Text>
                      <Text style={styles.utilityChipTitle} numberOfLines={1}>Boost</Text>
                      <Text style={styles.utilityChipCost}>30 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>📞</Text>
                      <Text style={styles.utilityChipTitle} numberOfLines={1}>15m Call</Text>
                      <Text style={styles.utilityChipCost}>20 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>✈️</Text>
                      <Text style={styles.utilityChipTitle} numberOfLines={1}>Passport</Text>
                      <Text style={styles.utilityChipCost}>30 🪙</Text>
                    </View>
                    <View style={styles.utilityChip}>
                      <Text style={styles.utilityChipEmoji}>↩️</Text>
                      <Text style={styles.utilityChipTitle} numberOfLines={1}>Rewind</Text>
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
                                styles.cardTopRibbon,
                                isBestValue
                                  ? styles.cardTopRibbonBestValue
                                  : styles.cardTopRibbonPopular,
                              ]}
                            >
                              <Text style={styles.cardTopRibbonText}>
                                {unitInfo.badge}
                              </Text>
                            </View>
                          )}

                          <View style={styles.coinPackCardBody}>
                            <View
                              style={[
                                styles.radioCircle,
                                isSelected && styles.radioCircleSelected,
                              ]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>

                            <View style={styles.packContentColumn}>
                              <View style={styles.packTitleRow}>
                                <Text style={styles.focusedPackTitle} numberOfLines={1}>
                                  {getCoinTitle(prod)}
                                </Text>
                                {unitInfo.bonus && (
                                  <View style={styles.bonusPill}>
                                    <Text style={styles.bonusPillText}>{unitInfo.bonus}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.focusedPackUnit} numberOfLines={1}>
                                {unitInfo.label}
                              </Text>
                            </View>

                            <View style={styles.packPriceColumn}>
                              <Text
                                style={[
                                  styles.focusedPackPrice,
                                  isSelected && styles.focusedPackPriceSelected,
                                ]}
                              >
                                {prod.displayPrice}
                              </Text>
                            </View>
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
              ) : (
                /* TAB 2: VIP PLANS (SUBSCRIPTIONS) */
                <View style={styles.vipPlansContainer}>
                  {/* Duration Toggle (1 Month vs 3 Months with Savings) */}
                  <View style={styles.durationToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.durationBtn,
                        billingPeriod === 'MONTHLY' && styles.durationBtnActive,
                      ]}
                      onPress={() => handleSelectPeriod('MONTHLY')}
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
                      onPress={() => handleSelectPeriod('QUARTERLY')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.durationBtnInner}>
                        <Text
                          style={[
                            styles.durationBtnText,
                            billingPeriod === 'QUARTERLY' && styles.durationBtnTextActive,
                          ]}
                        >
                          3 Months
                        </Text>
                        <View style={styles.durationSaveBadgeInline}>
                          <Text style={styles.durationSaveBadgeText}>SAVE 22%</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Membership Cards (Side-by-Side Anchoring: Plus vs Gold) */}
                  <View style={styles.membershipsGrid}>
                    {/* Truelove Gold VIP (Anchor & Best Value) */}
                    {(() => {
                      const goldProd =
                        billingPeriod === 'QUARTERLY' ? goldQuarterly : goldMonthly;
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
                          <View style={styles.membershipTopRibbonGold}>
                            <Text style={styles.membershipTopRibbonTextGold}>
                              👑 MOST POPULAR • BEST DEAL
                            </Text>
                          </View>

                          <View style={styles.membershipCardBody}>
                            <View style={styles.membershipCardTop}>
                              <View>
                                <Text style={styles.membershipTitleGold}>Truelove Gold VIP</Text>
                                <Text style={styles.membershipSubtext}>The ultimate all-inclusive experience</Text>
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
                                <Ionicons name="airplane" size={16} color="#D97706" />
                                <Text style={styles.perkTextBold}>Target City Passport (Date in Any City Worldwide)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="eye" size={16} color="#D97706" />
                                <Text style={styles.perkTextBold}>See Who Liked You (Instant Mutual Match)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="mail" size={16} color="#D97706" />
                                <Text style={styles.perkTextBold}>Unlimited Direct Notes (Skip the Line)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="flash" size={16} color="#D97706" />
                                <Text style={styles.perkTextBold}>1 Free Weekly Profile Boost (₹99 value)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="videocam" size={16} color="#D97706" />
                                <Text style={styles.perkText}>Unlimited HD Video & Audio Calls</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="infinite" size={16} color="#D97706" />
                                <Text style={styles.perkText}>Unlimited Swipes & Rewind Pass</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="shield-checkmark" size={16} color="#D97706" />
                                <Text style={styles.perkText}>VIP Gold Profile Badge & 10x Priority Views</Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}

                    {/* Truelove Plus */}
                    {(() => {
                      const plusProd =
                        billingPeriod === 'QUARTERLY' ? plusQuarterly : plusMonthly;
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
                          <View style={styles.membershipCardBody}>
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
                                <Text style={styles.perkTextBold}>Unlimited Swipes & Likes (No 25 limit)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="refresh-circle" size={16} color={Colors.primary} />
                                <Text style={styles.perkText}>Unlimited Rewind Pass (Undo passes)</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="mail" size={16} color={Colors.primary} />
                                <Text style={styles.perkText}>5 Direct Notes Daily Included</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="star" size={16} color={Colors.primary} />
                                <Text style={styles.perkText}>5 Super Likes Daily Included</Text>
                              </View>
                              <View style={styles.perkRow}>
                                <Ionicons name="shield" size={16} color={Colors.primary} />
                                <Text style={styles.perkText}>Verified Ad-Free Experience</Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>

                  {/* Feature Comparison Matrix */}
                  <View style={styles.comparisonTableCard}>
                    <View style={styles.comparisonTableHeader}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonColHeaderTitle}>Features</Text>
                      </View>
                      <View style={styles.comparisonColTier}>
                        <Text style={styles.comparisonColHeaderTier}>Free</Text>
                      </View>
                      <View style={styles.comparisonColTier}>
                        <Text style={styles.comparisonColHeaderTier}>Plus</Text>
                      </View>
                      <View style={styles.comparisonColTier}>
                        <Text style={[styles.comparisonColHeaderTier, styles.comparisonColHeaderGold]}>Gold VIP</Text>
                      </View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>Daily Likes</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>25 / day</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>Unlimited</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Unlimited</Text></View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>Rewind Pass</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>5c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>Unlimited</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Unlimited</Text></View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>Direct Notes</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>15c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>5 Daily</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Unlimited 💌</Text></View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>See Who Liked</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>Blurred</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>Blurred</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Unblur 👀</Text></View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>City Passport</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>30c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>30c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Included ✈️</Text></View>
                    </View>

                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>Weekly Boost</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>30c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>30c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>1 Free/Wk ⚡</Text></View>
                    </View>

                    <View style={[styles.comparisonRow, { borderBottomWidth: 0 }]}>
                      <View style={styles.comparisonColFeature}>
                        <Text style={styles.comparisonRowFeatureText}>HD Calling</Text>
                      </View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>1-min free</Text></View>
                      <View style={styles.comparisonColTier}><Text style={styles.comparisonRowTierText}>20c Coins</Text></View>
                      <View style={styles.comparisonColTier}><Text style={[styles.comparisonRowTierText, styles.comparisonRowTierTextGold]}>Unlimited 📞</Text></View>
                    </View>
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
    backgroundColor: '#FFFDF7',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  creditItemCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditCoinEmoji: {
    fontSize: 22,
  },
  creditCoinsAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#92400E',
  },
  creditCoinsUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  creditCoinsSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B45309',
  },
  creditQuickRates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditRateTag: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#92400E',
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
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  focusedPackCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  cardTopRibbon: {
    paddingVertical: 3.5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopRibbonPopular: {
    backgroundColor: Colors.primary,
  },
  cardTopRibbonBestValue: {
    backgroundColor: '#059669',
  },
  cardTopRibbonText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  focusedPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  packContentColumn: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  packTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packPriceColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 52,
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
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 16,
    overflow: 'hidden',
  },
  goldUpsellCardSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  goldUpsellBadge: {
    backgroundColor: '#D97706',
    paddingVertical: 3.5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldUpsellBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  goldUpsellBody: {
    padding: 14,
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

  /* VIP Plans Tab */
  vipPlansContainer: {
    marginBottom: 10,
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
  },
  durationBtnActive: {
    backgroundColor: Colors.backgroundSecondary,
  },
  durationBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
  durationSaveBadgeInline: {
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  durationSaveBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },

  /* Memberships Cards */
  membershipsGrid: {
    gap: 12,
  },
  membershipCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  membershipCardGold: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFCF2',
  },
  membershipCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  membershipTopRibbonGold: {
    backgroundColor: '#D97706',
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipTopRibbonTextGold: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  membershipCardBody: {
    padding: 16,
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

  /* Feature Comparison Matrix */
  comparisonTableCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  comparisonTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    marginBottom: 4,
  },
  comparisonColFeature: {
    flex: 1.4,
  },
  comparisonColTier: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonColHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonColHeaderTier: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  comparisonColHeaderGold: {
    color: '#D97706',
    fontWeight: '800',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  comparisonRowFeatureText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  comparisonRowTierText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  comparisonRowTierTextGold: {
    fontWeight: '700',
    color: '#B45309',
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
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 14,
  },
  utilityChip: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 1,
    alignItems: 'center',
  },
  utilityChipEmoji: {
    fontSize: 15,
    marginBottom: 3,
  },
  utilityChipTitle: {
    fontSize: 8.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  utilityChipCost: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  coinPackCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  coinPackCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(253, 93, 101, 0.03)',
  },
  coinPackCardPopular: {
    borderColor: '#FD5D65',
  },
  coinPackCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
