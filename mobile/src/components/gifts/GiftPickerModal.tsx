import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useCreatorStore } from '../../stores/creator-store';
import { useBillingStore } from '../../stores/billing-store';
import { useChatStore } from '../../stores/chat-store';
import { toast } from '../../stores/toast-store';
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
      closeGiftModal();
      toast.info(
        `You need ${selectedGift.coins} coins to send this gift. Recharge your wallet to send gifts anytime!`,
        'Coins Needed 🪙',
      );
      openPaywall('COINS');
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

      // Trigger celebratory full-screen 3D overlay animation for sender
      useCreatorStore.getState().triggerGiftAnimation({
        giftType: selectedGift.type,
        displayName: selectedGift.name,
        icon: '',
        senderDisplayName: 'You',
      });

      // Drop celebratory message into chat conversation if in chat
      if (giftModalConfig.conversationId) {
        try {
          await useChatStore
            .getState()
            .sendMessage(
              giftModalConfig.conversationId,
              `🎁 Sent a ${selectedGift.name}`,
            );
        } catch {}
      }
    } else {
      toast.error(result.error || 'Please try again later.', 'Could Not Send Gift');
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
          {/* Top Drag Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Send a Virtual Gift</Text>
              <Text style={styles.headerSubtitle}>
                To {giftModalConfig.receiverName} • Express Your Affection
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={closeGiftModal}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
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

const cardWidth = (width - 40 - 20) / 3;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  balanceInfo: {
    flexDirection: 'column',
  },
  balanceLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  coinBadgeIcon: {
    width: 20,
    height: 20,
  },
  coinCount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  coinUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  rechargeBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  gridContent: {
    paddingBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  giftCard: {
    width: cardWidth,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    position: 'relative',
  },
  giftCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  giftIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  giftAssetImage: {
    width: 50,
    height: 50,
  },
  giftName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  selectedTick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  footerSummary: {
    marginBottom: 12,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#FDA4AF',
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
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
