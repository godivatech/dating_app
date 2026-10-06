import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useCreatorStore } from '../../stores/creator-store';
import { useBillingStore } from '../../stores/billing-store';
import { GiftType } from '../../../../shared/src/types';

const { width } = Dimensions.get('window');

interface DefaultGift {
  type: GiftType;
  name: string;
  icon: string;
  coins: number;
  creatorInr: number;
  description: string;
}

const FALLBACK_GIFTS: DefaultGift[] = [
  {
    type: GiftType.ROSE,
    name: 'Red Rose',
    icon: '🌹',
    coins: 10,
    creatorInr: 7,
    description: 'A sweet romantic gesture',
  },
  {
    type: GiftType.HEART,
    name: 'Heart',
    icon: '💖',
    coins: 25,
    creatorInr: 17.5,
    description: 'Show your true affection',
  },
  {
    type: GiftType.CROWN,
    name: 'Crown',
    icon: '👑',
    coins: 50,
    creatorInr: 35,
    description: 'Treat them like royalty',
  },
  {
    type: GiftType.DIAMOND,
    name: 'Diamond',
    icon: '💎',
    coins: 100,
    creatorInr: 70,
    description: 'Dazzling and precious',
  },
  {
    type: GiftType.CHAMPAGNE,
    name: 'Champagne',
    icon: '🍾',
    coins: 250,
    creatorInr: 175,
    description: 'Celebrate the special vibe',
  },
  {
    type: GiftType.SPORTS_CAR,
    name: 'Sports Car',
    icon: '🏎️',
    coins: 500,
    creatorInr: 350,
    description: 'Speed straight to their heart',
  },
  {
    type: GiftType.PRIVATE_JET,
    name: 'Private Jet',
    icon: '✈️',
    coins: 1000,
    creatorInr: 700,
    description: 'First-class romantic luxury',
  },
  {
    type: GiftType.ROMANTIC_CASTLE,
    name: 'Castle',
    icon: '🏰',
    coins: 2500,
    creatorInr: 1750,
    description: 'Fairytale romance forever',
  },
];

export const GiftPickerModal: React.FC = () => {
  const giftModalConfig = useCreatorStore((state) => state.giftModalConfig);
  const closeGiftModal = useCreatorStore((state) => state.closeGiftModal);
  const sendGift = useCreatorStore((state) => state.sendGift);
  const isSending = useCreatorStore((state) => state.isSending);

  const creditBalance = useBillingStore((state) => state.creditBalance);
  const openPaywall = useBillingStore((state) => state.openPaywall);
  const fetchCreditBalance = useBillingStore((state) => state.fetchCreditBalance);

  const [selectedGift, setSelectedGift] = useState<DefaultGift>(FALLBACK_GIFTS[0]);

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
        'Insufficient Coins 🪙',
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
      Alert.alert(
        'Gift Sent! 🎁',
        `You sent a ${selectedGift.name} to ${giftModalConfig.receiverName}! They earned ₹${selectedGift.creatorInr} directly.`,
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
              <Text style={styles.headerTitle}>Send a Virtual Gift 🎁</Text>
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
                <Text style={styles.coinIcon}>🪙</Text>
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
              {FALLBACK_GIFTS.map((gift) => {
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
                      <Text style={styles.giftIconText}>{gift.icon}</Text>
                    </View>
                    <Text style={styles.giftName} numberOfLines={1}>
                      {gift.name}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.giftPriceCoin}>🪙 {gift.coins}</Text>
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
              <Text style={styles.summaryTitle}>
                {selectedGift.icon} {selectedGift.name}
              </Text>
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
                  <Text style={styles.sendBtnText}>
                    {hasEnoughCoins
                      ? `Send for ${selectedGift.coins} Coins 🪙`
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
    gap: 4,
    marginTop: 2,
  },
  coinIcon: {
    fontSize: 16,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  giftIconText: {
    fontSize: 28,
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
    marginTop: 4,
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
    gap: 6,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
