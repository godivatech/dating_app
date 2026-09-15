import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export interface CityPassportModalProps {
  visible: boolean;
  currentCity?: string | null;
  homeCity?: string | null;
  onClose: () => void;
  onSelectCity: (city: string, region?: string) => void;
  onResetLocation: () => void;
}

const POPULAR_DESTINATIONS = [
  { city: 'Chennai', region: 'Tamil Nadu', flag: '🏛️' },
  { city: 'Bengaluru', region: 'Karnataka', flag: '💻' },
  { city: 'Coimbatore', region: 'Tamil Nadu', flag: '🌿' },
  { city: 'Madurai', region: 'Tamil Nadu', flag: '🛕' },
  { city: 'Hyderabad', region: 'Telangana', flag: '💎' },
  { city: 'Mumbai', region: 'Maharashtra', flag: '🌊' },
  { city: 'Delhi NCR', region: 'Delhi', flag: '🕌' },
  { city: 'Pune', region: 'Maharashtra', flag: '🎓' },
  { city: 'Kochi', region: 'Kerala', flag: '🌴' },
  { city: 'Goa', region: 'Goa', flag: '🏖️' },
  { city: 'Kolkata', region: 'West Bengal', flag: '🎨' },
  { city: 'Dubai', region: 'UAE', flag: '🏙️' },
  { city: 'Singapore', region: 'Singapore', flag: '🦁' },
  { city: 'London', region: 'UK', flag: '🎡' },
];

export const CityPassportModal: React.FC<CityPassportModalProps> = ({
  visible,
  currentCity,
  homeCity,
  onClose,
  onSelectCity,
  onResetLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return POPULAR_DESTINATIONS;
    return POPULAR_DESTINATIONS.filter(
      (item) =>
        item.city.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleSelect = (city: string, region?: string) => {
    setSearchQuery('');
    onSelectCity(city, region);
    onClose();
  };

  const handleCustomSubmit = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      handleSelect(trimmed);
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    onResetLocation();
    onClose();
  };

  const isPassportActive = !!currentCity;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="airplane" size={20} color={Colors.primary} />
                <Text style={styles.title}>Travel Passport</Text>
              </View>
              <Text style={styles.subtitle}>
                Teleport your discovery radar to date in any city worldwide.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color={Colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Type any city (e.g. Bengaluru, Paris)..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleCustomSubmit}
              returnKeyType="search"
              autoCapitalize="words"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* If custom city typed that isn't in popular list */}
          {searchQuery.trim().length >= 2 && (
            <TouchableOpacity
              style={styles.customCityBtn}
              onPress={handleCustomSubmit}
              activeOpacity={0.8}
            >
              <Ionicons name="location-sharp" size={16} color={Colors.primary} />
              <Text style={styles.customCityText}>
                Explore in "{searchQuery.trim()}"
              </Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Reset to Local Home Button */}
          {isPassportActive && (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Ionicons name="locate-outline" size={16} color="#059669" />
              <Text style={styles.resetBtnText}>
                Reset to My Home Location ({homeCity || 'Nearby'})
              </Text>
            </TouchableOpacity>
          )}

          {/* Popular Cities Section */}
          <Text style={styles.sectionLabel}>
            {searchQuery ? 'Matching Cities' : 'Popular Destinations'}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.citiesGrid}
          >
            {filteredCities.map((item) => {
              const isSelected =
                currentCity?.toLowerCase() === item.city.toLowerCase();
              return (
                <TouchableOpacity
                  key={item.city}
                  style={[
                    styles.cityCard,
                    isSelected && styles.cityCardSelected,
                  ]}
                  onPress={() => handleSelect(item.city, item.region)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cityFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.cityName,
                        isSelected && styles.cityNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.city}
                    </Text>
                    <Text style={styles.cityRegion} numberOfLines={1}>
                      {item.region}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  customCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  customCityText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  citiesGrid: {
    gap: 8,
    paddingBottom: 20,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  cityCardSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  cityFlag: {
    fontSize: 20,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cityNameSelected: {
    color: Colors.primary,
  },
  cityRegion: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
