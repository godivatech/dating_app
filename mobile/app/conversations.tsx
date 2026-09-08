import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useChatStore } from '../src/stores/chat-store';
import { SafeConversationSummary } from '../../shared/src/types';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { Colors } from '../src/theme/colors';
import { useScreenCapturePrevention } from '../src/hooks/useScreenCapturePrevention';

export default function ConversationsScreen() {
  const router = useRouter();
  const {
    conversations,
    isLoadingConversations,
    fetchConversations,
    initSocket,
  } = useChatStore();

  const [refreshing, setRefreshing] = useState(false);

  // Prevent screenshots and screen recording of conversation lists and previews
  useScreenCapturePrevention(true);

  useEffect(() => {
    initSocket();
    fetchConversations();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const handleOpenConversation = (item: SafeConversationSummary) => {
    const candidate = item.matchedProfile;
    const photoUrl =
      candidate?.photos?.[0]?.thumbnailUrl ||
      candidate?.photos?.[0]?.mediumUrl ||
      '';
    router.push({
      pathname: `/chat/${item.id}`,
      params: {
        partnerName: candidate?.displayName || '',
        partnerPhoto: photoUrl,
      },
    } as any);
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversationItem = ({ item }: { item: SafeConversationSummary }) => {
    const candidate = item.matchedProfile;
    const photoUrl =
      candidate?.photos?.[0]?.thumbnailUrl ||
      candidate?.photos?.[0]?.mediumUrl ||
      null;

    return (
      <TouchableOpacity
        style={styles.convCard}
        onPress={() => handleOpenConversation(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrapper}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(candidate?.displayName || 'M').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.convInfo}>
          <View style={styles.nameTimeRow}>
            <Text style={styles.partnerName}>
              {candidate?.displayName || 'Matched Partner'}
            </Text>
            <Text style={styles.timeText}>
              {formatTimestamp(item.lastMessage?.createdAt || item.updatedAt)}
            </Text>
          </View>

          <View style={styles.msgRow}>
            <Text
              style={[
                styles.lastMsgText,
                item.unreadCount > 0 && styles.lastMsgUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.body || 'Matched! Tap to send a message.'}
            </Text>

            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.matchesLinkBtn}
          onPress={() => router.push('/matches' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="heart" size={16} color={Colors.primary} />
          <Text style={styles.matchesLinkText}>Matches</Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {isLoadingConversations && conversations.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                When you match with someone on Truelove, your chats will appear here.
              </Text>
              <TouchableOpacity
                style={styles.discoverBtn}
                onPress={() => router.push('/discovery' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.discoverBtnText}>Explore Matches</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Floating Bottom Tab Bar */}
      <BottomTabBar activeTab="chat" />
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  matchesLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchesLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  convInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMsgText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  lastMsgUnread: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  discoverBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  discoverBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
