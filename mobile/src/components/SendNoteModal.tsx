import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { DiscoveryCandidate, ActionType } from '../../../shared/src/types';
import { useDiscoveryStore } from '../stores/discovery-store';
import { useBillingStore } from '../stores/billing-store';

interface SendNoteModalProps {
  visible: boolean;
  candidate: DiscoveryCandidate | null;
  onClose: () => void;
  onSent?: (matched: boolean) => void;
}

const MAX_NOTE_LENGTH = 150;

export function SendNoteModal({
  visible,
  candidate,
  onClose,
  onSent,
}: SendNoteModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { recordAction } = useDiscoveryStore();
  const { openPaywall, creditBalance } = useBillingStore();

  if (!candidate) return null;

  const primaryPhoto = candidate.photos.find((p) => p.isPrimary) || candidate.photos[0];
  const photoUrl = primaryPhoto?.mediumUrl || primaryPhoto?.thumbnailUrl || null;
  const charsRemaining = MAX_NOTE_LENGTH - noteText.length;

  const handleSend = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || isSending) return;

    if (trimmed.length > MAX_NOTE_LENGTH) {
      Alert.alert('Note Too Long', `Notes cannot exceed ${MAX_NOTE_LENGTH} characters.`);
      return;
    }

    try {
      setIsSending(true);
      const res = await recordAction(candidate.profileId, ActionType.LIKE, trimmed);
      setIsSending(false);

      if (res) {
        setNoteText('');
        onClose();
        if (onSent) onSent(res.matched);

        if (res.matched) {
          Alert.alert(
            "It's a Match! 🎉",
            `You and ${candidate.displayName} liked each other! Head to Matches to chat.`,
          );
        } else {
          Alert.alert('Note Sent 💌', `Your personal note was delivered to ${candidate.displayName}.`);
        }
      } else {
        // Check if quota was hit from store error
        const storeError = useDiscoveryStore.getState().error;
        if (storeError && storeError.toLowerCase().includes('free direct notes')) {
          onClose();
          openPaywall('DIRECT_NOTES');
        } else if (storeError) {
          Alert.alert('Safety Notice 🛡️', storeError);
        }
      }
    } catch (err: any) {
      setIsSending(false);
      const msg = err.response?.data?.message || err.message || 'Failed to send note.';
      if (typeof msg === 'string' && msg.toLowerCase().includes('free direct notes')) {
        onClose();
        openPaywall('DIRECT_NOTES');
      } else {
        Alert.alert('Safety Notice 🛡️', msg);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Header handle */}
          <View style={styles.sheetHandle} />

          {/* Recipient Profile Glance */}
          <View style={styles.candidateRow}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={24} color={Colors.textMuted} />
              </View>
            )}

            <View style={styles.candidateInfo}>
              <Text style={styles.candidateName}>
                {candidate.displayName}, {candidate.age}
              </Text>
              <Text style={styles.candidateLocation}>
                <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />{' '}
                {candidate.locationCity || 'Tamil Nadu'}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeIconBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Starter Value Proposition Badge */}
          <View style={styles.perkBadge}>
            <Ionicons name="sparkles" size={15} color="#D97706" />
            <Text style={styles.perkBadgeText}>
              {creditBalance && creditBalance.directNotes > 0
                ? `${creditBalance.directNotes} Direct Note credit${creditBalance.directNotes > 1 ? 's' : ''} available`
                : `Cost: 15 Coins • Wallet: ${creditBalance?.coins ?? 0} Coins`}
            </Text>
          </View>

          {/* Text input with live character counter */}
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder={`Say something nice to ${candidate.displayName}...`}
              placeholderTextColor={Colors.textMuted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={MAX_NOTE_LENGTH}
              autoFocus
            />
            <View style={styles.charCountRow}>
              <Text style={styles.guidelineText}>
                <Ionicons name="shield-checkmark-outline" size={12} color={Colors.textMuted} /> Respect community standards
              </Text>
              <Text
                style={[
                  styles.charCountText,
                  charsRemaining <= 20 && styles.charCountWarning,
                ]}
              >
                {charsRemaining}
              </Text>
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!noteText.trim() || isSending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!noteText.trim() || isSending}
            activeOpacity={0.85}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color={Colors.white} style={styles.sendIcon} />
                <Text style={styles.sendBtnText}>
                  Send Direct Note {creditBalance && creditBalance.directNotes > 0 ? '💌' : '(15 🪙)'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.backgroundSecondary,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateInfo: {
    flex: 1,
    marginLeft: 14,
  },
  candidateName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  candidateLocation: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeIconBtn: {
    padding: 6,
  },
  perkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    gap: 6,
  },
  perkBadgeText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  inputBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 110,
    marginBottom: 16,
  },
  textInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 65,
    textAlignVertical: 'top',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  guidelineText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  charCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  charCountWarning: {
    color: Colors.error,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    marginRight: 8,
  },
  sendBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
