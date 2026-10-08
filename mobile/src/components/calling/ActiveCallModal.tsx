import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../stores/call-store';
import { useSafetyStore } from '../../stores/safety-store';
import { CallType, ReportTargetType } from '../../../../shared/src/types';
import { ReportModal } from '../ReportModal';
import { useScreenCapturePrevention } from '../../hooks/useScreenCapturePrevention';
import { VideoSurfaceView } from './VideoSurfaceView';
import { toast } from '../../stores/toast-store';
import { Colors } from '../../theme/colors';

const NUM_BARS = 33;
const MID_INDEX = 16;

interface VoiceWaveformProps {
  isActive: boolean;
  isMuted: boolean;
}

/**
 * Pixel-perfect animated voice equalizer waveform.
 * Uses 33 symmetrically distributed bars matching the bell-curve
 * audio frequency visualization in the luxury calling screen.
 * 60fps native-driven animation loop with zero JS thread overhead.
 */
const VoiceWaveformVisualizer: React.FC<VoiceWaveformProps> = ({ isActive, isMuted }) => {
  const anim1 = useRef(new Animated.Value(1)).current;
  const anim2 = useRef(new Animated.Value(1)).current;
  const anim3 = useRef(new Animated.Value(1)).current;
  const anim4 = useRef(new Animated.Value(1)).current;
  const anim5 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive || isMuted) {
      Animated.parallel([
        Animated.timing(anim1, { toValue: 0.45, duration: 400, useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0.45, duration: 400, useNativeDriver: true }),
        Animated.timing(anim3, { toValue: 0.45, duration: 400, useNativeDriver: true }),
        Animated.timing(anim4, { toValue: 0.45, duration: 400, useNativeDriver: true }),
        Animated.timing(anim5, { toValue: 0.45, duration: 400, useNativeDriver: true }),
      ]).start();
      return;
    }

    const createOscillator = (val: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: max,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: min,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const l1 = createOscillator(anim1, 0.65, 1.25, 420);
    const l2 = createOscillator(anim2, 0.55, 1.35, 540);
    const l3 = createOscillator(anim3, 0.70, 1.20, 360);
    const l4 = createOscillator(anim4, 0.60, 1.30, 620);
    const l5 = createOscillator(anim5, 0.50, 1.15, 480);

    l1.start();
    l2.start();
    l3.start();
    l4.start();
    l5.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
      l4.stop();
      l5.stop();
    };
  }, [isActive, isMuted]);

  // Precompute base heights following Gaussian distribution
  const barsData = useMemo(() => {
    return Array.from({ length: NUM_BARS }, (_, i) => {
      const distance = Math.abs(i - MID_INDEX);
      const baseHeight = Math.max(3, Math.round(46 * Math.exp(-(distance * distance) / 54)));

      let color = 'rgba(255, 75, 114, 0.45)';
      if (distance <= 2) {
        color = '#FFAEC0'; // bright luminous center peak
      } else if (distance <= 5) {
        color = '#FF7294'; // vibrant coral-pink
      } else if (distance <= 9) {
        color = '#FF4B72'; // signature romantic coral
      } else if (distance <= 12) {
        color = 'rgba(255, 75, 114, 0.72)';
      }

      const animGroup = i % 5;
      const animVal =
        animGroup === 0
          ? anim1
          : animGroup === 1
          ? anim2
          : animGroup === 2
          ? anim3
          : animGroup === 3
          ? anim4
          : anim5;

      return { id: i, baseHeight, color, animVal };
    });
  }, []);

  return (
    <View style={waveformStyles.container}>
      {barsData.map((bar) => (
        <Animated.View
          key={bar.id}
          style={[
            waveformStyles.bar,
            {
              height: bar.baseHeight,
              backgroundColor: bar.color,
              transform: [{ scaleY: bar.animVal }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const waveformStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginTop: 26,
    marginBottom: 10,
  },
  bar: {
    width: 2.8,
    marginHorizontal: 1.8,
    borderRadius: 1.5,
  },
});

export const ActiveCallModal: React.FC = () => {
  const {
    callState,
    activeCall,
    durationSeconds,
    isMicMuted,
    isVideoMuted,
    currentAudioRoute,
    connectedExternalDevice,
    bluetoothDeviceName,
    headsetDeviceName,
    isCameraFlipped,
    partnerVideoMuted,
    partnerAudioMuted,
    statusMessage,
    toggleMic,
    toggleVideo,
    toggleSpeaker,
    setAudioRoute,
    detectAudioDevices,
    flipCamera,
    hangupCall,
  } = useCallStore();

  const { blockUser } = useSafetyStore();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [showSafetySheet, setShowSafetySheet] = useState(false);
  const [showAudioDeviceSheet, setShowAudioDeviceSheet] = useState(false);

  // Soft romantic breathing ambient aura around avatar
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const opacityAnim1 = useRef(new Animated.Value(0.28)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim1, {
            toValue: 1.15,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim1, {
            toValue: 0.12,
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
            toValue: 0.28,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, []);

  const isVisible =
    (callState === 'OUTGOING_RINGING' ||
      callState === 'CONNECTED' ||
      callState === 'ENDED') &&
    !!activeCall;

  // Immediately detect audio devices when call modal mounts or state changes
  useEffect(() => {
    if (isVisible) {
      detectAudioDevices();
    }
  }, [isVisible]);

  // Block screenshots and screen recordings during active video and voice calls
  useScreenCapturePrevention(isVisible);

  if (!isVisible || !activeCall) return null;

  const isVideo = activeCall.callType === CallType.VIDEO;
  const isConnected = callState === 'CONNECTED';
  const avatarUri = activeCall.partnerAvatarUrl || null;
  const nameInitial = (activeCall.partnerName || '?').charAt(0).toUpperCase();

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSafetyAction = () => {
    setShowSafetySheet(true);
  };

  // Resolve active audio routing details for UI presentation
  const getAudioRouteInfo = () => {
    switch (currentAudioRoute) {
      case 'BLUETOOTH':
        return {
          icon: 'bluetooth' as const,
          label: 'Bluetooth',
          deviceTag: bluetoothDeviceName || 'Bluetooth Headset',
          isActive: true,
        };
      case 'HEADSET':
        return {
          icon: 'headset' as const,
          label: 'Headset',
          deviceTag: headsetDeviceName || 'Wired Headset',
          isActive: true,
        };
      case 'SPEAKER':
        return {
          icon: 'volume-high' as const,
          label: 'Speaker',
          deviceTag: 'Speakerphone',
          isActive: true,
        };
      case 'EARPIECE':
      default:
        return {
          icon: 'volume-high' as const,
          label: 'Speaker',
          deviceTag: 'Phone Receiver',
          isActive: false,
        };
    }
  };

  const audioInfo = getAudioRouteInfo();

  return (
    <>
      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetUserId={activeCall.partnerUserId}
        targetType={ReportTargetType.USER}
        targetId={activeCall.partnerUserId}
        targetName={activeCall.partnerName}
        onSuccess={() => {
          setReportModalVisible(false);
          toast.success(
            'Our team is reviewing this call. Thank you for keeping our community safe.',
            'Report Submitted 🛡️',
          );
        }}
      />

      {/* In-Call Safety Action Sheet */}
      <Modal
        visible={showSafetySheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSafetySheet(false)}
      >
        <TouchableOpacity
          style={styles.safetySheetOverlay}
          activeOpacity={1}
          onPress={() => setShowSafetySheet(false)}
        >
          <View style={styles.safetySheetContent}>
            <View style={styles.safetySheetHandle} />
            <Text style={styles.safetySheetTitle}>In-Call Safety Actions</Text>

            <TouchableOpacity
              style={styles.safetySheetItem}
              onPress={() => {
                setShowSafetySheet(false);
                hangupCall();
                setReportModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.safetySheetIconBox, { backgroundColor: '#FFF0F1' }]}>
                <Ionicons name="flag-outline" size={20} color="#FD5D65" />
              </View>
              <View style={styles.safetySheetTextBox}>
                <Text style={styles.safetySheetLabel}>Report User & End Call</Text>
                <Text style={styles.safetySheetSubtext}>End call immediately and submit a safety report</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.safetySheetItem}
              onPress={async () => {
                setShowSafetySheet(false);
                hangupCall();
                await blockUser(activeCall.partnerUserId, 'Terminated call and blocked');
                toast.success(`${activeCall.partnerName} has been blocked.`, 'User Blocked');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.safetySheetIconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="ban-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.safetySheetTextBox}>
                <Text style={[styles.safetySheetLabel, { color: '#EF4444' }]}>Block & Hang Up</Text>
                <Text style={styles.safetySheetSubtext}>End call, disconnect, and block profile</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.safetySheetCancelBtn}
              onPress={() => setShowSafetySheet(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.safetySheetCancelText}>Cancel / Return to Call</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Audio Output Device Picker Sheet */}
      <Modal
        visible={showAudioDeviceSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAudioDeviceSheet(false)}
      >
        <TouchableOpacity
          style={styles.audioSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAudioDeviceSheet(false)}
        >
          <View style={styles.audioSheetContent}>
            <View style={styles.audioSheetHandle} />
            <View style={styles.audioSheetHeader}>
              <Text style={styles.audioSheetTitle}>Select Audio Output</Text>
              <Text style={styles.audioSheetSubtitle}>Route call audio to your preferred device</Text>
            </View>

            {/* Built-in Speakerphone */}
            <TouchableOpacity
              style={[
                styles.deviceOptionItem,
                currentAudioRoute === 'SPEAKER' && styles.deviceOptionSelected,
              ]}
              onPress={() => {
                setAudioRoute('SPEAKER');
                setShowAudioDeviceSheet(false);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.deviceOptionIconBox,
                  currentAudioRoute === 'SPEAKER' && styles.deviceOptionIconBoxActive,
                ]}
              >
                <Ionicons
                  name="volume-high"
                  size={22}
                  color={currentAudioRoute === 'SPEAKER' ? '#FD5D65' : '#FFFFFF'}
                />
              </View>
              <View style={styles.deviceOptionTextBox}>
                <Text style={styles.deviceOptionName}>Speakerphone</Text>
                <Text style={styles.deviceOptionDesc}>Built-in phone loudspeaker</Text>
              </View>
              {currentAudioRoute === 'SPEAKER' && (
                <Ionicons name="checkmark-circle" size={22} color="#FD5D65" />
              )}
            </TouchableOpacity>

            {/* Bluetooth Headset / Wireless Device */}
            {(connectedExternalDevice === 'BLUETOOTH' || currentAudioRoute === 'BLUETOOTH') && (
              <TouchableOpacity
                style={[
                  styles.deviceOptionItem,
                  currentAudioRoute === 'BLUETOOTH' && styles.deviceOptionSelected,
                ]}
                onPress={() => {
                  setAudioRoute('BLUETOOTH');
                  setShowAudioDeviceSheet(false);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.deviceOptionIconBox,
                    currentAudioRoute === 'BLUETOOTH' && styles.deviceOptionIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name="bluetooth"
                    size={22}
                    color={currentAudioRoute === 'BLUETOOTH' ? '#FD5D65' : '#FFFFFF'}
                  />
                </View>
                <View style={styles.deviceOptionTextBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.deviceOptionName}>
                      {bluetoothDeviceName || 'Bluetooth Headset'}
                    </Text>
                    {currentAudioRoute === 'BLUETOOTH' && (
                      <View style={styles.connectedBadge}>
                        <Text style={styles.connectedBadgeText}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.deviceOptionDesc}>
                    {currentAudioRoute === 'BLUETOOTH'
                      ? 'Audio routed to Bluetooth headset'
                      : 'Route call audio to Bluetooth headset / earbuds'}
                  </Text>
                </View>
                {currentAudioRoute === 'BLUETOOTH' && (
                  <Ionicons name="checkmark-circle" size={22} color="#FD5D65" />
                )}
              </TouchableOpacity>
            )}

            {/* Phone Receiver (Earpiece) */}
            <TouchableOpacity
              style={[
                styles.deviceOptionItem,
                currentAudioRoute === 'EARPIECE' && styles.deviceOptionSelected,
              ]}
              onPress={() => {
                setAudioRoute('EARPIECE');
                setShowAudioDeviceSheet(false);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.deviceOptionIconBox,
                  currentAudioRoute === 'EARPIECE' && styles.deviceOptionIconBoxActive,
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={22}
                  color={currentAudioRoute === 'EARPIECE' ? '#FD5D65' : '#FFFFFF'}
                />
              </View>
              <View style={styles.deviceOptionTextBox}>
                <Text style={styles.deviceOptionName}>Phone Receiver (Earpiece)</Text>
                <Text style={styles.deviceOptionDesc}>Private internal ear speaker</Text>
              </View>
              {currentAudioRoute === 'EARPIECE' && (
                <Ionicons name="checkmark-circle" size={22} color="#FD5D65" />
              )}
            </TouchableOpacity>

            {/* Wired Headset */}
            {(connectedExternalDevice === 'HEADSET' || currentAudioRoute === 'HEADSET') && (
              <TouchableOpacity
                style={[
                  styles.deviceOptionItem,
                  currentAudioRoute === 'HEADSET' && styles.deviceOptionSelected,
                ]}
                onPress={() => {
                  setAudioRoute('HEADSET');
                  setShowAudioDeviceSheet(false);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.deviceOptionIconBox,
                    currentAudioRoute === 'HEADSET' && styles.deviceOptionIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name="headset"
                    size={22}
                    color={currentAudioRoute === 'HEADSET' ? '#FD5D65' : '#FFFFFF'}
                  />
                </View>
                <View style={styles.deviceOptionTextBox}>
                  <Text style={styles.deviceOptionName}>
                    {headsetDeviceName || 'Wired Headset'}
                  </Text>
                  <Text style={styles.deviceOptionDesc}>3.5mm jack / USB audio</Text>
                </View>
                {currentAudioRoute === 'HEADSET' && (
                  <Ionicons name="checkmark-circle" size={22} color="#FD5D65" />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.audioSheetDoneBtn}
              onPress={() => setShowAudioDeviceSheet(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.audioSheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Main Call Fullscreen Window */}
      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
      >
        <View style={styles.container}>
          {/* Ambient Blurred Backdrop of Partner Photo */}
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={StyleSheet.absoluteFill}
              blurRadius={Platform.OS === 'android' ? 28 : 38}
            />
          ) : null}
          <View style={[StyleSheet.absoluteFill, styles.backdropOverlay]} />

          {/* Ambient Subtle Romantic Bokeh Hearts */}
          <View style={[styles.bokehHeart, styles.bokehHeartLeft]} pointerEvents="none">
            <Ionicons name="heart" size={120} color="rgba(255, 75, 114, 0.09)" />
          </View>
          <View style={[styles.bokehHeart, styles.bokehHeartRight]} pointerEvents="none">
            <Ionicons name="heart" size={145} color="rgba(255, 75, 114, 0.08)" />
          </View>
          <View style={[styles.bokehHeart, styles.bokehHeartBottom]} pointerEvents="none">
            <Ionicons name="heart" size={90} color="rgba(255, 75, 114, 0.07)" />
          </View>

          {/* Top Bar Floating Header */}
          <SafeAreaView style={styles.topSafeArea}>
            <View style={styles.topHeader}>
              {/* Left Minimize Chevron */}
              <TouchableOpacity
                style={styles.topCircleBtn}
                onPress={() => {
                  toast.info('Call remains connected in high quality audio', 'Active Call 📞');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Center Brand Dual Hearts & Dating App Title */}
              <View style={styles.topCenterBox}>
                <View style={styles.topHeartsRow}>
                  <Ionicons name="heart" size={18} color="#FF3E6C" style={styles.heartLeft} />
                  <Ionicons name="heart" size={14} color="#FF6584" style={styles.heartRight} />
                </View>
                <Text style={styles.topBrandTitle}>Dating App</Text>
              </View>

              {/* Right: Camera Flip (if Video Call) or Safety Shield */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {isConnected && isVideo && (
                  <TouchableOpacity
                    style={styles.topCircleBtn}
                    onPress={flipCamera}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.topCircleBtn}
                  onPress={handleSafetyAction}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Vibe Check 15-second Warning Banner */}
            {isConnected && activeCall.isVibeCheck && durationSeconds >= 45 && durationSeconds < 60 && (
              <View style={styles.vibeWarningBanner}>
                <Ionicons name="flash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.vibeWarningText}>
                  {Math.max(0, 60 - durationSeconds)}s left in your Free Vibe Check!
                </Text>
              </View>
            )}
          </SafeAreaView>

          {/* Main Stage: Center Avatar / Equalizer or Video Stream */}
          <View style={styles.mainStage}>
            {isConnected && isVideo && !partnerVideoMuted ? (
              // Active Video Stream Stage (Remote Partner)
              <View style={styles.videoSurfacePlaceholder}>
                <VideoSurfaceView
                  uid={activeCall.partnerAgoraUid || 2002}
                  channelId={activeCall.channelName}
                  avatarUrl={avatarUri}
                  isMuted={partnerVideoMuted}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>HD 720p</Text>
                </View>
              </View>
            ) : (
              // Voice Call Stage: Avatar, Ring, Name, Timer, Equalizer
              <View style={styles.centerStage}>
                {/* Avatar with Ambient Diffused Halo and Coral-Pink Border */}
                <View style={styles.avatarGlowContainer}>
                  {/* Diffused Pulsating Halo Aura */}
                  <Animated.View
                    style={[
                      styles.avatarAmbientHalo,
                      {
                        transform: [{ scale: pulseAnim1 }],
                        opacity: opacityAnim1,
                      },
                    ]}
                  />

                  {/* 184px Circular Avatar Container with 3px solid rim */}
                  <View style={styles.avatarRim}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarFallbackText}>{nameInitial}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Partner Name */}
                <Text style={styles.partnerName} numberOfLines={1}>
                  {activeCall.partnerName || 'User'}
                </Text>

                {/* Call Timer or Status */}
                <Text style={styles.callTimer}>
                  {isConnected
                    ? activeCall.isVibeCheck
                      ? `✨ Vibe Check (${Math.max(0, 60 - durationSeconds)}s)`
                      : formatTimer(durationSeconds)
                    : callState === 'OUTGOING_RINGING'
                    ? 'Calling...'
                    : callState === 'ENDED'
                    ? statusMessage || 'Call Ended'
                    : statusMessage || 'Connecting...'}
                </Text>

                {/* Pixel-Perfect Animated Voice Equalizer Waveform */}
                <VoiceWaveformVisualizer
                  isActive={isConnected}
                  isMuted={isMicMuted && partnerAudioMuted}
                />
              </View>
            )}

            {/* Local Video Picture-in-Picture (PiP) Window */}
            {isConnected && isVideo && (
              <View style={styles.pipWindow}>
                {isVideoMuted ? (
                  <View style={styles.pipMuted}>
                    <Ionicons name="videocam-off" size={22} color="#FD5D65" />
                  </View>
                ) : (
                  <VideoSurfaceView
                    uid={0}
                    isLocal={true}
                    avatarUrl={null}
                    isMuted={false}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </View>
            )}
          </View>

          {/* Bottom Floating Controls Toolbar */}
          <SafeAreaView style={styles.bottomSafeArea}>
            <View style={styles.bottomButtonsRow}>
              {/* 1. Mute Button */}
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[
                    styles.circularControlBtn,
                    isMicMuted && styles.circularControlBtnMuted,
                  ]}
                  onPress={toggleMic}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isMicMuted ? 'mic-off' : 'mic'}
                    size={28}
                    color={isMicMuted ? '#EF4444' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                <Text style={[styles.controlLabel, isMicMuted && styles.controlLabelMuted]}>
                  {isMicMuted ? 'Muted' : 'Mute'}
                </Text>
              </View>

              {/* Camera Toggle Button (Only if Video Call) */}
              {isVideo && (
                <View style={styles.controlItem}>
                  <TouchableOpacity
                    style={[
                      styles.circularControlBtn,
                      isVideoMuted && styles.circularControlBtnMuted,
                    ]}
                    onPress={toggleVideo}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isVideoMuted ? 'videocam-off' : 'videocam'}
                      size={28}
                      color={isVideoMuted ? '#EF4444' : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.controlLabel, isVideoMuted && styles.controlLabelMuted]}>
                    {isVideoMuted ? 'Cam Off' : 'Camera'}
                  </Text>
                </View>
              )}

              {/* 2. Speaker Button */}
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={[
                    styles.circularControlBtn,
                    audioInfo.isActive && styles.circularControlBtnActive,
                  ]}
                  onPress={toggleSpeaker}
                  onLongPress={() => {
                    detectAudioDevices();
                    setShowAudioDeviceSheet(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={audioInfo.icon}
                    size={28}
                    color={audioInfo.isActive ? '#FF537A' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.controlLabel,
                    audioInfo.isActive && styles.controlLabelActive,
                  ]}
                >
                  {audioInfo.label}
                </Text>
              </View>

              {/* 3. End Call Button */}
              <View style={styles.controlItem}>
                <TouchableOpacity
                  style={styles.endCallControlBtn}
                  onPress={() => hangupCall()}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="call"
                    size={32}
                    color="#FFFFFF"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </TouchableOpacity>
                <Text style={styles.controlLabel}>End Call</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F050C',
  },
  backdropOverlay: {
    backgroundColor: 'rgba(14, 5, 12, 0.78)',
  },
  bokehHeart: {
    position: 'absolute',
  },
  bokehHeartLeft: {
    top: '32%',
    left: -20,
    transform: [{ rotate: '-15deg' }],
  },
  bokehHeartRight: {
    top: '18%',
    right: -25,
    transform: [{ rotate: '22deg' }],
  },
  bokehHeartBottom: {
    bottom: '22%',
    left: 10,
    transform: [{ rotate: '8deg' }],
  },
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 42 : 12,
  },
  topCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  topCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  heartLeft: {
    transform: [{ rotate: '-10deg' }],
    marginRight: -4,
  },
  heartRight: {
    transform: [{ rotate: '14deg' }, { translateY: 2 }],
  },
  topBrandTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: 0.3,
  },
  vibeWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.88)',
    marginHorizontal: 32,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  vibeWarningText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mainStage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoSurfacePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoBadge: {
    position: 'absolute',
    top: 104,
    right: 22,
    backgroundColor: 'rgba(20, 5, 12, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.3)',
  },
  videoBadgeText: {
    color: '#FD5D65',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  avatarGlowContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarAmbientHalo: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(255, 75, 114, 0.28)',
  },
  avatarRim: {
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 3,
    borderColor: '#FF4B72',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FF4B72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  partnerName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  callTimer: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
  pipWindow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 88,
    right: 20,
    width: 104,
    height: 146,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(253, 93, 101, 0.5)',
    backgroundColor: '#1C0812',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  pipMuted: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18060F',
  },
  bottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 36 : 46,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingHorizontal: 20,
  },
  controlItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularControlBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  circularControlBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  circularControlBtnActive: {
    backgroundColor: 'rgba(255, 75, 114, 0.22)',
    borderColor: '#FF4B72',
  },
  endCallControlBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  controlLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  controlLabelMuted: {
    color: '#EF4444',
  },
  controlLabelActive: {
    color: '#FF537A',
    fontWeight: '600',
  },
  safetySheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  safetySheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  safetySheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  safetySheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  safetySheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  safetySheetIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  safetySheetTextBox: {
    flex: 1,
  },
  safetySheetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  safetySheetSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  safetySheetCancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetySheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  audioSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  audioSheetContent: {
    backgroundColor: '#1E0C16',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  audioSheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  audioSheetHeader: {
    marginBottom: 16,
  },
  audioSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  audioSheetSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deviceOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deviceOptionSelected: {
    backgroundColor: 'rgba(253, 93, 101, 0.12)',
    borderColor: '#FD5D65',
  },
  deviceOptionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceOptionIconBoxActive: {
    backgroundColor: 'rgba(253, 93, 101, 0.2)',
  },
  deviceOptionTextBox: {
    flex: 1,
  },
  deviceOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deviceOptionDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  connectedBadge: {
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  connectedBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  audioSheetDoneBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSheetDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
