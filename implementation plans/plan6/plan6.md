# Phase 6: Likes, Passes & Matching — Implementation Plan

Phase 6 introduces the **User Action and Matching Foundation**. Discovery recommends candidates, user actions express explicit intent (`LIKE` or `PASS`), and a match is atomically established only when both users have mutually liked each other.

---

## User Review Required

> [!IMPORTANT]
> **Strict Architectural Boundaries**:
> 1. **Core Domain Separation**: `Discovery` determines candidate recommendations, `UserAction` persists individual decisions, and `Matching` manages reciprocal mutual interest.
> 2. **Canonical Match Pair Uniqueness**: Matches enforce a database-level canonical pair constraint (`UNIQUE(user1Id, user2Id)` where `user1Id < user2Id`) to guarantee that concurrent reciprocal likes from two devices create exactly one Match record.
> 3. **Non-Destructive Unmatch Lifecycle**: Unmatching transitions the match status to `UNMATCHED` rather than deleting records, maintaining auditability and preventing accidental re-matching.
> 4. **Discovery Exclusion**: Liked, passed, and matched profiles are excluded from future discovery candidate generation.
> 5. **No Chat or Push Notifications**: Chat belongs to Phase 7; Phase 6 establishes only the action, match, and presentation layer.

---

## Architecture & Data Flow

```text
User views Candidate in Discovery
       ↓
User chooses [PASS] or [LIKE]
       ↓
[ActionsService.recordAction]
  ├── Verify Requesting User (ACTIVE + READY)
  ├── Revalidate Target Profile (ACTIVE + READY + VISIBLE + >=1 APPROVED photo)
  ├── Upsert UserAction(actorUserId, targetProfileId, actionType)
  └── If action is LIKE:
        ├── Query Reciprocal UserAction(targetUserId, actorProfileId, LIKE)
        └── If Reciprocal Exists:
              └── Atomically create/activate Match(canonicalUser1, canonicalUser2)
                     └── Return { action: 'LIKE', matched: true, match: SafeMatch }
```

---

## Proposed Changes

### Database Schema & Migrations (`backend/prisma/`)

#### [MODIFY] [schema.prisma](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/prisma/schema.prisma)
- Add `ActionType` enum: `LIKE`, `PASS`.
- Add `MatchStatus` enum: `ACTIVE`, `UNMATCHED`.
- Add `UserAction` model:
  ```prisma
  model UserAction {
    id                 String        @id @default(uuid())
    actorUserId        String
    actorUser          User          @relation("UserActionsMade", fields: [actorUserId], references: [id], onDelete: Cascade)
    targetProfileId    String
    targetProfile      DatingProfile @relation("UserActionsReceived", fields: [targetProfileId], references: [id], onDelete: Cascade)
    actionType         ActionType
    algorithmVersion   String?       @default("baseline-v1")
    createdAt          DateTime      @default(now())
    updatedAt          DateTime      @updatedAt

    @@unique([actorUserId, targetProfileId])
    @@index([actorUserId, actionType])
    @@index([targetProfileId, actionType])
  }
  ```
- Add `Match` model:
  ```prisma
  model Match {
    id                 String        @id @default(uuid())
    user1Id            String        // Lexicographically smaller UUID
    user1              User          @relation("MatchUser1", fields: [user1Id], references: [id], onDelete: Cascade)
    user2Id            String        // Lexicographically larger UUID
    user2              User          @relation("MatchUser2", fields: [user2Id], references: [id], onDelete: Cascade)
    status             MatchStatus   @default(ACTIVE)
    unmatchedByUserId  String?
    unmatchedAt        DateTime?
    createdAt          DateTime      @default(now())
    updatedAt          DateTime      @updatedAt

    @@unique([user1Id, user2Id])
    @@index([user1Id, status])
    @@index([user2Id, status])
    @@index([status, updatedAt])
  }
  ```
- Add relations on `User` and `DatingProfile`.
- Create and apply migration `20260831180000_add_actions_and_matches`.

---

### Shared Types & Contracts (`shared/src/types.ts`)

#### [MODIFY] [types.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/shared/src/types.ts)
- Add:
  - `ActionType`: `'LIKE' | 'PASS'`
  - `MatchStatus`: `'ACTIVE' | 'UNMATCHED'`
  - `RecordActionDto`: `{ targetProfileId: string; actionType: ActionType; algorithmVersion?: string }`
  - `SafeMatch`: `{ id: string; matchedProfile: DiscoveryCandidate; matchedAt: string; status: MatchStatus }`
  - `RecordActionResponse`: `{ action: ActionType; matched: boolean; match?: SafeMatch }`
  - `MatchesListResponse`: `{ matches: SafeMatch[]; nextCursor: string | null; hasMore: boolean }`
  - `UnmatchResponse`: `{ success: boolean; message: string }`

---

### Backend Matching Domain (`backend/src/matching/`)

#### [NEW] [actions.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/services/actions.service.ts)
- Handles `recordAction(userId, dto)`:
  - Validates requester (account `ACTIVE`, profile `READY`).
  - Revalidates target profile (not self, exists, account `ACTIVE`, profile `READY`, profile `VISIBLE`, $\ge 1$ approved photo).
  - Rate limiting via Redis (max 100 actions per minute per user).
  - PostgreSQL transaction:
    - Upserts `UserAction(actorUserId, targetProfileId, actionType)`.
    - If `actionType === 'LIKE'`: checks if target user has active `UserAction(targetUserId, requesterProfileId, 'LIKE')`.
    - If reciprocal like found:
      - Computes canonical pair: `[user1Id, user2Id] = [userId, targetProfile.userId].sort()`.
      - Upserts `Match` with `status: ACTIVE`.
      - Emits internal `MATCH_CREATED` event log.
      - Returns mapped `SafeMatch` response.
    - If no reciprocal like: returns `{ action: 'LIKE', matched: false }`.
    - If `actionType === 'PASS'`: returns `{ action: 'PASS', matched: false }`.

