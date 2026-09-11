import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../stores/call-store';
import { useSafetyStore } from '../../stores/safety-store';
import { CallType, ReportTargetType } from '../../../../shared/src/types';
import { ReportModal } from '../ReportModal';
import { useScreenCapturePrevention } from '../../hooks/useScreenCapturePrevention';
import { VideoSurfaceView } from './VideoSurfaceView';

export const ActiveCallModal: React.FC = () => {
  const {
    callState,
    activeCall,
    durationSeconds,
    isMicMuted,
    isVideoMuted,
    isSpeakerOn,
    isCameraFlipped,
    partnerVideoMuted,
    statusMessage,
    toggleMic,
    toggleVideo,
    toggleSpeaker,
    flipCamera,
    hangupCall,
  } = useCallStore();

  const { blockUser } = useSafetyStore();
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const isVisible =
    (callState === 'OUTGOING_RINGING' ||
      callState === 'CONNECTED' ||
      callState === 'ENDED') &&
    !!activeCall;

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
    Alert.alert(
      'Safety Options',
      'Need to report or block this user during the call?',
      [
        {
          text: 'Report User & End Call',
          style: 'destructive',
          onPress: () => {
            hangupCall();
            setReportModalVisible(true);
          },
        },
        {
          text: 'Block & Hang Up',
          style: 'destructive',
          onPress: async () => {
            hangupCall();
            await blockUser(activeCall.partnerUserId, 'Terminated call and blocked');
            Alert.alert('Blocked', `${activeCall.partnerName} has been blocked.`);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

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
          Alert.alert('Report Submitted', 'Thank you for keeping our community safe. Our team is reviewing this call.');
        }}
      />

      <Modal
        visible={isVisible}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
      >
        <View style={styles.container}>
          {/* Main Stage (Video or Avatar) */}
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
                  <Text style={styles.videoBadgeText}>HD Streaming</Text>
                </View>
              </View>
            ) : (
              // Audio Call or Camera Muted State
              <View style={styles.avatarCenterBox}>
                <View style={styles.avatarGlow}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.largeAvatar} />
                  ) : (
                    <View style={styles.largeAvatarInitial}>
                      <Text style={styles.largeAvatarInitialText}>{nameInitial}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.stagePartnerName}>{activeCall.partnerName}</Text>
                <Text style={styles.stageStatusText}>
                  {isConnected
                    ? partnerVideoMuted
                      ? 'Camera is off'
                      : 'Audio Call'
                    : statusMessage || 'Ringing...'}
                </Text>
              </View>
            )}

            {/* Local Video Picture-in-Picture (PiP) Window */}
            {isConnected && isVideo && (
              <View style={styles.pipWindow}>
                {isVideoMuted ? (
                  <View style={styles.pipMuted}>
                    <Ionicons name="videocam-off" size={20} color="#94A3B8" />
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
                <Ionicons name="shield-checkmark" size={20} color="#F43F5E" />
              </TouchableOpacity>

              {/* Call Timer / State */}
              <View style={[styles.timerPill, activeCall.isVibeCheck && styles.vibeCheckPill]}>
                <View
                  style={[
                    styles.statusDot,
                    activeCall.isVibeCheck ? styles.dotAmber : isConnected ? styles.dotGreen : styles.dotOrange,
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
                <View style={{ width: 40 }} />
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
              <TouchableOpacity
                style={[styles.toolBtn, isMicMuted && styles.toolBtnActive]}
                onPress={toggleMic}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isMicMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color={isMicMuted ? '#EF4444' : '#FFFFFF'}
                />
              </TouchableOpacity>

              {/* Video Toggle (If video call) */}
              {isVideo && (
                <TouchableOpacity
                  style={[styles.toolBtn, isVideoMuted && styles.toolBtnActive]}
                  onPress={toggleVideo}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isVideoMuted ? 'videocam-off' : 'videocam'}
                    size={24}
                    color={isVideoMuted ? '#EF4444' : '#FFFFFF'}
                  />
                </TouchableOpacity>
              )}

              {/* Speaker / Earpiece Toggle */}
              <TouchableOpacity
                style={[styles.toolBtn, isSpeakerOn && styles.toolBtnSpeakerActive]}
                onPress={toggleSpeaker}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSpeakerOn ? 'volume-high' : 'phone-portrait-outline'}
                  size={24}
                  color={isSpeakerOn ? '#38BDF8' : '#94A3B8'}
                />
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity
                style={styles.endCallBtn}
                onPress={() => hangupCall()}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
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
    backgroundColor: '#090D16',
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
  fullscreenVideoMock: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoBadge: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarCenterBox: {
    alignItems: 'center',
  },
  avatarGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    marginBottom: 24,
  },
  largeAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  largeAvatarInitial: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FD5D65',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarInitialText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stagePartnerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  stageStatusText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  pipWindow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 18,
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#1E293B',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  pipActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  pipMuted: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  pipLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  dotOrange: {
    backgroundColor: '#F59E0B',
  },
  dotAmber: {
    backgroundColor: '#FBBF24',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'space-evenly',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  toolBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  toolBtnSpeakerActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
