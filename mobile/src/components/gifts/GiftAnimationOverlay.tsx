import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Vibration,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useCreatorStore } from '../../stores/creator-store';
import { getGiftAsset } from '../../constants/gift-assets';

export const GiftAnimationOverlay: React.FC = () => {
  const activeGiftAnimation = useCreatorStore((state) => state.activeGiftAnimation);
  const dismissGiftAnimation = useCreatorStore((state) => state.dismissGiftAnimation);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeGiftAnimation) {
      try {
        Vibration.vibrate([0, 120, 80, 180]);
      } catch {}

      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      floatAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [activeGiftAnimation]);

  if (!activeGiftAnimation) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.4,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissGiftAnimation();
    });
  };

  return (
    <View style={styles.fullscreenBackdrop} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={handleDismiss}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }, { translateY: floatAnim }],
            },
          ]}
        >
          {/* Glowing Aura */}
          <View style={styles.glowCircle} />

          {/* Big Floating 3D Gift Asset */}
          <Image
            source={getGiftAsset(activeGiftAnimation.giftType)}
            style={styles.giftAssetImage}
            resizeMode="contain"
          />

          {/* Banner Pill */}
          <View style={styles.bannerPill}>
            <Text style={styles.congratsText}>Special Gift Received</Text>
            <Text style={styles.senderText}>
              <Text style={{ fontWeight: '800', color: Colors.primary }}>
                {activeGiftAnimation.senderDisplayName}
              </Text>{' '}
              sent you a {activeGiftAnimation.displayName}!
            </Text>
            <View style={styles.earningsPill}>
              <Ionicons name="sparkles" size={13} color={Colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.earningsPillText}>
                Creator Wallet Credited
              </Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  fullscreenBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  glowCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primaryGlow,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
  },
  giftAssetImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  bannerPill: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  congratsText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  senderText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  earningsPillText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
});
