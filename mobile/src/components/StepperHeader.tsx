import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface StepperHeaderProps {
  currentStep: number;
  totalSteps?: number;
}

export const StepperHeader: React.FC<StepperHeaderProps> = ({
  currentStep,
  totalSteps = 5,
}) => {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <View style={styles.stepperWrapper}>
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isPending = step > currentStep;

          return (
            <React.Fragment key={step}>
              {/* Step Circle */}
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.completedCircle,
                  isActive && styles.activeCircle,
                  isPending && styles.pendingCircle,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.activeStepNumber,
                      isPending && styles.pendingStepNumber,
                    ]}
                  >
                    0{step}
                  </Text>
                )}
              </View>

              {/* Connecting Dashed Line */}
              {index < steps.length - 1 && (
                <View style={styles.connectorWrapper}>
                  <View
                    style={[
                      styles.connectorLine,
                      step < currentStep && styles.completedConnector,
                    ]}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
    paddingHorizontal: 12,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCircle: {
    backgroundColor: Colors.primary,
  },
  activeCircle: {
    backgroundColor: Colors.dark,
  },
  pendingCircle: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeStepNumber: {
    color: Colors.white,
  },
  pendingStepNumber: {
    color: Colors.textMuted,
  },
  connectorWrapper: {
    flex: 1,
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  connectorLine: {
    width: '100%',
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completedConnector: {
    borderColor: Colors.primary,
  },
});

