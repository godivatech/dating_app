import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface ButterflyLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  textSize?: number;
}

export const ButterflyLogo: React.FC<ButterflyLogoProps> = ({
  size = 32,
  showText = false,
  textColor = Colors.textPrimary,
  textSize = 22,
}) => {
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { width: size, height: size }]}>
        {/* Coral Heart Wing */}
        <View style={[styles.heartWing, { width: size * 0.75, height: size * 0.75 }]}>
          <Ionicons name="heart" size={size * 0.7} color={Colors.primary} />
        </View>
        {/* Butterfly Wing Outline */}
        <View style={[styles.lineWing, { width: size * 0.9, height: size * 0.9 }]}>
          <Ionicons name="infinite-outline" size={size * 0.8} color="#222222" />
        </View>
      </View>
      {showText && (
        <Text style={[styles.text, { color: textColor, fontSize: textSize }]}>
          Truelove
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartWing: {
    position: 'absolute',
    right: 0,
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '15deg' }],
  },
  lineWing: {
    position: 'absolute',
    left: -2,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
