import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useCreatorStore } from '../../stores/creator-store';
import { useBillingStore } from '../../stores/billing-store';
import { useChatStore } from '../../stores/chat-store';
import { GiftType } from '../../../../shared/src/types';
import { getGiftAsset, COIN_ASSET } from '../../constants/gift-assets';

const { width } = Dimensions.get('window');

interface DefaultGift {
  type: GiftType;
  name: string;
  coins: number;
  creatorInr: number;
  description: string;
}

const FALLBACK_GIFTS: DefaultGift[] = [
  {
    type: GiftType.ROSE,
    name: 'Red Rose',
    coins: 10,
    creatorInr: 5,
    description: 'A classic symbol of romantic admiration and interest.',
  },
  {
    type: GiftType.CHOCOLATE,
    name: 'Artisan Chocolates',
    coins: 30,
    creatorInr: 15,
    description: 'Sweet gourmet treats to sweeten the conversation.',
  },
  {
    type: GiftType.TEDDY_BEAR,
    name: 'Teddy Bear',
    coins: 50,
    creatorInr: 25,
    description: 'An adorable fluffy companion to make them smile.',
  },
  {
    type: GiftType.DIAMOND_RING,
    name: 'Diamond Ring',
    coins: 100,
    creatorInr: 50,
    description: 'A sparkling pledge of sincere connection.',
  },
  {
    type: GiftType.ROYAL_CROWN,
    name: 'Royal Crown',
    coins: 250,
    creatorInr: 125,
    description: 'Treat your match like true royalty.',
  },
];

