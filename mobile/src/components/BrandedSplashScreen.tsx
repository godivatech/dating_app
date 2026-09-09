import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BrandedSplashScreenProps {
  locationCity?: string | null;
  locationRegion?: string | null;
}

export const BrandedSplashScreen: React.FC<BrandedSplashScreenProps> = ({
  locationCity,
  locationRegion,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0.85)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Gentle breathing pulse animation for the central logo
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.85,
            duration: 1100,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // Subtle 3-dot wave animation at the bottom
    const dotsWave = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]),
    );

    breathing.start();
    dotsWave.start();

    return () => {
      breathing.stop();
      dotsWave.stop();
    };
  }, [pulseAnim, fadeAnim, dot1, dot2, dot3]);

  const locationDisplay = locationCity
    ? `${locationCity}${locationRegion ? `, ${locationRegion}` : ''}`
    : 'Tamil Nadu, India';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Location Bar (Swiggy-style context) */}
        <View style={styles.topContainer}>
          <View style={styles.locationBadge}>
            <Ionicons
              name="location-sharp"
              size={13}
              color="#FFFFFF"
              style={styles.locationIcon}
            />
            <Text style={styles.locationText}>{locationDisplay}</Text>
          </View>
        </View>

        {/* Center Brand Identity (Zomato/Swiggy-style) */}
        <View style={styles.centerContainer}>
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                transform: [{ scale: pulseAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            {/* Pure White Butterfly Emblem */}
            <View style={styles.iconContainer}>
              <View style={styles.heartWing}>
                <Ionicons name="heart" size={54} color="#FFFFFF" />
              </View>
              <View style={styles.infiniteWing}>
                <Ionicons
                  name="infinite-outline"
                  size={64}
                  color="rgba(255, 255, 255, 0.95)"
                />
              </View>
            </View>
          </Animated.View>

          {/* Bold Brand Wordmark */}
          <Text style={styles.brandTitle}>truelove</Text>

          {/* Glowing Hairline Divider (like Zomato) */}
          <View style={styles.divider} />

          {/* User-Selected Tagline */}
          <Text style={styles.tagline}>FIND YOUR PERSON</Text>
        </View>

        {/* Bottom Minimal Dots Loader */}
        <View style={styles.bottomContainer}>
          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, { opacity: dot1 }]} />
            <Animated.View style={[styles.dot, { opacity: dot2 }]} />
            <Animated.View style={[styles.dot, { opacity: dot3 }]} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary, // Full-bleed Brand Coral #FD5D65
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? 24 : 16,
    paddingHorizontal: 20,
  },
  topContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  locationIcon: {
    marginRight: 6,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 72,
    height: 72,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartWing: {
    position: 'absolute',
    right: 4,
    top: 4,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '15deg' }],
  },
  infiniteWing: {
    position: 'absolute',
    left: -2,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  divider: {
    width: 140,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 1,
    marginVertical: 14,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  bottomContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
});
