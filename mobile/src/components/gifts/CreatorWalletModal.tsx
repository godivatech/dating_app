import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useCreatorStore } from '../../stores/creator-store';
import { toast } from '../../stores/toast-store';
import { PayoutStatus } from '../../../../shared/src/types';

interface CreatorWalletModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreatorWalletModal: React.FC<CreatorWalletModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const wallet = useCreatorStore((state) => state.wallet);
  const payoutHistory = useCreatorStore((state) => state.payoutHistory);
  const receivedGifts = useCreatorStore((state) => state.receivedGifts);
  const isRequestingPayout = useCreatorStore((state) => state.isRequestingPayout);
  const fetchWallet = useCreatorStore((state) => state.fetchWallet);
  const fetchPayoutHistory = useCreatorStore((state) => state.fetchPayoutHistory);
  const fetchReceivedGifts = useCreatorStore((state) => state.fetchReceivedGifts);
  const requestPayout = useCreatorStore((state) => state.requestPayout);

  const [activeTab, setActiveTab] = useState<'GIFTS' | 'PAYOUTS'>('GIFTS');
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    if (visible) {
      fetchWallet();
      fetchPayoutHistory();
      fetchReceivedGifts();
    }
  }, [visible, fetchWallet, fetchPayoutHistory, fetchReceivedGifts]);

  const availableBalance = wallet?.balanceInr ?? 0;

  const handleOpenWithdraw = () => {
    if (availableBalance < 100) {
      toast.info(
        `The minimum withdrawal threshold is ₹100. Your current available balance is ₹${availableBalance.toFixed(2)}.`,
        'Minimum Balance Required',
      );
      return;
    }
    setWithdrawAmount(availableBalance.toString());
    setShowWithdrawDialog(true);
  };

  const handleConfirmWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 100) {
      toast.error('Minimum withdrawal amount is ₹100.', 'Invalid Amount');
      return;
    }
    if (amount > availableBalance) {
      toast.error(
        `You cannot withdraw more than your available balance of ₹${availableBalance.toFixed(2)}.`,
        'Insufficient Balance',
      );
      return;
    }

    const trimmedUpi = upiId.trim();
    if (!trimmedUpi || !trimmedUpi.includes('@') || trimmedUpi.length < 5) {
      toast.error(
        'Please enter a valid UPI VPA (e.g., yourname@oksbi, mobile@paytm).',
        'Invalid UPI ID',
      );
      return;
    }

    const res = await requestPayout(amount, trimmedUpi);
    if (res.success) {
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      setUpiId('');
      toast.success(
        `Your withdrawal request for ₹${amount.toFixed(2)} to ${trimmedUpi} has been queued.`,
        'Payout Submitted',
      );
    } else {
      toast.error(res.error || 'Please try again.', 'Payout Failed');
    }
  };

  const getStatusBadge = (status: PayoutStatus) => {
    switch (status) {
      case PayoutStatus.PAID:
        return { label: 'PAID', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case PayoutStatus.PROCESSING:
        return { label: 'PROCESSING', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case PayoutStatus.REJECTED:
        return { label: 'REJECTED', bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      case PayoutStatus.PENDING:
      default:
        return { label: 'PENDING', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop:
              Platform.OS === 'android'
                ? Math.max(insets.top, 38)
                : Math.max(insets.top, 14),
          },
        ]}
      >
        <StatusBar style="dark" />

        {/* Clean Header Matching Pricing Page */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Creator Earnings & Payouts</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Main Earnings Card in Pricing Page Aesthetic */}
          <View style={styles.earningsCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={styles.instantPill}>
                <Ionicons name="flash" size={12} color={Colors.primary} />
                <Text style={styles.instantPillText}>UPI WITHDRAWAL</Text>
              </View>
            </View>

            <View style={styles.balanceRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.mainBalanceText}>{availableBalance.toFixed(2)}</Text>
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Lifetime Earned</Text>
                <Text style={styles.statValue}>₹{(wallet?.totalEarnedInr ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Withdrawn</Text>
                <Text style={styles.statValue}>₹{(wallet?.totalWithdrawnInr ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Gifts Received</Text>
                <Text style={styles.statValue}>{wallet?.giftsReceivedCount ?? 0}</Text>
              </View>
            </View>

            {/* Signature Brand Withdraw Button */}
            <TouchableOpacity
              style={[styles.withdrawBtn, availableBalance < 100 && styles.withdrawBtnDisabled]}
              onPress={handleOpenWithdraw}
              activeOpacity={0.88}
            >
              <Ionicons name="cash-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.withdrawBtnText}>
                {availableBalance >= 100 ? 'Withdraw to UPI Bank' : 'Min ₹100 to Withdraw'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Value Proposition Note in Pricing Page Style */}
          <View style={styles.infoBanner}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>💎</Text>
            <Text style={styles.infoBannerText}>
              Receive virtual gifts from matches in chat & video calls to earn real money. You keep 70% of every gift value!
            </Text>
          </View>

          {/* Segment Switcher (Matching Paywall Switcher) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'GIFTS' && styles.tabItemActive]}
              onPress={() => setActiveTab('GIFTS')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'GIFTS' && styles.tabTextActive]}>
                Gifts Received ({receivedGifts.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'PAYOUTS' && styles.tabItemActive]}
              onPress={() => setActiveTab('PAYOUTS')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'PAYOUTS' && styles.tabTextActive]}>
                Payout History ({payoutHistory.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'GIFTS' ? (
            <View style={styles.listSection}>
              {receivedGifts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🎁</Text>
                  <Text style={styles.emptyTitle}>No gifts received yet</Text>
                  <Text style={styles.emptySubtitle}>
                    When someone sends you a virtual gift in chat or during a call, your earnings will appear here!
                  </Text>
                </View>
              ) : (
                receivedGifts.map((gift) => (
                  <View key={gift.id} style={styles.giftItem}>
                    <View style={styles.giftItemLeft}>
                      <View style={styles.giftItemIconBox}>
                        <Ionicons name="gift" size={20} color={Colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.giftItemSender}>
                          From {gift.senderDisplayName || 'A Match'}
                        </Text>
                        <Text style={styles.giftItemDate}>
                          {new Date(gift.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.giftItemRight}>
                      <Text style={styles.giftEarningsText}>
                        +₹{gift.creatorEarningInr.toFixed(2)}
                      </Text>
                      <View style={styles.giftTypeTagBox}>
                        <Text style={styles.giftTypeTag}>{gift.giftType}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.listSection}>
              {payoutHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🏦</Text>
                  <Text style={styles.emptyTitle}>No payout requests</Text>
                  <Text style={styles.emptySubtitle}>
                    When you withdraw your earnings to UPI, your transaction requests will be listed here.
                  </Text>
                </View>
              ) : (
                payoutHistory.map((payout) => {
                  const badge = getStatusBadge(payout.status);
                  return (
                    <View key={payout.id} style={styles.payoutItem}>
                      <View style={styles.payoutItemLeft}>
                        <View style={styles.payoutIconBox}>
                          <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.payoutUpiText}>{payout.upiId}</Text>
                          <Text style={styles.payoutDate}>
                            {new Date(payout.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.payoutItemRight}>
                        <Text style={styles.payoutAmountText}>₹{payout.amountInr.toFixed(2)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        {/* Withdraw Dialog Sheet in Pricing Page Styling */}
        <Modal
          visible={showWithdrawDialog}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWithdrawDialog(false)}
        >
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogContainer}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>Withdraw to UPI 🏦</Text>
                <TouchableOpacity onPress={() => setShowWithdrawDialog(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.dialogSubtitle}>
                Available to withdraw: ₹{availableBalance.toFixed(2)}
              </Text>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Withdrawal Amount (INR)</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputCurrency}>₹</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="100"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => setWithdrawAmount(availableBalance.toString())}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* UPI ID Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your UPI ID (VPA)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="card-outline" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder="e.g. name@oksbi or mobile@upi"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmWithdrawBtn, isRequestingPayout && { opacity: 0.7 }]}
                onPress={handleConfirmWithdraw}
                disabled={isRequestingPayout}
                activeOpacity={0.88}
              >
                {isRequestingPayout ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmWithdrawBtnText}>Confirm Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary, // Clean light slate background #F8FAFC
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  earningsCard: {
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#FFE4E8',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  instantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  instantPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 10,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    marginRight: 4,
  },
  mainBalanceText: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE4E8',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#FECDD3',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
  },
  withdrawBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.22)',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3.5,
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  listSection: {
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  giftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  giftItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  giftItemIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftItemSender: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  giftItemDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  giftItemRight: {
    alignItems: 'flex-end',
  },
  giftEarningsText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  giftTypeTagBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginTop: 3,
  },
  giftTypeTag: {
    fontSize: 9.5,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  payoutItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutUpiText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  payoutDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  payoutItemRight: {
    alignItems: 'flex-end',
  },
  payoutAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dialogSubtitle: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 12,
  },
  maxBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.3)',
  },
  maxBtnText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  confirmWithdrawBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmWithdrawBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
