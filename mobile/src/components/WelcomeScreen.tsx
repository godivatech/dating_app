import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onSignIn,
}) => {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-bleed high-fashion feel-good background portrait */}
      <ImageBackground
        source={require('../../assets/welcome-bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Subtle top vignette for brand header contrast */}
        <View style={styles.topVignette} />

        {/* Multi-layered bottom gradient effect for crystal-clear readability */}
        <View style={styles.bottomGradientLayer1} />
        <View style={styles.bottomGradientLayer2} />
        <View style={styles.bottomGradientLayer3} />

        <SafeAreaView style={styles.safeArea}>
          {/* Top Brand Header */}
          <View style={styles.topHeader}>
            <Text style={styles.brandTitle}>TRUELOVE</Text>
            <View style={styles.topCapsuleBadge}>
              <Text style={styles.topCapsuleText}>AUTHENTIC</Text>
            </View>
          </View>

          {/* Bottom Editorial Content */}
          <View style={styles.bottomContent}>
            {/* Pill Tag with Sparkle Icon */}
            <View style={styles.pillTag}>
              <Ionicons
                name="sparkles"
                size={14}
                color="#FFFFFF"
                style={styles.pillIcon}
              />
              <Text style={styles.pillText}>CURATED DATING IN CHENNAI</Text>
            </View>

            {/* Massive Bold Editorial Headline (Option B) */}
            <Text style={styles.heroHeadline}>FIND</Text>
            <Text style={styles.heroHeadline}>YOUR</Text>
            <Text style={styles.heroHeadline}>PERSON.</Text>

            {/* Subtitle / Tagline */}
            <Text style={styles.heroSubtitle}>
              Curated dating for intentional singles in Chennai. Verified profiles, real connections, zero games.
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onGetStarted}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={onSignIn || onGetStarted}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.secondaryLinkBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'space-between',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bottomGradientLayer1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomGradientLayer2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  bottomGradientLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '32%',
    backgroundColor: 'rgba(10, 10, 14, 0.92)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: Platform.OS === 'android' ? 28 : 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2.5,
  },
  topCapsuleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  topCapsuleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  bottomContent: {
    marginBottom: 8,
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 16,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroHeadline: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 48,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 22,
    marginTop: 14,
    marginBottom: 28,
    maxWidth: '92%',
  },
  actionContainer: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary, // #FD5D65 brand coral
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  secondaryLink: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  secondaryLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  secondaryLinkBold: {
    fontWeight: '800',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
