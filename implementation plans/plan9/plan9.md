# Phase 9: Dating Experience, Profile Interaction & Engagement Foundation — Implementation Plan

## 1. Executive Summary & Objective

Phase 9 transforms the dating application from a collection of technical modules into a cohesive, high-quality **dating experience**. It builds an integration and engagement layer over the existing foundations (Auth, Profile, Photos, Discovery, Matching, Chat, Safety) without introducing AI matching, payments/subscriptions, or gamification.

The key goals are:
- **Full Viewable Profile Experience**: Authenticated inspection of candidate and match profiles with photo carousels, verified age, location, bio, interests, and relationship intent.
- **Profile Editing with Dynamic Readiness & DOB Revalidation**: Comprehensive editing with deterministic server-side completion recalculation and strict 18+ validation.
- **Resilient Notification Foundation**: Decoupled, post-transaction notification creation with unique idempotency keys, unread counts, and iOS/Android device token registration.
- **Safe Deep Linking**: Authorization and safety revalidation on every navigation target.
- **Unified Mobile Dashboard & UX**: Centralized home hub, empty/loading/error states, Tamil Nadu localization foundation, and IST 12-hour time formatting.

---

## 2. Mandatory Architectural Rules & Corrections

```text
                    ┌────────────────────────┐
                    │    Profile Mutation    │
                    └───────────┬────────────┘
                                ↓
                       Server Validation
                                ↓
                    Completion Recomputation
                    (completionService.evaluate)
                                ↓
                      Safety / Eligibility
                                ↓
               ┌────────────────┼────────────────┐
               ↓                ↓                ↓
           Discovery          Match            Chat
```

### 1. Authenticated Viewable Profile (Not "Public Profile")
- Endpoint: `GET /profile/view/:profileId` (requires `JwtAuthGuard`).
- Method: `ProfileService.getViewableProfile(requesterUserId, profileId)`.
- Authoritative evaluation pipeline:
  ```text
  Authenticated Requester
        ↓
  SafetyPolicyService.canViewProfile (mutual blocks & status check)
        ↓
  Target Profile Visibility (HIDDEN vs VISIBLE)
        ↓
  Target Account Status (ACTIVE only)
        ↓
  Filter to Approved Photos Only
        ↓
  Safe ViewableProfileDto (derived age, zero raw DOB/phone)
  ```

### 2. Decoupled Event / Notification Dispatch (Post-Transaction)
- Notification generation must NEVER run inside the critical database transaction of Like/Pass actions or Message persistence.
- Flow:
  ```text
  Message Persisted & Committed in DB
        ↓
  Post-Commit Event Dispatch (try / catch safe boundary)
        ↓
  NotificationsService.createNotification (idempotent key)
  ```
- If notification creation fails or encounters Redis/network delays, the message or match transaction is **never rolled back**.

### 3. Streamlined Notification Types (No MESSAGE_READ)
- `NotificationType` Enum:
  - `NEW_MATCH`: Triggered when mutual like forms an active match.
  - `NEW_MESSAGE`: Triggered when a new chat message is delivered.
  - `SAFETY_UPDATE`: Triggered on moderation actions (warnings, report reviews, account restoration).
  - `SYSTEM`: General system broadcasts.
- *Omit `MESSAGE_READ`* to prevent high-volume notification bloat. Read status remains strictly within Chat participant states.

### 4. Mobile Device Platform Scope (iOS & Android Only)
- `DevicePlatform` Enum: `IOS`, `ANDROID` (no premature `WEB` support).

### 5. Deterministic Readiness & Eligibility Recomputation
- Every profile update (Identity/DOB, Preferences, Interests, About/Location, Visibility) deterministically invokes `completionService.evaluate()`.
- Updates `DatingProfile.status` (`NOT_STARTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY`).
- Age is recalculated on DOB changes with strict 18+ enforcement.

---

## 3. Database Schema Updates (`backend/prisma/schema.prisma`)

