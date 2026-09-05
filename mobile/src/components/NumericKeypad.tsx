import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface NumericKeypadProps {
  onPressDigit: (digit: string) => void;
  onPressBackspace: () => void;
  disabled?: boolean;
}

const KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '', letters: '' }, // empty placeholder
  { digit: '0', letters: '' },
  { digit: 'backspace', letters: '' },
];

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onPressDigit,
  onPressBackspace,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {KEYS.map((key, index) => {
          if (key.digit === '') {
            return <View key={index} style={styles.keyPlaceholder} />;
          }

          if (key.digit === 'backspace') {
            return (
              <TouchableOpacity
                key={index}
                style={[styles.key, styles.backspaceKey]}
                onPress={onPressBackspace}
                disabled={disabled}
                activeOpacity={0.6}
              >
                <Ionicons name="backspace-outline" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              style={styles.key}
              onPress={() => onPressDigit(key.digit)}
              disabled={disabled}
              activeOpacity={0.6}
            >
              <Text style={styles.digitText}>{key.digit}</Text>
              {key.letters ? <Text style={styles.lettersText}>{key.letters}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  key: {
    width: '30%',
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  keyPlaceholder: {
    width: '30%',
    height: 54,
  },
  backspaceKey: {
    backgroundColor: '#F9FAFB',
  },
  digitText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  lettersText: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: -2,
    letterSpacing: 1,
  },
});
