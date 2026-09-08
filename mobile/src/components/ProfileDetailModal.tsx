import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export interface ProfileDetailData {
  id?: string;
  name?: string;
  age?: number;
  city?: string;
  bio?: string;
  photos?: Array<{ url: string; id?: string }>;
  primaryPhotoUrl?: string;
  primaryPhoto?: { url: string };
  distanceKm?: number | null;
  distanceDisplay?: string;
  interests?: string[];
}

interface ProfileDetailModalProps {
  visible: boolean;
  profile: ProfileDetailData | null;
  onClose: () => void;
  onStartChat?: (profileId: string) => void;
  onLike?: (profileId: string) => void;
  onPass?: (profileId: string) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  visible,
  profile,
  onClose,
  onStartChat,
  onLike,
  onPass,
}) => {
  if (!profile) return null;

  const photoUrl =
    profile.primaryPhoto?.url ||
    profile.primaryPhotoUrl ||
    profile.photos?.[0]?.url ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';

  const distanceLabel =
    profile.distanceDisplay ||
    (profile.distanceKm !== undefined && profile.distanceKm !== null
      ? profile.distanceKm < 1
        ? 'Less than 1 km away'
        : `${Math.round(profile.distanceKm)} km away`
      : profile.city || 'Nearby');
  const interests = profile.interests || ['Dancing', 'Gym & Fitness', 'Movie', 'Fashion'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Full Bleed Top Photo Hero */}
        <View style={styles.photoContainer}>
          <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />

          {/* Floating Top Header Overlays */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity style={styles.circleBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.circleBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="ellipsis-vertical" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Floating Distance Badge on Photo Top Right */}
          {distanceLabel ? (
            <View style={styles.distanceBadge}>
              <Ionicons name="location-sharp" size={12} color={Colors.white} />
              <Text style={styles.distanceText}>{distanceLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Sheet Card Overlapping Photo */}
        <View style={styles.bottomSheet}>
          {/* Floating Coral Chat Action Button overlapping border */}
          <TouchableOpacity
            style={styles.floatingChatBtn}
            onPress={() => {
              onClose();
              if (onStartChat && profile.id) onStartChat(profile.id);
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble" size={22} color={Colors.white} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            {/* Header: Name, Age & Location */}
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>
                {profile.name || 'Thomas M. Read'}
                {profile.age ? `, ${profile.age}` : ', 26'}
              </Text>
            </View>
            <Text style={styles.locationSubText}>
              {profile.city || distanceLabel || 'Nearby'}
            </Text>

            {/* Section: About Me */}
            {profile.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{profile.bio}</Text>
              </View>
            ) : null}

            {/* Section: Interests & Passions (Checkmark Tags) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsGrid}>
                {interests.map((interest: string, index: number) => (
                  <View key={index} style={styles.interestPill}>
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={Colors.primary}
                      style={styles.pillCheck}
                    />
                    <Text style={styles.interestPillText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick Decision Actions at bottom of profile */}
            <View style={styles.bottomActionsRow}>
              <TouchableOpacity
                style={styles.passActionBtn}
                onPress={() => {
                  onClose();
                  if (onPass && profile.id) onPass(profile.id);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={26} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.likeActionBtn}
                onPress={() => {
                  onClose();
                  if (onLike && profile.id) onLike(profile.id);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="heart" size={32} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  photoContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.48,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceBadge: {
    position: 'absolute',
    top: 54,
    right: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  distanceText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    position: 'relative',
    paddingTop: 24,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingChatBtn: {
    position: 'absolute',
    top: -24,
    right: 28,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  sheetScrollContent: {
    paddingBottom: 40,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  locationSubText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(253, 93, 101, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillCheck: {
    marginRight: 6,
  },
  interestPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  passActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  likeActionBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
});
