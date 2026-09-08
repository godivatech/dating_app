import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMatchingStore } from '../src/stores/matching-store';
import { useChatStore } from '../src/stores/chat-store';
import { useSafetyStore } from '../src/stores/safety-store';
import { useScreenCapturePrevention } from '../src/hooks/useScreenCapturePrevention';
import {
  SafeMatch,
  ReportTargetType,
  IncomingLikesResponse,
  IncomingLikeCandidate,
  IncomingNoteItem,
} from '../../shared/src/types';
import { ReportModal } from '../src/components/ReportModal';
import { useBillingStore } from '../src/stores/billing-store';
import { PaywallModal } from '../src/components/PaywallModal';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import { apiClient } from '../src/services/api-client';
import { t } from '../src/i18n/strings';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

export default function MatchesScreen() {
  const router = useRouter();
  const {
    matches,
    isLoading,
    isRefreshing,
    error,
    incomingNotes,
    totalNotesCount,
    isNotesLoading,
    fetchMatches,
    loadMoreMatches,
    unmatch,
    fetchIncomingNotes,
    respondToNote,
  } = useMatchingStore();

  const { createOrGetConversationByMatchId } = useChatStore();
  const { blockUser } = useSafetyStore();
  const { openPaywall } = useBillingStore();

  const [selectedMatch, setSelectedMatch] = useState<SafeMatch | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [selectedNotePreview, setSelectedNotePreview] = useState<IncomingNoteItem | null>(null);
  const [selectedNotePhotoIndex, setSelectedNotePhotoIndex] = useState<number>(0);
  const [isRespondingToNote, setIsRespondingToNote] = useState<string | null>(null);

  const [isUnmatching, setIsUnmatching] = useState<boolean>(false);
  const [isStartingChat, setIsStartingChat] = useState<boolean>(false);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);

  const [incomingLikesData, setIncomingLikesData] = useState<IncomingLikesResponse | null>(null);

  // Prevent screenshots and screen recording when viewing sensitive member profile photos or private notes
  useScreenCapturePrevention(Boolean(selectedMatch || selectedNotePreview));

  const fetchIncomingLikes = async () => {
    try {
      const res = await apiClient.get<IncomingLikesResponse>('/matches/incoming-likes');
      setIncomingLikesData(res.data);
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchIncomingLikes();
    fetchIncomingNotes();
  }, [fetchMatches, fetchIncomingNotes]);

  const handleAcceptNote = async (noteItem: IncomingNoteItem) => {
    try {
      setIsRespondingToNote(noteItem.actionId);
      const res = await respondToNote(noteItem.actionId, noteItem.senderProfile.profileId, true);
      setIsRespondingToNote(null);
      if (selectedNotePreview?.actionId === noteItem.actionId) {
        setSelectedNotePreview(null);
      }

      if (res?.matched && res.match) {
        const newMatch = res.match;
        Alert.alert(
          'It’s a Match! 🎉',
          `You and ${noteItem.senderProfile.displayName} are now connected!`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Chat Now',
              style: 'default',
              onPress: () => handleStartChat(newMatch.id),
            },
          ],
        );
      } else {
        Alert.alert('Connected! ✨', `You matched with ${noteItem.senderProfile.displayName}!`);
      }
    } catch (err: any) {
      setIsRespondingToNote(null);
      Alert.alert('Error', err.message || 'Failed to accept note.');
    }
  };

  const handleDeclineNote = (noteItem: IncomingNoteItem) => {
    Alert.alert(
      'Decline Note',
      `Decline this note from ${noteItem.senderProfile.displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setIsRespondingToNote(noteItem.actionId);
            await respondToNote(noteItem.actionId, noteItem.senderProfile.profileId, false);
            setIsRespondingToNote(null);
            if (selectedNotePreview?.actionId === noteItem.actionId) {
              setSelectedNotePreview(null);
            }
          },
        },
      ],
    );
  };

  const handleStartChat = async (matchId: string) => {
    try {
      setIsStartingChat(true);
      const conversationId = await createOrGetConversationByMatchId(matchId);
      const match = matches.find((m) => m.id === matchId);
      setSelectedMatch(null);
      setIsStartingChat(false);
      router.push({
        pathname: `/chat/${conversationId}`,
        params: {
          partnerName: match?.matchedProfile?.displayName || '',
          partnerPhoto:
            match?.matchedProfile?.photos?.[0]?.thumbnailUrl ||
            match?.matchedProfile?.photos?.[0]?.mediumUrl ||
            '',
        },
      } as any);
    } catch (err: any) {
      setIsStartingChat(false);
      Alert.alert('Error', err.message || 'Failed to open chat.');
    }
  };

  const handleUnmatch = (match: SafeMatch) => {
    Alert.alert(
      'Unmatch Confirmation',
      `Are you sure you want to unmatch with ${match.matchedProfile.displayName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            setIsUnmatching(true);
            const success = await unmatch(match.id);
            setIsUnmatching(false);
            if (success) {
              setSelectedMatch(null);
            }
          },
        },
      ],
    );
  };

  const handleBlock = (match: SafeMatch) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${match.matchedProfile.displayName}? You will no longer see each other or be able to communicate.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const success = await blockUser(match.matchedProfile.userId);
            if (success) {
              setSelectedMatch(null);
              fetchMatches(true);
            }
          },
        },
      ],
    );
  };

  const renderMatchCard = ({ item }: { item: SafeMatch }) => {
    const candidate = item.matchedProfile;
    const photo = candidate.photos?.[0];
    const photoUrl =
      photo?.mediumUrl || photo?.thumbnailUrl || photo?.largeUrl || null;

    const matchedDate = new Date(item.matchedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => {
          setSelectedMatch(item);
          setSelectedPhotoIndex(0);
        }}
        activeOpacity={0.85}
      >
        <View style={styles.cardImageContainer}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardPlaceholder}>
              <Text style={styles.placeholderEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>✨ Match</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {candidate.displayName}, {candidate.age}
          </Text>
          {candidate.locationCity && (
            <Text style={styles.cardLocation} numberOfLines={1}>
              📍 {candidate.locationCity}
            </Text>
          )}
          <Text style={styles.cardDate}>Matched {matchedDate}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => {
    const hasNotes = incomingNotes && incomingNotes.length > 0;
    const hasLikes = incomingLikesData && incomingLikesData.totalCount > 0;

    if (!hasNotes && !hasLikes) return null;

    const isUnlocked = incomingLikesData?.unlocked;

    return (
      <View style={styles.listHeaderContainer}>
        {/* Phase 8: Direct Notes & Requests Shelf */}
        {hasNotes && (
          <View style={styles.notesSection}>
            <View style={styles.notesHeaderRow}>
              <View style={styles.notesTitleWithIcon}>
                <Ionicons name="mail" size={18} color="#E11D48" />
                <Text style={styles.notesSectionTitle}>Direct Notes & Requests</Text>
              </View>
              <View style={styles.notesCountBadge}>
                <Text style={styles.notesCountText}>{incomingNotes.length}</Text>
              </View>
            </View>
            <Text style={styles.notesSectionSubtitle}>
              Personal notes sent directly with interest. Accept to match instantly!
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.notesScrollContent}
            >
              {incomingNotes.map((noteItem) => {
                const cand = noteItem.senderProfile;
                const photo = cand.photos?.[0];
                const photoUrl = photo?.mediumUrl || photo?.thumbnailUrl || photo?.largeUrl || null;
                const isBusy = isRespondingToNote === noteItem.actionId;

                return (
                  <View key={noteItem.actionId} style={styles.noteCard}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        setSelectedNotePreview(noteItem);
                        setSelectedNotePhotoIndex(0);
                      }}
                      style={styles.noteCardTop}
                    >
                      <View style={styles.noteAvatarContainer}>
                        {photoUrl ? (
                          <Image source={{ uri: photoUrl }} style={styles.noteAvatar} />
                        ) : (
                          <View style={styles.noteAvatarPlaceholder}>
                            <Text style={styles.noteAvatarEmoji}>👤</Text>
                          </View>
                        )}
                        <View style={styles.noteHeartBadge}>
                          <Ionicons name="sparkles" size={10} color="#FFFFFF" />
                        </View>
                      </View>

                      <View style={styles.noteMetaContainer}>
                        <Text style={styles.noteSenderName} numberOfLines={1}>
                          {cand.displayName}, {cand.age}
                        </Text>
                        {cand.locationCity && (
                          <Text style={styles.noteSenderCity} numberOfLines={1}>
                            📍 {cand.locationCity}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Note message text bubble */}
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => {
                        setSelectedNotePreview(noteItem);
                        setSelectedNotePhotoIndex(0);
                      }}
                      style={styles.noteBubble}
                    >
                      <Text style={styles.noteBubbleQuote}>“</Text>
                      <Text style={styles.noteBubbleText} numberOfLines={3}>
                        {noteItem.note}
                      </Text>
                    </TouchableOpacity>

                    {/* Action buttons */}
                    <View style={styles.noteActionsRow}>
                      <TouchableOpacity
                        style={styles.noteDeclineBtn}
                        onPress={() => handleDeclineNote(noteItem)}
                        disabled={isBusy}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close" size={18} color="#64748B" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.noteAcceptBtn}
                        onPress={() => handleAcceptNote(noteItem)}
                        disabled={isBusy}
                        activeOpacity={0.85}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="heart" size={14} color="#FFFFFF" />
                            <Text style={styles.noteAcceptBtnText}>Match</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Who Liked You Gold Feature */}
        {hasLikes && (
          <View style={styles.whoLikedYouContainer}>
            <View style={styles.whoLikedYouHeader}>
              <Text style={styles.whoLikedYouTitle}>👑 {t('whoLikedYouTitle')}</Text>
              <View style={styles.whoLikedYouCountBadge}>
                <Text style={styles.whoLikedYouCountText}>
                  {incomingLikesData.totalCount}
                </Text>
              </View>
            </View>
            <Text style={styles.whoLikedYouSubtitle}>
              {t('whoLikedYouSubtitle', { count: incomingLikesData.totalCount })}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.incomingLikesScroll}
              contentContainerStyle={styles.incomingLikesContent}
            >
              {incomingLikesData.likes.map((item) => {
                const cand = item.candidate;
                const isBlurred = 'blurred' in cand && cand.blurred === true;
                const photoUrl =
                  !isBlurred && 'photos' in cand
                    ? cand.photos?.[0]?.thumbnailUrl || cand.photos?.[0]?.mediumUrl || null
                    : null;

                return (
                  <TouchableOpacity
                    key={item.actionId}
                    style={styles.incomingLikeCard}
                    onPress={() => {
                      if (!isUnlocked || isBlurred) {
                        openPaywall('SEE_LIKES');
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.incomingPhotoContainer}>
                      {isUnlocked && photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.incomingPhoto} />
                      ) : (
                        <View style={styles.blurredPhotoBox}>
                          <View style={styles.lockBadge}>
                            <Ionicons name="lock-closed" size={18} color={Colors.white} />
                          </View>
                        </View>
                      )}
                    </View>
                    <Text style={styles.incomingName} numberOfLines={1}>
                      {isUnlocked && !isBlurred ? cand.displayName : 'Someone'}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {!isUnlocked && (
                <TouchableOpacity
                  style={styles.unlockCard}
                  onPress={() => openPaywall('SEE_LIKES')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles" size={18} color={Colors.white} />
                  <Text style={styles.unlockCardText}>Unlock with Gold</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <PaywallModal />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          style={styles.headerIconButton}
        >
          <Text style={styles.headerIconText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Your Matches</Text>
          <Text style={styles.headerSubtitle}>
            {matches.length} {matches.length === 1 ? 'connection' : 'connections'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/discovery')}
          style={styles.headerDiscoverButton}
        >
          <Text style={styles.headerDiscoverText}>✨ Discover</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Main Content */}
      {isLoading && matches.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E94057" />
          <Text style={styles.loadingText}>Loading your matches...</Text>
        </View>
      ) : matches.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.emptyScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                fetchMatches(true);
                fetchIncomingLikes();
                fetchIncomingNotes();
              }}
              colors={['#E94057']}
              tintColor="#E94057"
            />
          }
        >
          {renderListHeader()}
          <View style={styles.emptyStateContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>💬</Text>
            </View>
            <Text style={styles.stateTitle}>No Matches Yet</Text>
            <Text style={styles.stateSubtitle}>
              Keep discovering profiles! When someone you like likes you back, or when you accept a direct note, they'll appear here.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/discovery')}
            >
              <Text style={styles.primaryButtonText}>Start Discovering</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          ListHeaderComponent={renderListHeader}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.listRow}
          onEndReached={loadMoreMatches}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                fetchMatches(true);
                fetchIncomingLikes();
                fetchIncomingNotes();
              }}
              colors={['#E94057']}
              tintColor="#E94057"
            />
          }
        />
      )}

      {/* Match Detail / Preview Modal */}
      <Modal
        visible={selectedMatch !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMatch(null)}
      >
        {selectedMatch && (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {selectedMatch.matchedProfile.displayName}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedMatch(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Photo Carousel in Modal */}
              <View style={styles.modalPhotoContainer}>
                {selectedMatch.matchedProfile.photos?.[selectedPhotoIndex]?.largeUrl ||
                selectedMatch.matchedProfile.photos?.[selectedPhotoIndex]?.mediumUrl ? (
                  <Image
                    source={{
                      uri:
                        selectedMatch.matchedProfile.photos[selectedPhotoIndex]
                          .largeUrl ||
                        selectedMatch.matchedProfile.photos[selectedPhotoIndex]
                          .mediumUrl ||
                        undefined,
                    }}
                    style={styles.modalPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.modalPlaceholder}>
                    <Text style={styles.placeholderEmoji}>👤</Text>
                  </View>
                )}

                {/* Multi-photo indicator dots */}
                {(selectedMatch.matchedProfile.photos || []).length > 1 && (
                  <View style={styles.modalPhotoDots}>
                    {selectedMatch.matchedProfile.photos.map((_, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setSelectedPhotoIndex(idx)}
                        style={[
                          styles.dot,
                          idx === selectedPhotoIndex
                            ? styles.dotActive
                            : styles.dotInactive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Bio & Details */}
              <View style={styles.modalDetails}>
                <Text style={styles.modalName}>
                  {selectedMatch.matchedProfile.displayName},{' '}
                  {selectedMatch.matchedProfile.age}
                </Text>
                {selectedMatch.matchedProfile.locationCity && (
                  <Text style={styles.modalLocation}>
                    📍 {selectedMatch.matchedProfile.locationCity}
                    {selectedMatch.matchedProfile.locationRegion
                      ? `, ${selectedMatch.matchedProfile.locationRegion}`
                      : ''}
                  </Text>
                )}

                {selectedMatch.matchedProfile.bio && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>About</Text>
                    <Text style={styles.modalBioText}>
                      {selectedMatch.matchedProfile.bio}
                    </Text>
                  </View>
                )}

                {selectedMatch.matchedProfile.interests &&
                  selectedMatch.matchedProfile.interests.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Interests</Text>
                      <View style={styles.modalInterestsGrid}>
                        {selectedMatch.matchedProfile.interests.map((interest) => (
                          <View key={interest.id} style={styles.modalInterestTag}>
                            <Text style={styles.modalInterestTagText}>
                              ✨ {interest.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Phase 7 Send Message Action */}
                <TouchableOpacity
                  style={styles.startChatButton}
                  onPress={() => handleStartChat(selectedMatch.id)}
                  disabled={isStartingChat}
                >
                  {isStartingChat ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.startChatButtonText}>
                      💬 Send Message to {selectedMatch.matchedProfile.displayName}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Unmatch Action Button */}
                <TouchableOpacity
                  style={styles.unmatchButton}
                  onPress={() => handleUnmatch(selectedMatch)}
                  disabled={isUnmatching || isStartingChat}
                >
                  {isUnmatching ? (
                    <ActivityIndicator color="#EF4444" size="small" />
                  ) : (
                    <Text style={styles.unmatchButtonText}>
                      🚫 Unmatch with {selectedMatch.matchedProfile.displayName}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Safety & Report Actions */}
                <View style={styles.safetyRow}>
                  <TouchableOpacity
                    style={styles.safetyActionBtn}
                    onPress={() => handleBlock(selectedMatch)}
                    disabled={isUnmatching || isStartingChat}
                  >
                    <Text style={styles.safetyActionText}>🛡️ Block User</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.safetyActionBtn}
                    onPress={() => setReportModalVisible(true)}
                    disabled={isUnmatching || isStartingChat}
                  >
                    <Text style={styles.safetyActionText}>⚠️ Report User</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Incoming Note Preview Modal */}
      <Modal
        visible={selectedNotePreview !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedNotePreview(null)}
      >
        {selectedNotePreview && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {selectedNotePreview.senderProfile.displayName}’s Note
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedNotePreview(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Photo Carousel in Modal */}
              <View style={styles.modalPhotoContainer}>
                {selectedNotePreview.senderProfile.photos?.[selectedNotePhotoIndex]?.largeUrl ||
                selectedNotePreview.senderProfile.photos?.[selectedNotePhotoIndex]?.mediumUrl ? (
                  <Image
                    source={{
                      uri:
                        selectedNotePreview.senderProfile.photos[selectedNotePhotoIndex].largeUrl ||
                        selectedNotePreview.senderProfile.photos[selectedNotePhotoIndex].mediumUrl ||
                        undefined,
                    }}
                    style={styles.modalPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.modalPlaceholder}>
                    <Text style={styles.placeholderEmoji}>👤</Text>
                  </View>
                )}

                {/* Multi-photo indicator dots */}
                {(selectedNotePreview.senderProfile.photos || []).length > 1 && (
                  <View style={styles.modalPhotoDots}>
                    {selectedNotePreview.senderProfile.photos.map((_, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setSelectedNotePhotoIndex(idx)}
                        style={[
                          styles.dot,
                          idx === selectedNotePhotoIndex
                            ? styles.dotActive
                            : styles.dotInactive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Bio & Details */}
              <View style={styles.modalDetails}>
                <Text style={styles.modalName}>
                  {selectedNotePreview.senderProfile.displayName},{' '}
                  {selectedNotePreview.senderProfile.age}
                </Text>
                {selectedNotePreview.senderProfile.locationCity && (
                  <Text style={styles.modalLocation}>
                    📍 {selectedNotePreview.senderProfile.locationCity}
                    {selectedNotePreview.senderProfile.locationRegion
                      ? `, ${selectedNotePreview.senderProfile.locationRegion}`
                      : ''}
                  </Text>
                )}

                {/* Direct Note Highlighted Box */}
                <View style={styles.modalNoteBanner}>
                  <View style={styles.modalNoteBannerHeader}>
                    <Ionicons name="mail-open" size={16} color="#E11D48" />
                    <Text style={styles.modalNoteBannerTitle}>Direct Note Message</Text>
                  </View>
                  <Text style={styles.modalNoteBannerQuote}>
                    “{selectedNotePreview.note}”
                  </Text>
                </View>

                {selectedNotePreview.senderProfile.bio && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>About</Text>
                    <Text style={styles.modalBioText}>
                      {selectedNotePreview.senderProfile.bio}
                    </Text>
                  </View>
                )}

                {selectedNotePreview.senderProfile.interests &&
                  selectedNotePreview.senderProfile.interests.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Interests</Text>
                      <View style={styles.modalInterestsGrid}>
                        {selectedNotePreview.senderProfile.interests.map((interest) => (
                          <View key={interest.id} style={styles.modalInterestTag}>
                            <Text style={styles.modalInterestTagText}>
                              ✨ {interest.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Action Buttons: Accept or Decline */}
                <View style={styles.modalNoteActionButtons}>
                  <TouchableOpacity
                    style={styles.modalNoteDeclineBtn}
                    onPress={() => handleDeclineNote(selectedNotePreview)}
                    disabled={isRespondingToNote === selectedNotePreview.actionId}
                  >
                    <Text style={styles.modalNoteDeclineText}>Decline Note</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalNoteAcceptBtn}
                    onPress={() => handleAcceptNote(selectedNotePreview)}
                    disabled={isRespondingToNote === selectedNotePreview.actionId}
                  >
                    {isRespondingToNote === selectedNotePreview.actionId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="heart" size={18} color="#FFFFFF" />
                        <Text style={styles.modalNoteAcceptText}>Accept & Match</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Safety Report Modal */}
      {selectedMatch && (
        <ReportModal
          visible={reportModalVisible}
          targetUserId={selectedMatch.matchedProfile.userId}
          targetType={ReportTargetType.USER}
          targetId={selectedMatch.matchedProfile.userId}
          targetName={selectedMatch.matchedProfile.displayName}
          onClose={() => setReportModalVisible(false)}
          onSuccess={() => {
            setReportModalVisible(false);
            setSelectedMatch(null);
            fetchMatches(true);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#E94057',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: {
    fontSize: 20,
    color: '#333333',
    fontWeight: '600',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
  },
  headerDiscoverButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF0F2',
  },
  headerDiscoverText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E94057',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    alignItems: 'center',
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  matchCard: {
    width: cardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: cardWidth * 1.25,
    backgroundColor: '#EEEEEE',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(233, 64, 87, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardInfo: {
    padding: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  cardLocation: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 10,
    color: '#999999',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#444444',
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  modalPhotoContainer: {
    width: width,
    height: width * 1.1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
  },
  modalPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  modalPhotoDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  modalDetails: {
    padding: 16,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  modalLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  modalBioText: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
  },
  modalInterestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalInterestTag: {
    backgroundColor: '#F4F5F7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  modalInterestTagText: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },
  startChatButton: {
    backgroundColor: '#E94057',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  unmatchButton: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    marginBottom: 10,
  },
  unmatchButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  safetyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  safetyActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyActionText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
  },
  whoLikedYouContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  whoLikedYouHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  whoLikedYouTitle: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 8,
  },
  whoLikedYouCountBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  whoLikedYouCountText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  whoLikedYouSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
  },
  incomingLikesScroll: {
    marginHorizontal: -4,
  },
  incomingLikesContent: {
    gap: 10,
    paddingRight: 10,
  },
  incomingLikeCard: {
    alignItems: 'center',
    width: 72,
  },
  incomingPhotoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F59E0B',
    marginBottom: 6,
  },
  incomingPhoto: {
    width: '100%',
    height: '100%',
  },
  blurredPhotoBox: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  blurredEmoji: {
    fontSize: 24,
    opacity: 0.3,
  },
  lockBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadgeIcon: {
    fontSize: 18,
  },
  incomingName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  unlockCard: {
    width: 90,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unlockCardIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  unlockCardText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  listHeaderContainer: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  emptyScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20,
  },
  notesSection: {
    backgroundColor: '#FFF1F2',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notesTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9F1239',
  },
  notesCountBadge: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notesCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  notesSectionSubtitle: {
    fontSize: 12,
    color: '#BE123C',
    marginBottom: 12,
  },
  notesScrollContent: {
    gap: 12,
    paddingRight: 8,
  },
  noteCard: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  noteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteAvatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  noteAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FDA4AF',
  },
  noteAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteAvatarEmoji: {
    fontSize: 20,
  },
  noteHeartBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#E11D48',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  noteMetaContainer: {
    flex: 1,
  },
  noteSenderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  noteSenderCity: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  noteBubble: {
    backgroundColor: '#FFF5F6',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  noteBubbleQuote: {
    fontSize: 18,
    lineHeight: 18,
    color: '#FB7185',
    fontWeight: '800',
  },
  noteBubbleText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: -4,
  },
  noteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteDeclineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteAcceptBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E94057',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  noteAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalNoteBanner: {
    backgroundColor: '#FFF1F2',
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  modalNoteBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  modalNoteBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E11D48',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalNoteBannerQuote: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 22,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  modalNoteActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  modalNoteDeclineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNoteDeclineText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  modalNoteAcceptBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#E94057',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  modalNoteAcceptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