```prisma
enum NotificationType {
  NEW_MATCH
  NEW_MESSAGE
  SAFETY_UPDATE
  SYSTEM
}

enum DevicePlatform {
  IOS
  ANDROID
}

model Notification {
  id             String           @id @default(uuid())
  userId         String
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type           NotificationType
  referenceId    String?          // e.g. matchId, conversationId, reportId
  title          String
  body           String           // Sanitized summary, no private message content
  metadata       Json?            // Safe navigation target metadata { route, id }
  isRead         Boolean          @default(false)
  readAt         DateTime?
  idempotencyKey String?          // Unique per user for deduplication
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@unique([userId, idempotencyKey])
  @@index([userId, createdAt])
  @@index([userId, isRead, createdAt])
}

model DeviceRegistration {
  id          String         @id @default(uuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String         // Push notification device token
  platform    DevicePlatform // IOS | ANDROID
  deviceModel String?
  isActive    Boolean        @default(true)
  lastSeenAt  DateTime       @default(now())
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([userId, token])
  @@index([userId, isActive])
}
```

---

## 4. Shared Contract Types (`shared/src/types.ts`)

```typescript
export enum NotificationType {
  NEW_MATCH = 'NEW_MATCH',
  NEW_MESSAGE = 'NEW_MESSAGE',
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
}
```

---

## 5. Backend Implementation Details

### 5.1 Push Notification Provider Boundary (`backend/src/notifications/providers/`)
- `PushNotificationProvider` interface:
  ```typescript
  export interface PushNotificationProvider {
    sendPush(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<void>;
  }
  ```
- `ConsolePushNotificationProvider`: Logs push dispatch events cleanly during development and testing without hardcoding external vendor credentials.

### 5.2 Notifications Domain (`backend/src/notifications/`)
- **`NotificationsService`**:
  - `createNotification(userId, dto, idempotencyKey)`: Idempotent upsert/insert. Ignores duplicate keys without throwing errors.
  - `listNotifications(userId, query)`: Cursor pagination on `createdAt`, calculates unread count.
  - `markAsRead(userId, notificationId)`: Updates `isRead: true`, `readAt: now()`.
  - `markAllAsRead(userId)`: Batch updates all unread notifications for the user.
  - `getUnreadCount(userId)`: Efficient count query on `[userId, isRead: false]`.
  - `registerDevice(userId, dto)` & `unregisterDevice(userId, token)`.
- **`NotificationsController`** (`/notifications`):
  - `GET /notifications`
  - `GET /notifications/unread-count`
  - `PATCH /notifications/:id/read`
  - `POST /notifications/read-all`
  - `POST /notifications/device-token`
  - `DELETE /notifications/device-token`

### 5.3 Cross-Domain Decoupled Notification Integrations
- **Matching (`ActionsService`)**:
  - After mutual match creation and transaction commit:
    ```typescript
    try {
      await this.notificationsService.createNotification(
        user1Id,
        { type: NotificationType.NEW_MATCH, referenceId: match.id, title: "It's a Match! 🎉", body: `You matched with ${user2Profile.displayName}!` },
        `match:${match.id}:user:${user1Id}`
      );
      await this.notificationsService.createNotification(
        user2Id,
        { type: NotificationType.NEW_MATCH, referenceId: match.id, title: "It's a Match! 🎉", body: `You matched with ${user1Profile.displayName}!` },
        `match:${match.id}:user:${user2Id}`
      );
    } catch (err) {
      this.logger.error(`Failed to send match notification: ${err.message}`);
    }
    ```
- **Chat (`MessagesService`)**:
  - After message persistence and transaction commit:
    ```typescript
    try {
      await this.notificationsService.createNotification(
        recipientUserId,
        { type: NotificationType.NEW_MESSAGE, referenceId: conversationId, title: `New message from ${senderProfile.displayName}`, body: "Sent you a message" },
        `msg:${message.id}:user:${recipientUserId}`
      );
    } catch (err) {
      this.logger.error(`Failed to send message notification: ${err.message}`);
    }
    ```

