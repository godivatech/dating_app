import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafetyStore } from '../stores/safety-store';
import { ReportTargetType, ReportReason } from '../../../shared/src/types';

interface ReportModalProps {
  visible: boolean;
  targetUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REPORT_REASONS: Array<{ value: ReportReason; label: string; icon: string }> = [
  { value: ReportReason.HARASSMENT, label: 'Harassment or Bullying', icon: '🛑' },
  { value: ReportReason.INAPPROPRIATE_CONTENT, label: 'Inappropriate Content', icon: '⚠️' },
  { value: ReportReason.SPAM, label: 'Spam or Commercial Solicitation', icon: '📢' },
  { value: ReportReason.SCAM_OR_FRAUD, label: 'Scam, Fraud, or Phishing', icon: '💸' },
  { value: ReportReason.IMPERSONATION, label: 'Fake Profile or Impersonation', icon: '🎭' },
  { value: ReportReason.HATE_OR_ABUSE, label: 'Hate Speech or Abuse', icon: '🚫' },
  { value: ReportReason.SEXUAL_CONTENT, label: 'Nudity or Explicit Content', icon: '🔞' },
  { value: ReportReason.MINOR_SAFETY, label: 'Underage or Minor Safety', icon: '👶' },
  { value: ReportReason.THREAT_OR_DANGER, label: 'Violence or Physical Threat', icon: '🚨' },
  { value: ReportReason.OTHER, label: 'Other Concern', icon: '📝' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  targetUserId,
  targetType,
  targetId,
  targetName,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [autoBlock, setAutoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportUser = useSafetyStore((state) => state.reportUser);

  const handleReset = () => {
    setSelectedReason(null);
    setDescription('');
    setAutoBlock(true);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Reason Required', 'Please select a reason for your report.');
      return;
    }

    setIsSubmitting(true);
    const success = await reportUser({
      targetUserId,
      targetType,
      targetId,
      reason: selectedReason,
      description: description.trim() || undefined,
      autoBlock,
    });
    setIsSubmitting(false);

    if (success) {
      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep our community safe. Our moderation team will review this promptly.',
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              if (onSuccess) onSuccess();
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Submission Failed',
        'Unable to submit your report at this time. Please try again.',
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Report {targetName || 'User'}</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Your report is confidential. The user will not know who submitted it.
          </Text>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* Reason Selection */}
            <Text style={styles.sectionHeading}>Select a reason:</Text>
            <View style={styles.reasonsList}>
              {REPORT_REASONS.map((item) => {
                const isSelected = selectedReason === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.reasonOption,
                      isSelected && styles.reasonOptionSelected,
                    ]}
                    onPress={() => setSelectedReason(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reasonIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.reasonLabel,
                        isSelected && styles.reasonLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Additional Details */}
            <Text style={styles.sectionHeading}>
              Additional details (Optional):
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tell us what happened..."
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={3}
              maxLength={1000}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {description.length}/1000 characters
            </Text>

            {/* Auto-Block Toggle */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setAutoBlock(!autoBlock)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  autoBlock && styles.checkboxChecked,
                ]}
              >
                {autoBlock && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleTitle}>
                  Block this user immediately
                </Text>
                <Text style={styles.toggleSubtitle}>
                  They will no longer see your profile or send you messages.
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeIcon: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 18,
  },
  scrollArea: {
    maxHeight: 400,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1D1D6',
    marginTop: 10,
    marginBottom: 8,
  },
  reasonsList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonOptionSelected: {
    borderColor: '#FF4D67',
    backgroundColor: 'rgba(255, 77, 103, 0.12)',
  },
  reasonIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  reasonLabelSelected: {
    color: '#FF4D67',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#FF4D67',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  charCount: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2C2C2E',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#FF4D67',
    borderColor: '#FF4D67',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
  actions: {
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: '#FF4D67',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