export const GiftPickerModal: React.FC = () => {
  const catalog = useCreatorStore((state) => state.catalog);
  const giftModalConfig = useCreatorStore((state) => state.giftModalConfig);
  const closeGiftModal = useCreatorStore((state) => state.closeGiftModal);
  const sendGift = useCreatorStore((state) => state.sendGift);
  const isSending = useCreatorStore((state) => state.isSending);

  const creditBalance = useBillingStore((state) => state.creditBalance);
  const openPaywall = useBillingStore((state) => state.openPaywall);
  const fetchCreditBalance = useBillingStore((state) => state.fetchCreditBalance);

  const giftItems: DefaultGift[] = useMemo(() => {
    if (catalog && catalog.length > 0) {
      return catalog.map((item) => ({
        type: item.id,
        name: item.displayName,
        coins: item.coinsCost,
        creatorInr: item.creatorEarningsPaise / 100,
        description: item.description,
      }));
    }
    return FALLBACK_GIFTS;
  }, [catalog]);

  const [selectedGift, setSelectedGift] = useState<DefaultGift>(giftItems[0] || FALLBACK_GIFTS[0]);

  useEffect(() => {
    if (giftItems.length > 0 && !giftItems.some((g) => g.type === selectedGift.type)) {
      setSelectedGift(giftItems[0]);
    }
  }, [giftItems]);

  useEffect(() => {
    if (giftModalConfig?.visible) {
      fetchCreditBalance();
    }
  }, [giftModalConfig?.visible, fetchCreditBalance]);

  if (!giftModalConfig?.visible) return null;

  const currentCoins = creditBalance?.coins ?? 0;
  const hasEnoughCoins = currentCoins >= selectedGift.coins;

  const handleSend = async () => {
    if (!hasEnoughCoins) {
      Alert.alert(
        'Insufficient Coins',
        `You need ${selectedGift.coins} coins to send this gift, but currently have ${currentCoins} coins. Would you like to recharge?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Recharge Coins',
            onPress: () => {
              closeGiftModal();
              openPaywall('COINS');
            },
          },
        ],
      );
      return;
    }

    const result = await sendGift(
      giftModalConfig.receiverUserId,
      selectedGift.type,
      giftModalConfig.conversationId,
      giftModalConfig.callId,
    );

    if (result.success) {
      closeGiftModal();
      // Drop celebratory message into chat conversation if in chat
      if (giftModalConfig.conversationId) {
        try {
          await useChatStore
            .getState()
            .sendMessage(
              giftModalConfig.conversationId,
              `Sent a ${selectedGift.name}`,
            );
        } catch {}
      }
      Alert.alert(
        'Gift Sent',
        `You sent a ${selectedGift.name} to ${giftModalConfig.receiverName}! They earned ₹${selectedGift.creatorInr.toFixed(2)} directly.`,
      );
    } else {
      Alert.alert('Could Not Send Gift', result.error || 'Please try again later.');
    }
  };

  return (
    <Modal
      visible={giftModalConfig.visible}
      transparent
      animationType="slide"
      onRequestClose={closeGiftModal}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Send a Virtual Gift</Text>
              <Text style={styles.headerSubtitle}>
                To {giftModalConfig.receiverName} • Support & Impress
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={closeGiftModal}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* User Coin Balance Bar */}
          <View style={styles.balanceBar}>
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <View style={styles.balanceValueRow}>
                <Image source={COIN_ASSET} style={styles.coinBadgeIcon} resizeMode="contain" />
                <Text style={styles.coinCount}>{currentCoins}</Text>
                <Text style={styles.coinUnit}>Coins</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.rechargeBtn}
              onPress={() => {
                closeGiftModal();
                openPaywall('COINS');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color={Colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.rechargeBtnText}>Recharge</Text>
            </TouchableOpacity>
          </View>

          {/* Gift Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
          >
            <View style={styles.grid}>
              {giftItems.map((gift) => {
                const isSelected = selectedGift.type === gift.type;
                const canAfford = currentCoins >= gift.coins;

                return (
                  <TouchableOpacity
                    key={gift.type}
                    style={[
                      styles.giftCard,
                      isSelected && styles.giftCardSelected,
                    ]}
                    onPress={() => setSelectedGift(gift)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.giftIconWrap}>
                      <Image
                        source={getGiftAsset(gift.type)}
                        style={styles.giftAssetImage}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.giftName} numberOfLines={1}>
                      {gift.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Image source={COIN_ASSET} style={styles.miniCoinIcon} resizeMode="contain" />
                      <Text style={styles.giftPriceCoin}>{gift.coins}</Text>
                    </View>
                    <View style={styles.earningBadge}>
                      <Text style={styles.earningBadgeText}>
                        Creator gets ₹{gift.creatorInr}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedTick}>
                        <Ionicons name="checkmark" size={12} color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <View style={styles.footerSummary}>
              <View style={styles.footerTitleRow}>
                <Image
                  source={getGiftAsset(selectedGift.type)}
                  style={styles.footerGiftThumbnail}
                  resizeMode="contain"
                />
                <Text style={styles.summaryTitle}>{selectedGift.name}</Text>
              </View>
              <Text style={styles.summaryDesc}>{selectedGift.description}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                !hasEnoughCoins && styles.sendBtnDisabled,
                isSending && { opacity: 0.7 },
              ]}
              onPress={handleSend}
              disabled={isSending}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <View style={styles.sendBtnContent}>
                  <Image source={COIN_ASSET} style={styles.sendBtnCoinIcon} resizeMode="contain" />
                  <Text style={styles.sendBtnText}>
                    {hasEnoughCoins
                      ? `Send for ${selectedGift.coins} Coins`
                      : `Get More Coins (+${selectedGift.coins - currentCoins} needed)`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const cardWidth = (width - 48 - 18) / 3;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  balanceInfo: {
    flexDirection: 'column',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  coinBadgeIcon: {
    width: 22,
    height: 22,
  },
  coinCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FBBF24',
  },
  coinUnit: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F43F5E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  rechargeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  gridContent: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  giftCard: {
    width: cardWidth,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  giftCardSelected: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  giftIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  giftAssetImage: {
    width: 50,
    height: 50,
  },
  giftName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  miniCoinIcon: {
    width: 14,
    height: 14,
  },
  giftPriceCoin: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
  },
  earningBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  earningBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#34D399',
  },
  selectedTick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
  },
  footerSummary: {
    marginBottom: 10,
  },
  footerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerGiftThumbnail: {
    width: 24,
    height: 24,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  summaryDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  sendBtn: {
    backgroundColor: '#F43F5E',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#64748B',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtnCoinIcon: {
    width: 18,
    height: 18,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
