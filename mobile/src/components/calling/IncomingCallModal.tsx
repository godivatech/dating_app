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

  // Concentric animated heartbeat pulse rings
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const opacityAnim1 = useRef(new Animated.Value(0.6)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const opacityAnim2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!isVisible) return;

    const createPulseLoop = (
      scaleVal: Animated.Value,
      opacityVal: Animated.Value,
      delayMs: number,
      targetScale: number,
      initialOpacity: number,
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: targetScale,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityVal, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacityVal, {
              toValue: initialOpacity,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
    };

    const loop1 = createPulseLoop(pulseAnim1, opacityAnim1, 0, 1.5, 0.6);
    const loop2 = createPulseLoop(pulseAnim2, opacityAnim2, 600, 1.85, 0.4);

    loop1.start();
    loop2.start();

    return () => {
      loop1.stop();
      loop2.stop();
    };
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
        {/* Ambient Warm Romantic Glow */}
        <View style={styles.ambientAura} />

        <SafeAreaView style={styles.safeArea}>
          {/* Top Info */}
          <View style={styles.topInfo}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={isVideo ? 'videocam' : 'call'}
                size={16}
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

          {/* Central Avatar with Animated Concentric Waves */}
          <View style={styles.avatarContainer}>
            <View style={styles.pulseWrapper}>
              <Animated.View
                style={[
                  styles.pulseWaveRing,
                  {
                    transform: [{ scale: pulseAnim2 }],
                    opacity: opacityAnim2,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseWaveRing,
                  {
                    transform: [{ scale: pulseAnim1 }],
                    opacity: opacityAnim1,
                  },
                ]}
              />

              <View style={styles.avatarGlowCircle}>
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
    backgroundColor: '#14050C', // TrueLove dark romantic theme
  },
  ambientAura: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: '80%',
    height: '40%',
    borderRadius: 160,
    backgroundColor: 'rgba(253, 93, 101, 0.08)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 20 : 40,
    paddingHorizontal: 24,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 30,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(253, 93, 101, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.35)',
  },
  typeBadgeText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  ringingSubtext: {
    color: '#FDA4AF',
    fontSize: 16,
    fontWeight: '500',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  pulseWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseWaveRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#FD5D65',
    backgroundColor: 'rgba(253, 93, 101, 0.08)',
  },
  avatarGlowCircle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 3.5,
    borderColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 93, 101, 0.2)',
    shadowColor: '#FD5D65',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
  avatarImage: {
    width: 148,
    height: 148,
    borderRadius: 74,
  },
  avatarInitialCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 56,
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

