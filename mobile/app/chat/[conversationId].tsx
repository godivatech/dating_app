import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useChatStore } from '../../src/stores/chat-store';
import { useSafetyStore } from '../../src/stores/safety-store';
import { useCallStore } from '../../src/stores/call-store';
import { useScreenCapturePrevention } from '../../src/hooks/useScreenCapturePrevention';
import { SafeMessage, ReportTargetType, CallType } from '../../../shared/src/types';
import { ReportModal } from '../../src/components/ReportModal';
import { Colors } from '../../src/theme/colors';

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();

  // Enforce screenshot and screen recording protection in private chat
  useScreenCapturePrevention(true);

  const {
    activeConversation,
    messages,
    openConversation,
    closeConversation,
    sendMessage,
    startTyping,
    stopTyping,
    typingStatus,
    isSending,
    isLoadingMessages,
    error,
  } = useChatStore();

  const { blockUser } = useSafetyStore();
  const { startCall } = useCallStore();

  const [inputText, setInputText] = useState('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isBlockedLocally, setIsBlockedLocally] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const convMessages = (conversationId && messages[conversationId]) || [];
  const isPartnerTyping = (conversationId && typingStatus[conversationId]) || false;
  const isMatchActive = (activeConversation?.isMatchActive ?? true) && !isBlockedLocally;

  useEffect(() => {
    if (conversationId) {
      openConversation(conversationId);
    }
    return () => {
      if (conversationId) {
        closeConversation(conversationId);
      }
    };
  }, [conversationId, openConversation, closeConversation]);

  useEffect(() => {
    if (error) {
      Alert.alert('Message Blocked 🛡️', error);
    }
  }, [error]);

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (!conversationId) return;

    if (text.length > 0) {
      startTyping(conversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (conversationId) stopTyping(conversationId);
      }, 2500);
    } else {
      stopTyping(conversationId);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || isSending) return;

    const content = inputText.trim();
    setInputText('');
    if (conversationId) stopTyping(conversationId);

    await sendMessage(conversationId, content);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const matchedProfile = activeConversation?.matchedProfile;

  const handleBlock = () => {
    if (!matchedProfile) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${matchedProfile.displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setIsBlockedLocally(true);
            await blockUser(matchedProfile.userId, 'Blocked from chat');
            router.back();
          },
        },
      ],
    );
  };

  const handleAudioCall = () => {
    if (!activeConversation?.matchId || !matchedProfile) return;
    startCall(
      activeConversation.matchId,
      matchedProfile.userId,
      partnerName,
      partnerPhoto,
      CallType.AUDIO,
    );
  };

  const handleVideoCall = () => {
    if (!activeConversation?.matchId || !matchedProfile) return;
    startCall(
      activeConversation.matchId,
      matchedProfile.userId,
      partnerName,
      partnerPhoto,
      CallType.VIDEO,
    );
  };

  const partnerName = matchedProfile?.displayName || 'Jane C. Carbone';
  const partnerPhoto =
    matchedProfile?.photos?.[0]?.thumbnailUrl ||
    matchedProfile?.photos?.[0]?.mediumUrl ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

  const renderMessageItem = ({ item }: { item: SafeMessage }) => {
    const isMe = item.isMine ?? (item.senderUserId !== matchedProfile?.userId);
    const timeString = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.bubbleOutgoing : styles.bubbleIncoming,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe ? styles.textOutgoing : styles.textIncoming,
            ]}
          >
            {item.body}
          </Text>

          <Text
            style={[
              styles.messageTime,
              isMe ? styles.timeOutgoing : styles.timeIncoming,
            ]}
          >
            {timeString}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Chat Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        {/* Partner Info */}
        <View style={styles.headerPartnerInfo}>
          <View style={styles.partnerAvatarWrapper}>
            <Image source={{ uri: partnerPhoto }} style={styles.partnerAvatar} />
            <View style={styles.headerOnlineDot} />
          </View>
          <View style={styles.partnerNameCol}>
            <Text style={styles.partnerNameText}>{partnerName}</Text>
            <Text style={styles.partnerStatusText}>
              {isPartnerTyping ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </View>

        {/* Header Actions */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerCallBtn}
            onPress={handleAudioCall}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerCallBtn}
            onPress={handleVideoCall}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => {
              Alert.alert('Options', '', [
                { text: 'Report User', onPress: () => setReportModalVisible(true) },
                { text: 'Block User', style: 'destructive', onPress: handleBlock },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isLoadingMessages ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={convMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyMessagesBox}>
                <View style={styles.emptyChatIcon}>
                  <Ionicons name="chatbubbles-outline" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.emptyChatTitle}>Say hello to {partnerName}!</Text>
                <Text style={styles.emptyChatSubtitle}>
                  You matched! Break the ice and start a wonderful conversation.
                </Text>
              </View>
            }
          />
        )}

        {/* Message Input Bar */}
        {isMatchActive ? (
          <View style={styles.inputBar}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.textInput}
                placeholder="Type your message..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={handleTextChange}
                multiline={false}
              />
              <TouchableOpacity style={styles.attachmentBtn} activeOpacity={0.7}>
                <Feather name="mic" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Coral Round Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isSending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={Colors.white} style={styles.sendIcon} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.unmatchBanner}>
            <Text style={styles.unmatchText}>
              This match is no longer active. Messaging is disabled.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Safety Report Modal */}
      {matchedProfile && (
        <ReportModal
          visible={reportModalVisible}
          targetUserId={matchedProfile.userId}
          targetType={ReportTargetType.USER}
          targetId={matchedProfile.profileId}
          targetName={matchedProfile.displayName}
          onClose={() => setReportModalVisible(false)}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPartnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  partnerAvatarWrapper: {
    position: 'relative',
  },
  partnerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  partnerNameCol: {
    marginLeft: 10,
  },
  partnerNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  partnerStatusText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleIncoming: {
    backgroundColor: Colors.backgroundSecondary,
    borderBottomLeftRadius: 4,
  },
  bubbleOutgoing: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textIncoming: {
    color: Colors.textPrimary,
  },
  textOutgoing: {
    color: Colors.white,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeIncoming: {
    color: Colors.textMuted,
  },
  timeOutgoing: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  emptyMessagesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyChatIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 10,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  attachmentBtn: {
    marginLeft: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#FDA4AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    marginLeft: 2,
  },
  unmatchBanner: {
    padding: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  unmatchText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
