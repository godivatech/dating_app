import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
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

  if (!isVisible || !activeCall) return null;

  const isVideo = activeCall.callType === CallType.VIDEO;
  const avatarUri =
    activeCall.partnerAvatarUrl ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80';

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Info */}
          <View style={styles.topInfo}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={isVideo ? 'videocam' : 'call'}
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.typeBadgeText}>
                {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
              </Text>
            </View>
            <Text style={styles.callerName}>{activeCall.partnerName}</Text>
            <Text style={styles.ringingSubtext}>Ringing...</Text>
          </View>

          {/* Central Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.pulseCircle}>
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
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
    backgroundColor: '#0F172A',
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  ringingSubtext: {
    color: '#94A3B8',
    fontSize: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  pulseCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  avatarImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
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
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  actionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
});
