/**
 * Core user account statuses for the dating app authentication foundation.
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

/**
 * Safe public representation of an authenticated user account.
 * Excludes internal database security identifiers, hashes, and secrets.
 */
export interface SafeUser {
  id: string;
  phoneNumber: string; // Formatted/masked according to context
  phoneVerifiedAt: string | null;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

// --------------------------------------------------------------------------
// Auth DTOs & Responses
// --------------------------------------------------------------------------

export interface RequestOtpDto {
  phoneNumber: string;
}

export interface RequestOtpResponse {
  challengeId: string;
  expiresIn: number; // Seconds until expiration
}

export interface VerifyOtpDto {
  challengeId: string;
  otp: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthResponse {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until access token expiration
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
}

// --------------------------------------------------------------------------
// Phase 3: Profile & Onboarding Foundation Types
// --------------------------------------------------------------------------

export enum Gender {
  MAN = 'MAN',
  WOMAN = 'WOMAN',
  NON_BINARY = 'NON_BINARY',
  OTHER = 'OTHER',
}

export enum PreferredGenderMode {
  ANY = 'ANY',
  SELECTED = 'SELECTED',
}

export enum RelationshipIntent {
  LONG_TERM = 'LONG_TERM',
  MARRIAGE = 'MARRIAGE',
  SERIOUS_DATING = 'SERIOUS_DATING',
  OPEN_TO_EXPLORE = 'OPEN_TO_EXPLORE',
  CASUAL = 'CASUAL',
}

export enum ProfileVisibility {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

export enum ProfileStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  READY = 'READY',
}

export enum InterestStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Interest {
  id: string;
  name: string;
  category: string;
  status: InterestStatus;
}

export interface DatingPreferences {
  id: string;
  profileId: string;
  preferredGenderMode: PreferredGenderMode;
  preferredGenders: Gender[];
  minAge: number;
  maxAge: number;
  relationshipIntent: RelationshipIntent;
  createdAt: string;
  updatedAt: string;
}

export interface SafeDatingProfile {
  id: string;
  userId: string;
  displayName: string;
  age: number; // Derived dynamically from UTC calendar date of birth
  gender: Gender;
  bio: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string;
  visibility: ProfileVisibility;
  status: ProfileStatus;
  completionScore: number; // Derived dynamically (0-100)
  preferences: DatingPreferences | null;
  interests: Interest[];
  photos: SafeProfilePhoto[];
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletionResult {
  completionScore: number;
  status: ProfileStatus;
  missingFields: string[];
  isReady: boolean;
}

// --------------------------------------------------------------------------
// Phase 4: Profile Media Foundation Types & DTOs
// --------------------------------------------------------------------------

export enum PhotoStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PENDING_MODERATION = 'PENDING_MODERATION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DELETED = 'DELETED',
}

export interface SafeProfilePhoto {
  id: string;
  profileId: string;
  status: PhotoStatus;
  position: number;
  isPrimary: boolean; // Derived dynamically: position === 0 && status === APPROVED
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestPhotoUploadDto {
  mimeType: string;
  fileSize: number;
}

export interface RequestPhotoUploadResponse {
  photoId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface ReorderPhotosDto {
  photoIds: string[];
}

export interface ModeratePhotoDto {
  status: PhotoStatus.APPROVED | PhotoStatus.REJECTED;
  rejectionReason?: string;
}

// --------------------------------------------------------------------------
// Profile Onboarding DTOs
// --------------------------------------------------------------------------

export interface UpdateIdentityDto {
  displayName: string;
  dateOfBirth: string; // ISO 8601 YYYY-MM-DD
  gender: Gender;
}

export interface UpdatePreferencesDto {
  preferredGenderMode: PreferredGenderMode;
  preferredGenders?: Gender[];
  minAge: number;
  maxAge: number;
  relationshipIntent: RelationshipIntent;
}

export interface UpdateInterestsDto {
  interestIds: string[];
}

export interface UpdateAboutLocationDto {
  bio?: string;
  locationCity: string;
  locationRegion?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateLocationCoordsDto {
  latitude: number;
  longitude: number;
  locationCity?: string;
  locationRegion?: string;
}

export interface UpdateVisibilityDto {
  visibility: ProfileVisibility;
}

// --------------------------------------------------------------------------
// Phase 5: Discovery & Recommendation Foundation Types
// --------------------------------------------------------------------------

export interface DiscoveryCandidate {
  profileId: string;
  userId: string;
  displayName: string;
  age: number; // Derived dynamically from UTC calendar date of birth
  gender: Gender;
  bio: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string;
  relationshipIntent: RelationshipIntent | null;
  interests: Interest[];
  photos: SafeProfilePhoto[];
  algorithmVersion: string;
  distanceKm?: number | null;
  distanceDisplay?: string;
  isBoosted?: boolean;
}

export type DiscoveryIneligibleReason =
  | 'ACCOUNT_NOT_ACTIVE'
  | 'PROFILE_NOT_READY'
  | 'PROFILE_HIDDEN'
  | 'NO_APPROVED_PHOTOS'
  | 'AGE_RESTRICTION';

export interface DiscoveryEligibilityStatus {
  eligible: boolean;
  reason?: DiscoveryIneligibleReason;
  message?: string;
  missingFields?: string[];
  completionScore?: number;
}

export interface DiscoveryFeedResponse {
  candidates: DiscoveryCandidate[];
  nextCursor: string | null;
  hasMore: boolean;
  algorithmVersion: string;
  eligibility: DiscoveryEligibilityStatus;
}

export interface RecordImpressionItemDto {
  candidateProfileId: string;
  position: number;
  algorithmVersion?: string;
}

export interface RecordImpressionDto {
  impressions: RecordImpressionItemDto[];
}

export interface RecordImpressionResponse {
  recordedCount: number;
  success: boolean;
}

// --------------------------------------------------------------------------
// Phase 6: User Actions & Matching Foundation Types
// --------------------------------------------------------------------------

export enum ActionType {
  LIKE = 'LIKE',
  PASS = 'PASS',
}

export enum MatchStatus {
  ACTIVE = 'ACTIVE',
  UNMATCHED = 'UNMATCHED',
}

export interface RecordActionDto {
  targetProfileId: string;
  actionType: ActionType;
  algorithmVersion?: string;
  note?: string; // Direct Message / Note attached to like (max 150 chars)
}

export interface DirectNoteCandidate {
  actionId: string;
  senderProfile: DiscoveryCandidate;
  note: string;
  createdAt: string;
}

export interface DirectNotesListResponse {
  notes: DirectNoteCandidate[];
  totalCount: number;
}

export interface SafeMatch {
  id: string;
  matchedProfile: DiscoveryCandidate;
  matchedAt: string;
  status: MatchStatus;
}

export interface RecordActionResponse {
  action: ActionType;
  matched: boolean;
  match?: SafeMatch;
}

export interface RecordActionDto {
  targetProfileId: string;
  actionType: ActionType;
  algorithmVersion?: string;
  note?: string;
}

export interface IncomingNoteItem {
  actionId: string;
  senderProfile: DiscoveryCandidate;
  note: string;
  createdAt: string;
}

export interface IncomingNotesResponse {
  totalCount: number;
  notes: IncomingNoteItem[];
}

export interface MatchesListResponse {
  matches: SafeMatch[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UnmatchResponse {
  success: boolean;
  message: string;
}

// --------------------------------------------------------------------------
// Phase 7: Real-Time Chat & Messaging Foundation Types
// --------------------------------------------------------------------------

export enum MessageDeliveryStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum MessageType {
  TEXT = 'TEXT',
}

export interface SafeMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  clientMessageId: string;
  sequence: number;
  body: string;
  type: MessageType;
  deliveryStatus: MessageDeliveryStatus;
  createdAt: string;
  isMine?: boolean;
}

export interface SafeConversationSummary {
  id: string;
  matchId: string;
  matchedProfile: DiscoveryCandidate;
  lastMessage: SafeMessage | null;
  unreadCount: number;
  isMatchActive: boolean;
  updatedAt: string;
}

export interface ConversationsListResponse {
  conversations: SafeConversationSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MessagesListResponse {
  messages: SafeMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SendMessageDto {
  clientMessageId: string;
  body: string;
}

export interface ReadReceiptDto {
  throughSequence: number;
}

export interface DeliveryAckDto {
  messageId: string;
  sequence: number;
}

// --------------------------------------------------------------------------
// Phase 8: Safety, Blocking, Reporting & Moderation Types
// --------------------------------------------------------------------------

export enum ReportTargetType {
  USER = 'USER',
  PROFILE = 'PROFILE',
  PHOTO = 'PHOTO',
  MESSAGE = 'MESSAGE',
}

export enum ReportReason {
  HARASSMENT = 'HARASSMENT',
  HATE_OR_ABUSE = 'HATE_OR_ABUSE',
  SEXUAL_CONTENT = 'SEXUAL_CONTENT',
  SPAM = 'SPAM',
  SCAM_OR_FRAUD = 'SCAM_OR_FRAUD',
  IMPERSONATION = 'IMPERSONATION',
  MINOR_SAFETY = 'MINOR_SAFETY',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  OFF_PLATFORM_SOLICITATION = 'OFF_PLATFORM_SOLICITATION',
  THREAT_OR_DANGER = 'THREAT_OR_DANGER',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACTIONED = 'ACTIONED',
  DISMISSED = 'DISMISSED',
}

export enum ModerationActionType {
  WARN_USER = 'WARN_USER',
  HIDE_PROFILE = 'HIDE_PROFILE',
  UNHIDE_PROFILE = 'UNHIDE_PROFILE',
  REJECT_PHOTO = 'REJECT_PHOTO',
  SUSPEND_ACCOUNT = 'SUSPEND_ACCOUNT',
  BAN_ACCOUNT = 'BAN_ACCOUNT',
  RESTORE_ACCOUNT = 'RESTORE_ACCOUNT',
  DISMISS_REPORT = 'DISMISS_REPORT',
}

export interface CreateBlockDto {
  targetUserId: string;
  reason?: string;
}

export interface CreateReportDto {
  targetUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
  autoBlock?: boolean;
}

export interface SafeBlock {
  id: string;
  blockedUserId: string;
  blockedProfile?: DiscoveryCandidate;
  createdAt: string;
}

export interface BlocksListResponse {
  blocks: SafeBlock[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SafeReport {
  id: string;
  reporterUserId?: string;
  reportedUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportsListResponse {
  reports: SafeReport[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ModeratorActionDto {
  targetUserId: string;
  actionType: ModerationActionType;
  reason: string;
  reportId?: string;
  photoId?: string;
}

export interface ModerationAuditLogResponse {
  id: string;
  moderatorUserId: string;
  targetUserId: string;
  actionType: ModerationActionType;
  reason: string;
  reportId?: string;
  metadata?: any;
  createdAt: string;
}

export interface AuditLogsListResponse {
  logs: ModerationAuditLogResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

export enum StrikeSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface UserSafetyStrikeDto {
  id: string;
  userId: string;
  reason: string;
  severity: StrikeSeverity;
  strikeNumber: number;
  actionTaken: string;
  evidence?: string | null;
  createdAt: string;
}

export interface UserSafetyStatusDto {
  standing: 'GOOD' | 'WARNING' | 'RESTRICTED' | 'BANNED';
  activeStrikes: number;
  isMuted: boolean;
  isShadowBanned: boolean;
  messagingRestrictedUntil: string | null;
  shadowBannedUntil: string | null;
}

export enum ContentViolationCategory {
  PROFANITY = 'PROFANITY',
  HARASSMENT = 'HARASSMENT',
  CONTACT_INFO = 'CONTACT_INFO',
  SCAM = 'SCAM',
  SPAM = 'SPAM',
}

export interface ContentViolationDetail {
  category: ContentViolationCategory;
  matched: string;
  reason: string;
}

export interface ContentFilterResultDto {
  isClean: boolean;
  violations: ContentViolationDetail[];
  sanitizedText?: string;
}

// --------------------------------------------------------------------------
// Phase 9: Notifications, Device Registration & Viewable Profile Types
// --------------------------------------------------------------------------

export enum NotificationType {
  NEW_MATCH = 'NEW_MATCH',
  NEW_MESSAGE = 'NEW_MESSAGE',
  MISSED_CALL = 'MISSED_CALL',
  SAFETY_UPDATE = 'SAFETY_UPDATE',
  SYSTEM = 'SYSTEM',
}

export enum DevicePlatform {
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export interface SafeNotification {
  id: string;
  userId: string;
  type: NotificationType;
  referenceId?: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: SafeNotification[];
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface RegisterDeviceDto {
  token: string;
  platform: DevicePlatform;
  deviceModel?: string;
}

export interface DeviceRegistrationResponse {
  id: string;
  userId: string;
  platform: DevicePlatform;
  deviceModel?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ViewableProfileDto {
  profileId: string;
  userId: string;
  displayName: string;
  age: number;
  gender: Gender;
  bio: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string;
  relationshipIntent: RelationshipIntent | null;
  interests: Array<{ id: string; name: string; category: string }>;
  photos: SafeProfilePhoto[];
  distanceKm?: number | null;
  distanceDisplay?: string;
}

// --------------------------------------------------------------------------
// Phase 10: Monetization, Entitlements & Subscriptions Types
// --------------------------------------------------------------------------

export enum SubscriptionTier {
  FREE = 'FREE',
  PLUS = 'PLUS',
  GOLD = 'GOLD',
  A_LA_CARTE = 'A_LA_CARTE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  GRACE_PERIOD = 'GRACE_PERIOD',
  PAUSED = 'PAUSED',
}

export enum BillingPeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  ONE_TIME = 'ONE_TIME',
}

export enum PaymentProvider {
  APPLE = 'APPLE',
  GOOGLE = 'GOOGLE',
  MOCK = 'MOCK',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  REVOKED = 'REVOKED',
}

export enum EntitlementKey {
  UNLIMITED_LIKES = 'UNLIMITED_LIKES',
  SEE_LIKES = 'SEE_LIKES',
  REWIND_PASS = 'REWIND_PASS',
  PROFILE_BOOST = 'PROFILE_BOOST',
  ADVANCED_PREFERENCES = 'ADVANCED_PREFERENCES',
  DISCOVERY_PRIORITY = 'DISCOVERY_PRIORITY',
  VIDEO_CALL = 'VIDEO_CALL',
  AUDIO_CALL = 'AUDIO_CALL',
  UNLIMITED_DIRECT_NOTES = 'UNLIMITED_DIRECT_NOTES',
}

export enum EntitlementSource {
  SUBSCRIPTION = 'SUBSCRIPTION',
  ONE_TIME_PURCHASE = 'ONE_TIME_PURCHASE',
  PROMOTION = 'PROMOTION',
  ADMIN_GRANT = 'ADMIN_GRANT',
  REFERRAL = 'REFERRAL',
}

export interface SafeSubscriptionProduct {
  id: string;
  productKey: string;
  displayName: string;
  description: string | null;
  tier: SubscriptionTier;
  platform: DevicePlatform;
  storeProductId: string;
  currency: string;
  priceAmount: number; // In smallest currency unit (paisa, e.g. 29900 = ₹299.00)
  displayPrice: string; // e.g. "₹299"
  billingPeriod: BillingPeriod;
  isActive: boolean;
  features?: string[];
}

export interface SafeUserSubscription {
  id: string;
  userId: string;
  productId: string;
  product: SafeSubscriptionProduct;
  provider: PaymentProvider;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string;
  canceledAt: string | null;
  autoRenewing: boolean;
  lastVerifiedAt: string;
}

export interface SafeUserEntitlement {
  id: string;
  userId: string;
  entitlementKey: EntitlementKey;
  source: EntitlementSource;
  sourceReferenceId: string | null;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

export enum CoinTransactionType {
  PURCHASE_RECHARGE = 'PURCHASE_RECHARGE',
  SPEND_DIRECT_NOTE = 'SPEND_DIRECT_NOTE',
  SPEND_PROFILE_BOOST = 'SPEND_PROFILE_BOOST',
  SPEND_CALL_MINUTES = 'SPEND_CALL_MINUTES',
  SPEND_REWIND = 'SPEND_REWIND',
  SPEND_UNBLUR = 'SPEND_UNBLUR',
  ADMIN_GRANT = 'ADMIN_GRANT',
  REFUND = 'REFUND',
}

export interface SafeCoinTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: CoinTransactionType;
  description?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface SpendCoinsDto {
  amount: number;
  reason: 'DIRECT_NOTE' | 'BOOST' | 'CALL' | 'REWIND' | 'UNBLUR';
  referenceId?: string;
  description?: string;
}

export interface SpendCoinsResponse {
  success: boolean;
  coinsDeducted: number;
  remainingCoins: number;
  message: string;
}

export interface UserCreditBalanceDto {
  coins: number;
  directNotes: number;
  profileBoosts: number;
  callPassMinutes: number;
  boostExpiresAt: string | null;
}

export interface BillingStatusResponse {
  activeSubscription: SafeUserSubscription | null;
  entitlements: SafeUserEntitlement[];
  tier: SubscriptionTier;
  dailyLikesRemaining: number | null; // null means unlimited
  isSubscribed: boolean;
  creditBalance?: UserCreditBalanceDto;
}

export interface ActivateBoostResponse {
  success: boolean;
  expiresAt: string;
  remainingBoosts: number;
  message: string;
}

export interface VerifyPurchaseDto {
  platform: DevicePlatform;
  storeProductId: string;
  receiptToken: string;
  transactionId?: string;
  provider?: PaymentProvider;
}

export interface VerifyPurchaseResponse {
  success: boolean;
  transactionId: string;
  status: TransactionStatus;
  subscription: SafeUserSubscription | null;
  grantedEntitlements: EntitlementKey[];
  message: string;
}

export interface RestorePurchasesDto {
  platform: DevicePlatform;
  receiptTokens: string[];
}

export interface RestorePurchasesResponse {
  restored: boolean;
  activeSubscription: SafeUserSubscription | null;
  entitlements: SafeUserEntitlement[];
  message: string;
}

export interface IncomingLikeCandidate {
  actionId: string;
  createdAt: string;
  candidate: DiscoveryCandidate | {
    profileId: string;
    displayName: string;
    age: number;
    blurred: true;
    photoThumbnailUrl: string | null;
  };
}

export interface IncomingLikesResponse {
  totalCount: number;
  unlocked: boolean;
  likes: IncomingLikeCandidate[];
  nextCursor: string | null;
  hasMore: boolean;
}

// --------------------------------------------------------------------------
// Phase 11: Real-Time Audio & Video Calling Types
// --------------------------------------------------------------------------

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export enum CallStatus {
  INITIATED = 'INITIATED',
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  MISSED = 'MISSED',
  BUSY = 'BUSY',
  ENDED = 'ENDED',
  FAILED = 'FAILED',
}

export enum CallEndReason {
  CALLER_HANGUP = 'CALLER_HANGUP',
  RECEIVER_HANGUP = 'RECEIVER_HANGUP',
  MISSED_TIMEOUT = 'MISSED_TIMEOUT',
  REJECTED = 'REJECTED',
  BUSY = 'BUSY',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  SAFETY_TERMINATED = 'SAFETY_TERMINATED',
  VIBE_CHECK_COMPLETE = 'VIBE_CHECK_COMPLETE',
}

export interface SafeCallLog {
  id: string;
  matchId: string;
  callerUserId: string;
  receiverUserId: string;
  callType: CallType;
  status: CallStatus;
  channelName: string;
  durationSeconds: number;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  endReason: CallEndReason | null;
  createdAt: string;
}

export interface InitiateCallPayload {
  matchId: string;
  receiverUserId: string;
  callType: CallType;
}

export interface IncomingCallPayload {
  callId: string;
  matchId: string;
  callerUserId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  callType: CallType;
  channelName: string;
  isVibeCheck?: boolean;
  maxDurationSeconds?: number;
}

export interface AcceptCallPayload {
  callId: string;
}

export interface RejectCallPayload {
  callId: string;
  reason?: string;
}

export interface EndCallPayload {
  callId: string;
  reason?: CallEndReason;
}

export interface CallConnectedPayload {
  callId: string;
  channelName: string;
  rtcToken?: string;
  rtcUid?: number;
  agoraToken: string;
  agoraUid: number;
  callType: CallType;
  startedAt: string;
  connectedAt?: string;
  isVibeCheck?: boolean;
  maxDurationSeconds?: number;
}

export interface CallEndedNotification {
  callId: string;
  durationSeconds: number;
  reason: CallEndReason;
}

export interface CallBusyNotification {
  callId: string;
  message: string;
}

// --------------------------------------------------------------------------
// Phase 12: Admin Operations, Analytics & Management Contracts
// --------------------------------------------------------------------------

export interface AdminAnalyticsOverviewDto {
  totalUsers: number;
  activeToday: number;
  verifiedUsers: number;
  totalMatches: number;
  activeSubscriptions: {
    sparkPlus: number;
    sparkGold: number;
    total: number;
  };
  directNotePacksCount: number;
  pendingReportsCount: number;
  pendingPhotosCount: number;
  estimatedMonthlyRevenueInr: number;
}

export interface AdminUsersQueryDto {
  search?: string;
  status?: UserStatus;
  role?: UserRole;
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface AdminUserListItemDto {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  age: number | null;
  gender: Gender | null;
  status: UserStatus;
  role: UserRole;
  primaryPhotoUrl: string | null;
  activeStrikes: number;
  isMuted: boolean;
  isShadowBanned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUsersListResponse {
  users: AdminUserListItemDto[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminUserDetailDto {
  id: string;
  phoneNumber: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
  messagingRestrictedUntil: string | null;
  shadowBannedUntil: string | null;
  profile: {
    id: string;
    displayName: string;
    age: number;
    gender: Gender;
    bio: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    locationCountry: string | null;
    status: ProfileStatus;
    visibility: ProfileVisibility;
    photos: SafeProfilePhoto[];
    interests: { id: string; name: string; category: string }[];
    preferences: any;
  } | null;
  strikes: UserSafetyStrikeDto[];
  subscription: {
    planType: string;
    expiresAt: string | null;
    status: string;
  } | null;
  mutualMatchesCount: number;
  directNotesSentCount: number;
}

export type AdminDisciplineAction =
  | 'WARN'
  | 'MUTE_24H'
  | 'SHADOWBAN_7D'
  | 'BAN'
  | 'UNBAN'
  | 'RESET_STRIKES';

export interface AdminDisciplineDto {
  action: AdminDisciplineAction;
  reason: string;
}

export interface AdminPhotoQueueItemDto {
  photoId: string;
  userId: string;
  displayName: string;
  photoUrl: string;
  status: PhotoStatus;
  position: number;
  uploadedAt: string;
}

export interface AdminReviewPhotoDto {
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}

export interface AdminRevenueOverviewDto {
  realizedRevenueInr: number;
  monthlyRunRateInr: number;
  completedTransactionsCount: number;
  activeSubscribersCount: number;
  averageOrderValueInr: number;
  currency: string;
  tierBreakdown: Array<{
    id: string;
    tier: 'GOLD' | 'PLUS' | 'PACK' | 'COIN';
    name: string;
    priceDisplay: string;
    description: string;
    activeUnits: number;
    monthlyRevenueInr: number;
  }>;
  availableProducts: Array<{
    id: string;
    storeProductId: string;
    productKey: string;
    displayName: string;
    tier: string;
    priceInr: number;
  }>;
  benchmarkProjection: {
    projectedMonthlyRunRateInr: number;
    projectedSubscribers: number;
    projectedNotesVolume: number;
    projectedProfitMarginPercent: number;
    projectedNetProfitInr: number;
  };
}
