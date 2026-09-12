import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface ScreenshotBlockedModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ScreenshotBlockedModal: React.FC<ScreenshotBlockedModalProps> = ({
  visible,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Privacy Protection Badge */}
          <View style={styles.iconWrapper}>
            <Ionicons name="eye-off" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Screenshots Restricted</Text>

          <Text style={styles.body}>
            To protect our members’ privacy and photo security, taking screenshots or screen recordings is not permitted on Truelove.
          </Text>

          {/* Reassurance Banner */}
          <View style={styles.reassuranceBox}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
            <Text style={styles.reassuranceText}>
              Your photos and personal conversations are strictly protected by Truelove.
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onClose}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  reassuranceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 20,
  },
  reassuranceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#9B2C2C',
    fontWeight: '500',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
