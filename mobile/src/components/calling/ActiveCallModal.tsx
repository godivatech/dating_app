import React, { useState, useRef, useEffect } from 'react';
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

  // Animated pulsing heartbeat concentric rings around avatar
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const opacityAnim1 = useRef(new Animated.Value(0.6)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const opacityAnim2 = useRef(new Animated.Value(0.4)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const opacityAnim3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
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
              duration: 2200,
              useNativeDriver: true,
            }),
            Animated.timing(opacityVal, {
              toValue: 0,
              duration: 2200,
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

    const loop1 = createPulseLoop(pulseAnim1, opacityAnim1, 0, 1.45, 0.55);
    const loop2 = createPulseLoop(pulseAnim2, opacityAnim2, 600, 1.75, 0.4);
    const loop3 = createPulseLoop(pulseAnim3, opacityAnim3, 1200, 2.05, 0.25);

    loop1.start();
    loop2.start();
    loop3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
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
          icon: 'phone-portrait-outline' as const,
          label: 'Earpiece',
          deviceTag: 'Phone Receiver',
          isActive: false,
        };
    }
  };

  const audioInfo = getAudioRouteInfo();

  return (
    <>
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

      {/* Sleek In-Call Safety Action Sheet */}
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

            {/* 1. Built-in Speakerphone */}
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

            {/* 2. Bluetooth Headset / Wireless Device (Shown strictly if detected or currently active) */}
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

            {/* 3. Phone Receiver (Earpiece) */}
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

            {/* 4. Wired Headset (Shown if detected or currently routed) */}
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

      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
      >
        <View style={styles.container}>
          {/* Ambient Brand Glow Aura (Behind Avatar) */}
          <View style={styles.ambientAura} />

          {/* Main Stage (Video or TrueLove Branded Avatar) */}
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
              // Audio Call or Camera Muted State with Romantic Heartbeat Waves
              <View style={styles.avatarCenterBox}>
                <View style={styles.avatarPulseWrapper}>
                  {/* Concentric Animated Waves */}
                  <Animated.View
                    style={[
                      styles.pulseWaveRing,
                      {
                        transform: [{ scale: pulseAnim3 }],
                        opacity: opacityAnim3,
                      },
                    ]}
                  />
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

                  {/* Brand Coral Glowing Core Avatar */}
                  <View style={styles.avatarGlow}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.largeAvatar} />
                    ) : (
                      <View style={styles.largeAvatarInitial}>
                        <Text style={styles.largeAvatarInitialText}>{nameInitial}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Partner Details */}
                <Text style={styles.stagePartnerName}>{activeCall.partnerName}</Text>
                <Text style={styles.stageStatusText}>
                  {isConnected
                    ? partnerVideoMuted
                      ? 'Camera is off'
                      : 'Voice Call Connected'
                    : statusMessage || 'Calling...'}
                </Text>

                {/* Connected Audio Device Badge & Selector */}
                <TouchableOpacity
                  style={styles.audioDeviceTag}
                  onPress={() => {
                    detectAudioDevices();
                    setShowAudioDeviceSheet(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={audioInfo.icon} size={13} color="#FD5D65" style={{ marginRight: 5 }} />
                  <Text style={styles.audioDeviceTagText}>{audioInfo.deviceTag}</Text>
                  <Ionicons name="chevron-down" size={12} color="#FD5D65" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
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

          {/* Top Bar Floating Controls */}
          <SafeAreaView style={styles.topSafeArea}>
            <View style={styles.topBar}>
              {/* Safety Shield Button */}
              <TouchableOpacity
                style={styles.shieldBtn}
                onPress={handleSafetyAction}
                activeOpacity={0.7}
              >
                <Ionicons name="shield-checkmark" size={20} color="#FD5D65" />
              </TouchableOpacity>

              {/* Call Timer / State Pill */}
              <View style={[styles.timerPill, activeCall.isVibeCheck && styles.vibeCheckPill]}>
                <View
                  style={[
                    styles.statusDot,
                    activeCall.isVibeCheck
                      ? styles.dotAmber
                      : isConnected
                      ? styles.dotGreen
                      : styles.dotCoral,
                  ]}
                />
                <Text style={[styles.timerText, activeCall.isVibeCheck && styles.vibeCheckText]}>
                  {isConnected
                    ? activeCall.isVibeCheck
                      ? `✨ Vibe Check (${Math.max(0, 60 - durationSeconds)}s)`
                      : formatTimer(durationSeconds)
                    : statusMessage || 'Calling...'}
                </Text>
              </View>

              {/* Camera Flip Button (Only during Video) */}
              {isConnected && isVideo ? (
                <TouchableOpacity
                  style={styles.topCircleBtn}
                  onPress={flipCamera}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 42 }} />
              )}
            </View>

            {/* Vibe Check 15-second Warning Banner */}
            {isConnected && activeCall.isVibeCheck && durationSeconds >= 45 && durationSeconds < 60 && (
              <View style={styles.vibeWarningBanner}>
                <Ionicons name="flash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.vibeWarningText}>
                  {Math.max(0, 60 - durationSeconds)}s left in your Free Vibe Check!
                </Text>
              </View>
            )}
          </SafeAreaView>

          {/* Bottom Floating Controls Toolbar */}
          <SafeAreaView style={styles.bottomSafeArea}>
            <View style={styles.toolbar}>
              {/* Mic Toggle */}
              <View style={styles.toolCol}>
                <TouchableOpacity
                  style={[styles.toolBtn, isMicMuted && styles.toolBtnMuted]}
                  onPress={toggleMic}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isMicMuted ? 'mic-off' : 'mic'}
                    size={24}
                    color={isMicMuted ? '#EF4444' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                <Text style={[styles.toolLabel, isMicMuted && styles.toolLabelMuted]}>
                  {isMicMuted ? 'Muted' : 'Mute'}
                </Text>
              </View>

              {/* Video Toggle (If video call) */}
              {isVideo && (
                <View style={styles.toolCol}>
                  <TouchableOpacity
                    style={[styles.toolBtn, isVideoMuted && styles.toolBtnMuted]}
                    onPress={toggleVideo}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isVideoMuted ? 'videocam-off' : 'videocam'}
                      size={24}
                      color={isVideoMuted ? '#EF4444' : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.toolLabel, isVideoMuted && styles.toolLabelMuted]}>
                    {isVideoMuted ? 'Cam Off' : 'Camera'}
                  </Text>
                </View>
              )}

              {/* Dynamic Audio Output Routing Button (Speaker, Bluetooth, Headset, Earpiece) */}
              <View style={styles.toolCol}>
                <TouchableOpacity
                  style={[
                    styles.toolBtn,
                    audioInfo.isActive && styles.toolBtnSpeakerActive,
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
                    size={24}
                    color={audioInfo.isActive ? '#FD5D65' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                <Text style={[styles.toolLabel, audioInfo.isActive && styles.toolLabelActive]}>
                  {audioInfo.label}
                </Text>
              </View>

              {/* End Call Button */}
              <View style={styles.toolCol}>
                <TouchableOpacity
                  style={styles.endCallBtn}
                  onPress={() => hangupCall()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <Text style={styles.toolLabelEnd}>End</Text>
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
    backgroundColor: '#14050C', // Romantic TrueLove midnight velvet
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
    top: 100,
    right: 20,
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
  avatarCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  avatarGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3.5,
    borderColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253, 93, 101, 0.2)',
    shadowColor: '#FD5D65',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  largeAvatar: {
    width: 144,
    height: 144,
    borderRadius: 72,
  },
  largeAvatarInitial: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarInitialText: {
    fontSize: 54,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stagePartnerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  stageStatusText: {
    color: '#FDA4AF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
  },
  audioDeviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(253, 93, 101, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  audioDeviceTagText: {
    color: '#FFE4E6',
    fontSize: 12,
    fontWeight: '600',
  },
  pipWindow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 18,
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
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 35 : 10,
  },
  shieldBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(25, 7, 15, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 7, 15, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  vibeCheckPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotCoral: {
    backgroundColor: '#FD5D65',
  },
  dotAmber: {
    backgroundColor: '#FBBF24',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  vibeCheckText: {
    color: '#FDE68A',
    fontWeight: '700',
  },
  vibeWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    marginHorizontal: 30,
    marginTop: 10,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '700',
  },
  topCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(25, 7, 15, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.25)',
  },
  bottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(20, 5, 12, 0.92)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(253, 93, 101, 0.25)',
  },
  toolCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  toolBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  toolBtnSpeakerActive: {
    backgroundColor: 'rgba(253, 93, 101, 0.25)',
    borderWidth: 1.5,
    borderColor: '#FD5D65',
    shadowColor: '#FD5D65',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  toolLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  toolLabelMuted: {
    color: '#EF4444',
  },
  toolLabelActive: {
    color: '#FD5D65',
    fontWeight: '700',
  },
  endCallBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  toolLabelEnd: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  safetySheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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

