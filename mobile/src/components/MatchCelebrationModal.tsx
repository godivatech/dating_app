import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../stores/chat-store';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');

export interface MatchedUserInfo {
  userId?: string;
  profileId?: string;
  displayName: string;
  photoUrl?: string | null;
}

interface MatchCelebrationModalProps {
  visible: boolean;
  matchedUser: MatchedUserInfo | null;
  currentUserPhotoUrl?: string | null;
  onClose: () => void;
  onSendMessage?: () => void;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  visible,
  matchedUser,
  currentUserPhotoUrl,
  onClose,
  onSendMessage,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      try {
        Vibration.vibrate([0, 60, 80, 120]);
      } catch {}

      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      heartScale.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.spring(heartScale, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [visible]);

  const router = useRouter();
  const { conversations, createOrGetConversationByMatchId } = useChatStore();

  if (!visible || !matchedUser) return null;

  const name = matchedUser.displayName || 'Your Match';

  const handleStartChat = async () => {
    onClose();
    if (onSendMessage) {
      onSendMessage();
      return;
    }

    try {
      const existing = conversations.find(
        (c) => c.matchedProfile?.userId === matchedUser.userId,
      );
      if (existing) {
        router.push({
          pathname: `/chat/${existing.id}`,
          params: {
            partnerName: name,
            partnerPhoto: matchedUser.photoUrl || '',
          },
        } as any);
      } else {
        router.push('/conversations');
      }
    } catch {
      router.push('/conversations');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Badge */}
          <View style={styles.badgeRow}>
            <Ionicons name="sparkles" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>IT'S A MATCH!</Text>
            <Ionicons name="sparkles" size={15} color={Colors.primary} style={{ marginLeft: 6 }} />
          </View>

          <Text style={styles.heading}>You & {name}</Text>
          <Text style={styles.subheading}>
            You both liked each other! Break the ice and start a wonderful conversation.
          </Text>

          {/* Avatars Display */}
          <View style={styles.avatarsContainer}>
            {/* Current user avatar */}
            <View style={[styles.avatarWrapper, styles.leftAvatar]}>
              {currentUserPhotoUrl ? (
                <Image
                  source={{ uri: currentUserPhotoUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                  <Text style={styles.placeholderAvatarText}>You</Text>
                </View>
              )}
            </View>

            {/* Center Heart between avatars */}
            <Animated.View
              style={[
                styles.heartCircle,
                { transform: [{ scale: heartScale }] },
              ]}
            >
              <Ionicons name="heart" size={22} color={Colors.white} />
            </Animated.View>

            {/* Matched user avatar */}
            <View style={[styles.avatarWrapper, styles.rightAvatar]}>
              {matchedUser.photoUrl ? (
                <Image
                  source={{ uri: matchedUser.photoUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                  <Text style={styles.placeholderAvatarText}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStartChat}
            activeOpacity={0.88}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Send a Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Keep Browsing</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: width - 48,
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 26,
    paddingHorizontal: 8,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    height: 110,
    position: 'relative',
    width: '100%',
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3.5,
    borderColor: Colors.primary,
    overflow: 'hidden',
    backgroundColor: Colors.primaryLight,
  },
  leftAvatar: {
    marginRight: -14,
    zIndex: 1,
  },
  rightAvatar: {
    marginLeft: -14,
    zIndex: 1,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
  placeholderAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  heartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: Colors.white,
  },
  primaryButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
