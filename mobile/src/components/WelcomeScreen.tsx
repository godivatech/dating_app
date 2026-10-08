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

      {/* Full-bleed feel-good background portrait */}
      <ImageBackground
        source={require('../../assets/welcome-bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Subtle top vignette for brand header contrast */}
        <View style={styles.topVignette} />

        {/* Multi-layered smooth gradient fade into deep obsidian black */}
        <View style={styles.bottomGradientLayer1} />
        <View style={styles.bottomGradientLayer2} />
        <View style={styles.bottomGradientLayer3} />
        <View style={styles.bottomGradientLayer4} />

        {/* Ambient bottom romantic wave line & heart bokeh */}
        <View style={styles.bottomBokehArc} pointerEvents="none" />
        <View style={styles.bottomBokehHeart} pointerEvents="none">
          <Ionicons name="heart" size={68} color="rgba(255, 75, 114, 0.08)" />
        </View>

        <SafeAreaView style={styles.safeArea}>
          {/* Top Brand Header: TRUELOVE (TRUE in white, LOVE in coral-pink) + Verified Pill */}
          <View style={styles.topHeader}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleTrue}>TRUE</Text>
              <Text style={styles.brandTitleLove}>LOVE</Text>
            </View>

            <View style={styles.verifiedCapsule}>
              <View style={styles.verifiedIconCircle}>
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              </View>
              <Text style={styles.verifiedText}>VERIFIED</Text>
            </View>
          </View>

          {/* Bottom Editorial Content */}
          <View style={styles.bottomContent}>
            {/* Real Dating in Tamil Nadu Pill Tag */}
            <View style={styles.locationPill}>
              <Ionicons
                name="location-sharp"
                size={16}
                color="#FF4B72"
                style={styles.locationIcon}
              />
              <View>
                <Text style={styles.locationLine1}>REAL DATING IN</Text>
                <Text style={styles.locationLine2}>TAMIL NADU</Text>
              </View>
            </View>

            {/* Hero Headline: Find Your Person. */}
            <View style={styles.headlineContainer}>
              <Text style={styles.heroLineWhite}>Find</Text>
              <Text style={styles.heroLineWhite}>Your</Text>
              <Text style={styles.heroLinePink}>Person.</Text>
            </View>

            {/* Subtitle / Value Statement */}
            <Text style={styles.heroSubtitle}>
              Genuine dating for singles across Tamil Nadu. Verified profiles, real connections, zero games.
            </Text>

            {/* 3 Core Value Props Pillars */}
            <View style={styles.featuresRow}>
              {/* Feature 1: Verified Profiles */}
              <View style={styles.featureItem}>
                <View style={styles.featureIconBadge}>
                  <Ionicons name="shield-checkmark" size={20} color="#FF4B72" />
                </View>
                <Text style={styles.featureLabel}>Verified{'\n'}Profiles</Text>
              </View>

              <View style={styles.featureDivider} />

              {/* Feature 2: Real Connections */}
              <View style={styles.featureItem}>
                <View style={styles.featureIconBadge}>
                  <Ionicons name="people" size={20} color="#FF4B72" />
                </View>
                <Text style={styles.featureLabel}>Real{'\n'}Connections</Text>
              </View>

              <View style={styles.featureDivider} />

              {/* Feature 3: Local Tamil Nadu */}
              <View style={styles.featureItem}>
                <View style={styles.featureIconBadge}>
                  <Ionicons name="heart" size={20} color="#FF4B72" />
                </View>
                <Text style={styles.featureLabel}>Local{'\n'}Tamil Nadu</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              {/* Primary "Get Started →" Button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onGetStarted}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </TouchableOpacity>

              {/* Secondary Sign In Link */}
              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={onSignIn || onGetStarted}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.secondaryLinkPink}>Sign In</Text>
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
    backgroundColor: '#090308',
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
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bottomGradientLayer1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '68%',
    backgroundColor: 'rgba(10, 3, 9, 0.35)',
  },
  bottomGradientLayer2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '56%',
    backgroundColor: 'rgba(10, 3, 9, 0.65)',
  },
  bottomGradientLayer3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '44%',
    backgroundColor: 'rgba(10, 3, 9, 0.88)',
  },
  bottomGradientLayer4: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '26%',
    backgroundColor: '#0A0309',
  },
  bottomBokehArc: {
    position: 'absolute',
    bottom: -35,
    left: -20,
    right: -20,
    height: 110,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.16)',
  },
  bottomBokehHeart: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    opacity: 0.6,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 22 : 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 18,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleTrue: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  brandTitleLove: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FF4B72',
    letterSpacing: 1.2,
  },
  verifiedCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  verifiedIconCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#FF4B72',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  bottomContent: {
    marginBottom: 6,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    marginBottom: 14,
  },
  locationIcon: {
    marginRight: 7,
  },
  locationLine1: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  locationLine2: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  headlineContainer: {
    marginBottom: 4,
  },
  heroLineWhite: {
    fontSize: 50,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 52,
    letterSpacing: -0.6,
  },
  heroLinePink: {
    fontSize: 50,
    fontWeight: '900',
    color: '#FF4B72',
    lineHeight: 52,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 14.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 20,
    maxWidth: '96%',
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  featureItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  featureIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  featureDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 15,
  },
  actionContainer: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF3B62',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B62',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  secondaryLinkPink: {
    color: '#FF4B72',
    fontWeight: '700',
  },
});
