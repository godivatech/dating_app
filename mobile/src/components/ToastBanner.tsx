import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore, ToastType } from '../stores/toast-store';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOAST_ICONS: Record<
  ToastType,
  { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  success: {
    name: 'checkmark-circle',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  error: {
    name: 'alert-circle',
    color: '#EF4444',
    bg: '#FEF2F2',
  },
  info: {
    name: 'sparkles',
    color: Colors.primary,
    bg: '#FFF0F1',
  },
  like: {
    name: 'heart',
    color: Colors.primary,
    bg: '#FFF0F1',
  },
  message: {
    name: 'chatbubble-ellipses',
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  match: {
    name: 'flame',
    color: '#F59E0B',
    bg: '#FFFBEB',
  },
};

export const ToastBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);

  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, toast.duration || 3500);
    } else {
      dismiss();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast?.id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideToast();
    });
  };

  if (!toast) return null;

  const iconConfig = TOAST_ICONS[toast.type] || TOAST_ICONS.info;

  const handlePress = () => {
    if (toast.route) {
      const target = toast.route;
      dismiss();
      try {
        router.push(target as any);
      } catch (err) {
        console.warn('Toast navigation error:', err);
      }
    } else {
      dismiss();
    }
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayWrapper,
        {
          top: Platform.OS === 'ios' ? insets.top + 6 : insets.top + 10,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={handlePress}
      >
        <View style={[styles.iconBox, { backgroundColor: iconConfig.bg }]}>
          <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} />
        </View>

        <View style={styles.textBox}>
          {toast.title ? (
            <Text style={styles.titleText} numberOfLines={1}>
              {toast.title}
            </Text>
          ) : null}
          <Text
            style={[
              styles.messageText,
              !toast.title && styles.messageStandalone,
            ]}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
        </View>

        {toast.route ? (
          <View style={styles.actionPill}>
            <Text style={styles.actionPillText}>View</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 32, 420),
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textBox: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 1,
  },
  messageStandalone: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
    gap: 2,
  },
  actionPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
});
