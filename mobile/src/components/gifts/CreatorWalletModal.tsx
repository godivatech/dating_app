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
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
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
  const wallet = useCreatorStore((state) => state.wallet);
  const payoutHistory = useCreatorStore((state) => state.payoutHistory);
  const receivedGifts = useCreatorStore((state) => state.receivedGifts);
  const isLoading = useCreatorStore((state) => state.isLoading);
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
        return { label: 'PAID', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' };
      case PayoutStatus.PROCESSING:
        return { label: 'PROCESSING', bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' };
      case PayoutStatus.REJECTED:
        return { label: 'REJECTED', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' };
      case PayoutStatus.PENDING:
      default:
        return { label: 'PENDING', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Creator Earnings & Payouts</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Main Earnings Card */}
          <View style={styles.earningsCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={styles.instantPill}>
                <Ionicons name="flash" size={12} color="#10B981" />
                <Text style={styles.instantPillText}>UPI WITHDRAWAL</Text>
              </View>
            </View>

            <Text style={styles.mainBalanceText}>₹{availableBalance.toFixed(2)}</Text>

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

            {/* Withdraw Button */}
            <TouchableOpacity
              style={[styles.withdrawBtn, availableBalance < 100 && styles.withdrawBtnDisabled]}
              onPress={handleOpenWithdraw}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.withdrawBtnText}>
                {availableBalance >= 100 ? 'Withdraw to UPI Bank' : 'Min ₹100 to Withdraw'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Value Proposition Note */}
          <View style={styles.infoBanner}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>💎</Text>
            <Text style={styles.infoBannerText}>
              Receive virtual gifts from matches in chat & video calls to earn real money. You keep 70% of every gift value!
            </Text>
          </View>

          {/* Navigation Tabs */}
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
                        <Text style={{ fontSize: 24 }}>🎁</Text>
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
                      <Text style={styles.giftTypeTag}>{gift.giftType}</Text>
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
                          <Ionicons name="wallet-outline" size={22} color="#94A3B8" />
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
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
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

        {/* Withdraw Dialog Sheet */}
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
                  <Ionicons name="close" size={22} color="#94A3B8" />
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
                    placeholderTextColor="#64748B"
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
                  <Ionicons name="card-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder="e.g. name@oksbi or mobile@upi"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmWithdrawBtn, isRequestingPayout && { opacity: 0.7 }]}
                onPress={handleConfirmWithdraw}
                disabled={isRequestingPayout}
                activeOpacity={0.85}
              >
                {isRequestingPayout ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmWithdrawBtnText}>Confirm Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  earningsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  instantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  instantPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  mainBalanceText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#10B981',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
  },
  withdrawBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FDA4AF',
    lineHeight: 17,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#0F172A',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  listSection: {
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  giftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  giftItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  giftItemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftItemSender: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  giftItemDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  giftItemRight: {
    alignItems: 'flex-end',
  },
  giftEarningsText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  giftTypeTag: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  payoutItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutUpiText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  payoutDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  payoutItemRight: {
    alignItems: 'flex-end',
  },
  payoutAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#F8FAFC',
  },
  dialogSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    paddingVertical: 12,
  },
  maxBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  maxBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  confirmWithdrawBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmWithdrawBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
