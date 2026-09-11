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
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsStore } from '../src/stores/notifications-store';
import { SafeNotification, NotificationType } from '../../shared/src/types';
import { formatToIST } from '../src/utils/time.util';
import { t } from '../src/i18n/strings';
import { Colors } from '../src/theme/colors';

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

    const conversationId = item.metadata?.conversationId || item.referenceId;

    switch (item.type) {
      case NotificationType.MISSED_CALL:
        if (conversationId && conversationId !== 'matches') {
          router.push(`/chat/${conversationId}` as any);
        } else {
          router.push('/conversations');
        }
        break;

      case NotificationType.NEW_MESSAGE:
        if (conversationId) {
          router.push(`/chat/${conversationId}` as any);
        } else {
          router.push('/conversations');
        }
        break;

      case NotificationType.NEW_MATCH:
        router.push('/matches');
        break;

      case NotificationType.SAFETY_UPDATE:
        router.push('/(onboarding)/readiness' as any);
        break;

      case NotificationType.SYSTEM:
      default:
        if (item.metadata?.screen) {
          router.push(item.metadata.screen as any);
        } else if (item.referenceId === 'discovery') {
          router.push('/discovery');
        } else if (item.referenceId === 'profile') {
          router.push('/profile');
        } else if (item.referenceId === 'matches') {
          router.push('/matches');
        } else if (conversationId) {
          router.push(`/chat/${conversationId}` as any);
        } else {
          router.push('/matches');
        }
        break;
    }
  };

  const renderIcon = (type: NotificationType, isRead: boolean) => {
    const iconColor = isRead ? Colors.textMuted : Colors.primary;
    const bgColor = isRead ? Colors.backgroundSecondary : Colors.primaryLight;

    let iconName: keyof typeof Ionicons.glyphMap = 'notifications-outline';

    switch (type) {
      case NotificationType.MISSED_CALL:
        iconName = 'call-outline';
        break;
      case NotificationType.NEW_MATCH:
        iconName = 'heart-outline';
        break;
      case NotificationType.NEW_MESSAGE:
        iconName = 'chatbubble-outline';
        break;
      case NotificationType.SAFETY_UPDATE:
        iconName = 'shield-outline';
        break;
      case NotificationType.SYSTEM:
      default:
        iconName = 'notifications-outline';
        break;
    }

    return (
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
    );
  };

  // Filter out any stale ringing alerts if any remain, and apply unread filter
  const validNotifications = notifications.filter(
    (n) => !n.title?.toLowerCase().includes('incoming') && !n.body?.toLowerCase().includes('is calling you'),
  );

  const filteredNotifications = validNotifications.filter((n) =>
    filter === 'UNREAD' ? !n.isRead : true,
  );

  const renderNotificationItem = ({ item }: { item: SafeNotification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      {renderIcon(item.type, item.isRead)}
      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
            {item.title}
          </Text>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notificationsTitle')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={() => markAllAsRead()}
            style={styles.markAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Filter Segmented Bar */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, filter === 'ALL' && styles.activeTabButton]}
            onPress={() => setFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'ALL' && styles.activeTabText]}>
              {t('allNotifications')} ({validNotifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, filter === 'UNREAD' && styles.activeTabButton]}
            onPress={() => setFilter('UNREAD')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'UNREAD' && styles.activeTabText]}>
              {t('unreadNotifications')} ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Content */}
      {isLoading && validNotifications.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="notifications-outline" size={32} color={Colors.textMuted} />
          </View>
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
              tintColor={Colors.primary}
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
                <ActivityIndicator size="small" color={Colors.primary} />
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
  },
  markAllText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 38,
  },
  tabBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  unreadCard: {
    backgroundColor: '#FFFDFD',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  bodyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 10,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
