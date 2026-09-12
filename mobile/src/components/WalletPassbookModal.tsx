import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useBillingStore } from '../stores/billing-store';
import { SafeCoinTransaction, CoinTransactionType } from '../../../shared/src/types';

interface WalletPassbookModalProps {
  visible: boolean;
  onClose: () => void;
}

export function WalletPassbookModal({ visible, onClose }: WalletPassbookModalProps) {
  const {
    creditBalance,
    coinHistory,
    fetchCoinHistory,
    fetchCreditBalance,
    openPaywall,
  } = useBillingStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchCreditBalance();
      fetchCoinHistory();
    }
  }, [visible]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchCreditBalance(), fetchCoinHistory()]);
    setIsRefreshing(false);
  };

  const getTransactionVisuals = (item: SafeCoinTransaction) => {
    const isCredit = item.amount > 0;
    switch (item.type) {
      case CoinTransactionType.PURCHASE_RECHARGE:
        return {
          icon: 'card-outline' as const,
          color: '#10B981',
          bg: '#ECFDF5',
          title: 'UPI Wallet Recharge',
        };
      case CoinTransactionType.ADMIN_GRANT:
        return {
          icon: 'gift-outline' as const,
          color: '#8B5CF6',
          bg: '#F5F3FF',
          title: 'Support / Bonus Grant',
        };
      case CoinTransactionType.SPEND_DIRECT_NOTE:
        return {
          icon: 'mail-outline' as const,
          color: '#E11D48',
          bg: '#FFF1F2',
          title: 'Direct Note Sent',
        };
      case CoinTransactionType.SPEND_PROFILE_BOOST:
        return {
          icon: 'rocket-outline' as const,
          color: '#F59E0B',
          bg: '#FFFBEB',
          title: '30-Min Profile Boost',
        };
      case CoinTransactionType.SPEND_CALL_MINUTES:
        return {
          icon: 'videocam-outline' as const,
          color: '#9333EA',
          bg: '#FAF5FF',
          title: 'Audio / Video Call Pass',
        };
      case CoinTransactionType.SPEND_REWIND:
        return {
          icon: 'refresh-outline' as const,
          color: '#3B82F6',
          bg: '#EFF6FF',
          title: 'Rewind Last Pass',
        };
      case CoinTransactionType.SPEND_UNBLUR:
        return {
          icon: 'eye-outline' as const,
          color: '#06B6D4',
          bg: '#ECFEFF',
          title: 'Unblur Profile',
        };
      default:
        return {
          icon: (isCredit ? 'add-circle-outline' : 'remove-circle-outline') as any,
          color: isCredit ? '#10B981' : '#E11D48',
          bg: isCredit ? '#ECFDF5' : '#FFF1F2',
          title: isCredit ? 'Coin Credit' : 'Coin Spend',
        };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderTransaction = ({ item }: { item: SafeCoinTransaction }) => {
    const visuals = getTransactionVisuals(item);
    const isCredit = item.amount > 0;

    return (
      <View style={styles.transactionCard}>
        <View style={[styles.iconBox, { backgroundColor: visuals.bg }]}>
          <Ionicons name={visuals.icon} size={20} color={visuals.color} />
        </View>

        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {visuals.title}
          </Text>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description || visuals.title}
          </Text>
          <Text style={styles.transactionTime}>{formatTimestamp(item.createdAt)}</Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.amountText, { color: isCredit ? '#10B981' : '#E11D48' }]}>
            {isCredit ? `+${item.amount}` : item.amount} 🪙
          </Text>
          <Text style={styles.balanceAfterText}>Bal: {item.balanceAfter}c</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={Platform.OS === 'ios' ? 'dark-content' : 'default'} />

        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Truelove Passbook</Text>
            <Text style={styles.headerSubtitle}>Double-entry coin ledger</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.refreshButton}
              activeOpacity={0.7}
              disabled={isRefreshing}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={Colors.textSecondary}
                style={isRefreshing ? styles.spinIcon : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Wallet Balance Banner */}
        <View style={styles.balanceBanner}>
          <View style={styles.balanceTextGroup}>
            <Text style={styles.balanceLabel}>CURRENT WALLET BALANCE</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.coinEmoji}>🪙</Text>
              <Text style={styles.balanceNumber}>{creditBalance?.coins ?? 0}</Text>
              <Text style={styles.coinsSuffix}>Coins</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.rechargeChipBtn}
            onPress={() => {
              openPaywall('COINS');
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.rechargeChipText}>+ Recharge</Text>
          </TouchableOpacity>
        </View>

        {/* Micro-Rates Reference Pill */}
        <View style={styles.rateCardBar}>
          <Text style={styles.rateCardText}>
            Rates: 15c Note • 30c Boost • 20c Call • 5c Rewind
          </Text>
        </View>

        {/* Ledger Transaction History List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>Transaction History</Text>
            <Text style={styles.listHeaderCount}>
              {coinHistory.length} {coinHistory.length === 1 ? 'record' : 'records'}
            </Text>
          </View>

          <FlatList
            data={coinHistory}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Text style={{ fontSize: 32 }}>🪙</Text>
                </View>
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your coin ledger will record all UPI micro-recharges, direct notes, boosts,
                  and call minutes right here with cryptographic transparency.
                </Text>
                <TouchableOpacity
                  style={styles.emptyRechargeBtn}
                  onPress={() => openPaywall('COINS')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyRechargeBtnText}>Recharge Wallet Now</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  balanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  balanceTextGroup: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  coinEmoji: {
    fontSize: 24,
    marginRight: 6,
  },
  balanceNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  coinsSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginLeft: 6,
    marginTop: 6,
  },
  rechargeChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11D48',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rechargeChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rateCardBar: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  rateCardText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  listContainer: {
    flex: 1,
    marginTop: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  listHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 10,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  transactionDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  transactionTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  balanceAfterText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  emptyRechargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11D48',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyRechargeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
