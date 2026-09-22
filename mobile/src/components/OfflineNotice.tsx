import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useNetworkStore } from '../stores/network-store';

export function OfflineNotice() {
  const insets = useSafeAreaInsets();
  const { isConnected, isChecking, checkConnection } = useNetworkStore();
  const [showRestored, setShowRestored] = useState(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const wasOffline = useRef(false);

  // Initial connection check & periodic background heartbeat ping (every 10s)
  useEffect(() => {
    checkConnection();
    const interval = setInterval(() => {
      checkConnection();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      setShowRestored(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else if (wasOffline.current) {
      // Show "Connected" green flash briefly before dismissing
      setShowRestored(true);
      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -80,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setShowRestored(false);
          wasOffline.current = false;
        });
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      // Normal online startup
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected]);

  // Don't render anything when fully connected and not showing restored flash
  if (isConnected && !showRestored) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Math.max(insets.top, 12),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          showRestored ? styles.pillOnline : styles.pillOffline,
        ]}
      >
        <Ionicons
          name={showRestored ? 'checkmark-circle' : 'cloud-offline'}
          size={16}
          color={Colors.white}
          style={styles.icon}
        />
        <Text style={styles.messageText}>
          {showRestored
            ? 'Back Online • Connected'
            : 'No Internet Connection'}
        </Text>

        {!showRestored && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => checkConnection()}
            disabled={isChecking}
            activeOpacity={0.8}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.retryText}>Retry</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  pillOffline: {
    backgroundColor: '#1E293B', // Sleek dark slate
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)', // Subtle red glow
  },
  pillOnline: {
    backgroundColor: '#059669', // Emerald green
    borderWidth: 1,
    borderColor: '#34D399',
  },
  icon: {
    marginRight: 8,
  },
  messageText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  retryButton: {
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  retryText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
