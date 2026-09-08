import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Vibration,
} from 'react-native';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export interface MatchedUserInfo {
  displayName: string;
  profileId?: string;
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
      // Celebratory vibration rhythm
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
          Animated.delay(200),
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

  if (!visible || !matchedUser) return null;

  const handleStartChat = () => {
    onClose();
    if (onSendMessage) {
      onSendMessage();
    } else {
      router.push('/conversations' as any);
    }
  };

  const name = matchedUser.displayName || 'Someone';

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
          {/* Confetti / Title Header */}
          <Text style={styles.badgeText}>✨ IT'S A MATCH! ✨</Text>
          <Text style={styles.heading}>You & {name}</Text>
          <Text style={styles.subheading}>
            You both liked each other! Start the conversation now.
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

            {/* Pulsing Heart between avatars */}
            <Animated.View
              style={[
                styles.heartCircle,
                { transform: [{ scale: heartScale }] },
              ]}
            >
              <Text style={styles.heartIcon}>❤️</Text>
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
            <Text style={styles.primaryButtonText}>Say Hello 👋</Text>
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
    backgroundColor: 'rgba(15, 12, 30, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: width - 48,
    maxWidth: 380,
    backgroundColor: '#1E1B2E',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#E1306C',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 110, 0.25)',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF4B6E',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 14,
    color: '#B0A8C0',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    height: 120,
    position: 'relative',
    width: '100%',
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#FF4B6E',
    overflow: 'hidden',
    backgroundColor: '#2A2540',
  },
  leftAvatar: {
    marginRight: -16,
    zIndex: 1,
  },
  rightAvatar: {
    marginLeft: -16,
    zIndex: 1,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#352D54',
  },
  placeholderAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  heartIcon: {
    fontSize: 22,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FF4B6E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#FF4B6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#A098B2',
    fontSize: 14,
    fontWeight: '600',
  },
});
