import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { SafeNotification, NotificationType } from '../../shared/src/types';
import { formatToIST } from '../src/utils/time.util';
import { t } from '../src/i18n/strings';

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    isFetchingMore,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationsStore();

  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotifications(true);
    setIsRefreshing(false);
  };

  const handleNotificationPress = async (item: SafeNotification) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    // Revalidate and navigate based on notification type
    switch (item.type) {
      case NotificationType.NEW_MATCH:
        router.push('/matches');
        break;
      case NotificationType.NEW_MESSAGE:
        if (item.referenceId) {
          router.push(`/chat/${item.referenceId}` as any);
        } else {
          router.push('/conversations');
        }
        break;
      case NotificationType.SAFETY_UPDATE:
        router.push('/(onboarding)/readiness' as any);
        break;
      default:
        break;
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.NEW_MATCH:
        return '🎉';
      case NotificationType.NEW_MESSAGE:
        return '💬';
      case NotificationType.SAFETY_UPDATE:
        return '🛡️';
      case NotificationType.SYSTEM:
      default:
        return '🔔';
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'UNREAD' ? !n.isRead : true,
  );

  const renderNotificationItem = ({ item }: { item: SafeNotification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.timeText}>{formatToIST(item.createdAt)}</Text>
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>
          {item.body}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notificationsTitle')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => markAllAsRead()} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, filter === 'ALL' && styles.activeTabButton]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.activeTabText]}>
            {t('allNotifications')} ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, filter === 'UNREAD' && styles.activeTabButton]}
          onPress={() => setFilter('UNREAD')}
        >
          <Text style={[styles.tabText, filter === 'UNREAD' && styles.activeTabText]}>
            {t('unreadNotifications')} ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {isLoading && notifications.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#FF4458" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyEmoji}>🔕</Text>
          <Text style={styles.emptyTitle}>{t('noNotifications')}</Text>
          <Text style={styles.emptySubtitle}>{t('noNotificationsSubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FF4458"
            />
          }
          onEndReached={() => {
            if (hasMore && !isFetchingMore) {
              fetchNotifications(false);
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#FF4458" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: '#242836',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#242836',
  },
  markAllText: {
    color: '#FF6B7D',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: '#242836',
    gap: 12,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#1E2330',
  },
  activeTabButton: {
    backgroundColor: '#FF4458',
  },
  tabText: {
    fontSize: 13,
    color: '#8E94A5',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
    backgroundColor: '#0F1117',
  },
  unreadCard: {
    backgroundColor: 'rgba(255, 68, 88, 0.04)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E2330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CCD0DC',
  },
  unreadTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  bodyText: {
    fontSize: 13,
    color: '#8E94A5',
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4458',
    marginLeft: 8,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#8E94A5',
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E94A5',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