### 5.4 Profile Domain (`backend/src/profile/`)
- **`ProfileService.getViewableProfile(requesterUserId, profileId)`**:
  - Calls `SafetyPolicyService.canViewProfile(requesterUserId, targetUserId)`.
  - Rejects with `403 Forbidden` if blocked or suspended.
  - Returns `ViewableProfileDto` containing only approved photos, safe bio, interests, and derived age.
- **Controller Route**: `GET /profile/view/:profileId` with `JwtAuthGuard`.

---

## 6. Mobile Experience & UI Architecture (`mobile/`)

### 6.1 State Management & Stores
- **`useNotificationsStore` (`mobile/src/stores/notifications-store.ts`)**:
  - Manages notifications list, unread count badge, pull-to-refresh, pagination, mark-as-read, and mark-all-as-read.
- **`useProfileStore` (`mobile/src/stores/profile-store.ts`)**:
  - Handles profile editing with immediate local & remote readiness updates.

### 6.2 Components & Screens
- **`FullProfileModal.tsx` (`mobile/src/components/FullProfileModal.tsx`)**:
  - Tap / swipe photo carousel with dot indicators.
  - Display Name, Age, Location, Bio, Interests grid, Relationship intent badge.
  - Like, Pass, Block, and Report action buttons.
- **`notifications.tsx` (`mobile/app/notifications.tsx`)**:
  - Notification items with distinct icons (`🎉 Match`, `💬 Message`, `🛡️ Safety`).
  - Read/unread visual distinction.
  - Deep linking navigation with stale safety checks before screen transition.
  - Empty state: "No notifications yet."
- **`edit.tsx` (`mobile/app/profile/edit.tsx`)**:
  - Form fields for Display Name, Gender, Bio, City, Region, Preferences, Interests, Visibility.
  - Real-time readiness & completion score breakdown.
- **`index.tsx` (`mobile/app/index.tsx`)**:
  - Unified Dashboard: Profile Summary card with readiness indicator, Discovery launch tile, Recent Matches carousel, Active Conversations list with unread counters, and Notifications bar.

### 6.3 Localization & Time Foundation
- **`strings.ts` (`mobile/src/i18n/strings.ts`)**:
  - Centralized string dictionary with English and Tamil baseline translations.
- **`time.util.ts` (`mobile/src/utils/time.util.ts`)**:
  - Standardized IST 12-hour AM/PM formatting for Tamil Nadu users.

---

## 7. Verification & Testing Plan

### 7.1 Backend Unit Tests
- `notifications.service.spec.ts`:
  - Idempotent notification creation with deduplication.
  - Cursor-paginated notification listing and unread count queries.
  - Mark single / mark all as read.
  - Device token registration and unregistration.
- `profile.service.spec.ts`:
  - `getViewableProfile` safety policy checks (active vs blocked vs hidden).
  - Deterministic readiness recalculation on profile edits.
  - DOB revalidation (18+ check).

### 7.2 Backend E2E Tests (`backend/test/engagement.e2e-spec.ts`)
- Authenticated view of candidate profile via `GET /profile/view/:profileId`.
- Rejection of viewable profile request if users have blocked each other (403).
- Like action $\rightarrow$ Match $\rightarrow$ `NEW_MATCH` notification created idempotently.
- Message send $\rightarrow$ `NEW_MESSAGE` notification created.
- Mark notification as read $\rightarrow$ unread count drops.
- Register & unregister device push token.

### 7.3 Quality Standards
- `npm run lint` in `backend/` (0 errors, 0 warnings).
- `npm run build` in `backend/` (0 errors).
- `npm test` & `npm run test:e2e` in `backend/` (100% passing).
- `npx tsc --noEmit` in `mobile/` (0 errors).
