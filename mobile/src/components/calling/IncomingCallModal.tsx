import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
  Vibration,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../stores/call-store';
import { CallType } from '../../../../shared/src/types';
import { useScreenCapturePrevention } from '../../hooks/useScreenCapturePrevention';

export const IncomingCallModal: React.FC = () => {
  const {
    callState,
    activeCall,
    acceptIncomingCall,
    rejectIncomingCall,
  } = useCallStore();

  const isVisible = callState === 'INCOMING_RINGING' && !!activeCall;

  // Block screenshots and screen recordings on incoming call screens
  useScreenCapturePrevention(isVisible);

  // Soft breathing halo glow animation
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const opacityAnim1 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!isVisible) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim1, {
            toValue: 1.28,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim1, {
            toValue: 0.1,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim1, {
            toValue: 1,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim1, {
            toValue: 0.35,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isVisible]);

  // Trigger continuous ringing vibration while incoming call modal is visible
  useEffect(() => {
    if (isVisible) {
      try {
        Vibration.vibrate([0, 1000, 1000], true);
      } catch {}
    } else {
      try {
        Vibration.cancel();
      } catch {}
    }

    return () => {
      try {
        Vibration.cancel();
      } catch {}
    };
  }, [isVisible]);

  if (!isVisible || !activeCall) return null;

  const isVideo = activeCall.callType === CallType.VIDEO;
  const avatarUri = activeCall.partnerAvatarUrl || null;
  const nameInitial = (activeCall.partnerName || '?').charAt(0).toUpperCase();

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Ambient Blurred Backdrop of Partner Photo (FaceTime / Luxury Dating Style) */}
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={StyleSheet.absoluteFill}
            blurRadius={Platform.OS === 'android' ? 24 : 36}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.backdropOverlay]} />

        <SafeAreaView style={styles.safeArea}>
          {/* Top Info */}
          <View style={styles.topInfo}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={isVideo ? 'videocam' : 'call'}
                size={15}
                color="#FD5D65"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.typeBadgeText}>
                {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
              </Text>
            </View>
            <Text style={styles.callerName}>{activeCall.partnerName}</Text>
            <Text style={styles.ringingSubtext}>Ringing...</Text>
          </View>

          {/* Central Avatar with Soft Breathing Halo */}
          <View style={styles.avatarContainer}>
            <View style={styles.pulseWrapper}>
              <Animated.View
                style={[
                  styles.softAmbientHalo,
                  {
                    transform: [{ scale: pulseAnim1 }],
                    opacity: opacityAnim1,
                  },
                ]}
              />

              <View style={styles.avatarGlassRim}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarInitialCircle}>
                    <Text style={styles.avatarInitialText}>{nameInitial}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {/* Decline Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => rejectIncomingCall('Declined by user')}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            {/* Accept Button */}
            <View style={styles.actionCol}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={acceptIncomingCall}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isVideo ? 'videocam' : 'call'}
                  size={30}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D040A',
  },
  backdropOverlay: {
    backgroundColor: 'rgba(11, 4, 9, 0.82)',
  },
  ambientAura: {
    display: 'none',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 24 : 44,
    paddingHorizontal: 24,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 24,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  typeBadgeText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  ringingSubtext: {
    color: '#FDA4AF',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  pulseWrapper: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  softAmbientHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(253, 93, 101, 0.24)',
  },
  avatarGlassRim: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 16,
  },
  avatarImage: {
    width: 152,
    height: 152,
    borderRadius: 76,
  },
  avatarInitialCircle: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 54,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  actionCol: {
    alignItems: 'center',
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  actionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
});