#### [NEW] [matches.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/services/matches.service.ts)
- Handles `getMatches(userId, query)`:
  - Queries active matches where `user1Id === userId OR user2Id === userId` with `status: ACTIVE`.
  - Opaque cursor pagination.
  - Maps other participant's profile to `DiscoveryCandidate` summary with signed photo URLs.
- Handles `getMatchDetail(userId, matchId)`:
  - Validates that requester is participant `user1Id` or `user2Id`. Returns `404 Not Found` for unauthorized/non-existent matches to prevent enumeration.
- Handles `unmatch(userId, matchId)`:
  - Validates participant ownership.
  - Sets `status: UNMATCHED`, `unmatchedByUserId: userId`, `unmatchedAt: new Date()`.

#### [NEW] [actions.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/actions.controller.ts)
- `POST /api/v1/actions` (`@UseGuards(JwtAuthGuard)`)

#### [NEW] [matches.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/matches.controller.ts)
- `GET /api/v1/matches` (`@UseGuards(JwtAuthGuard)`)
- `GET /api/v1/matches/:matchId` (`@UseGuards(JwtAuthGuard)`)
- `DELETE /api/v1/matches/:matchId` (`@UseGuards(JwtAuthGuard)`)

#### [NEW] [matching.module.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/matching.module.ts)
- Registers providers, controllers, and exports `ActionsService` and `MatchesService`.

#### [MODIFY] [exclusion.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/exclusion.service.ts)
- Extends `getSuppressedProfileIds` to also query:
  - Target profiles where user has recorded a `LIKE` or `PASS`.
  - Active matched user profiles.
  - Unmatched user profiles.
- Ensures acted upon and matched profiles never clutter discovery feeds.

#### [MODIFY] [app.module.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/app.module.ts)
- Registers `MatchingModule`.

---

### Mobile Application UI & State (`mobile/`)

#### [NEW] [matching-store.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/stores/matching-store.ts)
- Zustand store managing:
  - `matches: SafeMatch[]`
  - `cursor: string | null`
  - `hasMore: boolean`
  - `isLoading: boolean`
  - `isRefreshing: boolean`
  - Actions: `fetchMatches(refresh?: boolean)`, `loadMoreMatches()`, `unmatch(matchId: string)`.

#### [MODIFY] [discovery-store.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/stores/discovery-store.ts)
- Adds `recordAction(targetProfileId: string, actionType: 'LIKE' | 'PASS')`:
  - Calls `POST /api/v1/actions`.
  - If `matched === true`: returns `match` for celebration modal.
  - Advances to `nextCandidate()`.

#### [MODIFY] [discovery.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/discovery.tsx)
- Adds real Dating Action buttons in footer:
  - ❌ **Pass Button** (Left)
  - 💚 **Like Button** (Right)
  - Action loading spinner during network flight to prevent duplicate taps.
- Adds **Match Celebration Modal**:
  - Displays "It's a Match!"
  - Displays requester's primary photo and matched candidate's primary photo.
  - Shows candidate name and compatibility message.
  - Primary button: "Keep Discovering" (dismisses modal and continues feed).
  - Secondary button: "Send a Message (Available in Phase 7)" (subtly disabled with milestone badge).

#### [NEW] [matches.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/matches.tsx)
- Matches List Screen:
  - Header with Back and Refresh buttons.
  - 2-column responsive match card grid showing primary photo, name, age, city, and match timestamp.
  - Tap card to preview profile modal or unmatch action sheet.
  - Empty state: "No matches yet. Keep exploring in Discovery to find mutual matches!" with CTA to Discovery.

#### [MODIFY] [index.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/index.tsx)
- Adds "Matches" entry button with active match count badge when profile is `READY`.

---

## Verification Plan

### Automated Tests
1. **Unit Tests**:
   - `backend/src/matching/services/actions.service.spec.ts`:
     - Test recording `LIKE` and `PASS`.
     - Test idempotency and action updates (`PASS` $\rightarrow$ `LIKE`).
     - Test reciprocal like detection and atomic match creation.
     - Test target validation (fails on suspended, hidden, incomplete, or self).
     - Test rate limiting.
   - `backend/src/matching/services/matches.service.spec.ts`:
     - Test listing active matches with cursor pagination.
     - Test match detail authorization (404 for non-participants).
     - Test unmatch operation.
   - `backend/src/discovery/services/exclusion.service.spec.ts`:
     - Test discovery exclusion of liked, passed, and matched profiles.
2. **Concurrency Test**:
   - `backend/test/matching-concurrency.e2e-spec.ts`:
     - Simultaneous requests `A LIKE B` and `B LIKE A` executed in parallel with `Promise.all()`.
     - Asserts exactly 1 Match record is created.
3. **Full E2E Tests**:
   - `backend/test/matching.e2e-spec.ts`:
     - Complete lifecycle: A likes B (no match) $\rightarrow$ B likes A (match created) $\rightarrow$ both fetch matches $\rightarrow$ A unmatches B $\rightarrow$ match status becomes `UNMATCHED`.
     - Target safety state tests (B becomes hidden/suspended).

### Build & Linter Verification
- `npm run lint` in `backend/` (0 errors, 0 warnings).
- `npm run build` in `backend/` (compiled successfully).
- `npm test` and `npm run test:e2e` in `backend/` (all tests passing).
- `npm run type-check` in `mobile/` (0 errors).
