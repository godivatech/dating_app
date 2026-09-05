# Phase 8: Safety, Blocking, Reporting & Moderation Foundation — Implementation Plan

Phase 8 introduces the **Safety, Blocking, Reporting, Moderation, and Enforcement Foundation**. Safety state is more authoritative than product state: safety decisions are enforced server-side and immediately propagate across Discovery, Likes/Passes, Matches, Real-Time Chat, and Profile Visibility.

---

## User Review Required

> [!IMPORTANT]
> **Core Safety Principles**:
> 1. **Centralized Enforcement (`SafetyPolicyService`)**: All safety checks (mutual blocking, account suspension, bans, profile hiding) are handled by a centralized service used consistently across Discovery, Matching, Chat, and Profile systems.
> 2. **Symmetric Mutual Blocking**: When User A blocks User B, the system enforces mutual exclusion in both directions (neither sees the other in Discovery, can send Likes/Passes, or message each other).
> 3. **Non-Destructive Safety History**: Safety actions (blocks, reports, moderation decisions) are persisted durably and immutably in PostgreSQL for auditing, without destroying historical context.
> 4. **Fail-Closed Moderation**: Inactive, suspended, or banned accounts are immediately blocked from interactions, chat messaging, and socket rooms.
> 5. **Privacy-Preserving User Experience**: Block and report actions do not reveal reporter identities, moderation reasons, or internal investigation statuses to the other user.

---

## Architecture & Data Flow

```text
                               Mobile Client
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │ 1. User Safety Action                             │ 2. Moderator Action
           ▼                                                   ▼
┌──────────────────────┐                             ┌──────────────────────┐
│  POST /api/v1/blocks │                             │ POST /moderation/act │
│  POST /api/v1/reports│                             └──────────┬───────────┘
└──────────┬───────────┘                                        │
           ▼                                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           PostgreSQL Database                             │
│  - Block (unique blockerUserId + blockedUserId)                           │
│  - Report (targetType, reason, evidence snapshot, status)                 │
│  - ModerationAuditLog (immutable audit record of moderator actions)       │
│  - User status (ACTIVE / SUSPENDED / BANNED / DEACTIVATED)                │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   SafetyPolicyService     │
                        └─────────────┬─────────────┘
                                      │ Enforces across domains:
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
┌──────────────┐               ┌──────────────┐               ┌──────────────┐
│  Discovery   │               │   Matching   │               │     Chat     │
│  Exclusion   │               │ Action Check │               │ Authorization│
└──────────────┘               └──────────────┘               └──────────────┘
```

---

## Proposed Changes

### Database Schema & Migrations (`backend/prisma/`)

#### [MODIFY] [schema.prisma](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/prisma/schema.prisma)
- Add `UserRole` enum: `USER`, `MODERATOR`, `ADMIN`.
- Update `User` model:
  - Add `role UserRole @default(USER)`
  - Add relations: `blocksInitiated Block[]`, `blocksReceived Block[]`, `reportsSubmitted Report[]`, `reportsReceived Report[]`, `moderatorAuditLogs ModerationAuditLog[]`.
- Add `Block` model:
  ```prisma
  model Block {
    id            String    @id @default(uuid())
    blockerUserId String
    blockerUser   User      @relation("BlocksInitiated", fields: [blockerUserId], references: [id], onDelete: Cascade)
    blockedUserId String
    blockedUser   User      @relation("BlocksReceived", fields: [blockedUserId], references: [id], onDelete: Cascade)
    reason        String?
    createdAt     DateTime  @default(now())

    @@unique([blockerUserId, blockedUserId])
    @@index([blockerUserId])
    @@index([blockedUserId])
  }
  ```
- Add `ReportTargetType` enum: `USER`, `PROFILE`, `PHOTO`, `MESSAGE`.
- Add `ReportReason` enum: `HARASSMENT`, `HATE_OR_ABUSE`, `SEXUAL_CONTENT`, `SPAM`, `SCAM_OR_FRAUD`, `IMPERSONATION`, `MINOR_SAFETY`, `INAPPROPRIATE_CONTENT`, `OFF_PLATFORM_SOLICITATION`, `THREAT_OR_DANGER`, `OTHER`.
- Add `ReportStatus` enum: `OPEN`, `UNDER_REVIEW`, `ACTIONED`, `DISMISSED`.
- Add `Report` model:
  ```prisma
  model Report {
    id               String           @id @default(uuid())
    reporterUserId   String
    reporterUser     User             @relation("ReportsSubmitted", fields: [reporterUserId], references: [id], onDelete: Cascade)
    reportedUserId   String
    reportedUser     User             @relation("ReportsReceived", fields: [reportedUserId], references: [id], onDelete: Cascade)
    targetType       ReportTargetType
    targetId         String
    reason           ReportReason
    description      String?
    evidenceSnapshot Json?
    status           ReportStatus     @default(OPEN)
    reviewedByUserId String?
    reviewedAt       DateTime?
    resolutionNotes  String?
    createdAt        DateTime         @default(now())
    updatedAt        DateTime         @updatedAt

    @@index([reporterUserId, createdAt])
    @@index([reportedUserId, status])
    @@index([status, createdAt])
    @@index([targetType, targetId])
  }
  ```
- Add `ModerationActionType` enum: `WARN_USER`, `HIDE_PROFILE`, `UNHIDE_PROFILE`, `REJECT_PHOTO`, `SUSPEND_ACCOUNT`, `BAN_ACCOUNT`, `RESTORE_ACCOUNT`, `DISMISS_REPORT`.
- Add `ModerationAuditLog` model:
  ```prisma
  model ModerationAuditLog {
    id               String               @id @default(uuid())
    moderatorUserId  String
    moderatorUser    User                 @relation(fields: [moderatorUserId], references: [id], onDelete: Restrict)
    targetUserId     String
    actionType       ModerationActionType
    reason           String
    reportId         String?
    metadata         Json?
    createdAt        DateTime             @default(now())

    @@index([targetUserId, createdAt])
    @@index([moderatorUserId, createdAt])
    @@index([actionType, createdAt])
  }
  ```
- Apply migration `20260831200000_add_safety_and_moderation`.

---

### Shared Types & Contracts (`shared/src/types.ts`)

#### [MODIFY] [types.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/shared/src/types.ts)
- Add:
  - `UserRole`: `'USER' | 'MODERATOR' | 'ADMIN'`
  - `ReportTargetType`: `'USER' | 'PROFILE' | 'PHOTO' | 'MESSAGE'`
  - `ReportReason`: `'HARASSMENT' | 'HATE_OR_ABUSE' | 'SEXUAL_CONTENT' | 'SPAM' | 'SCAM_OR_FRAUD' | 'IMPERSONATION' | 'MINOR_SAFETY' | 'INAPPROPRIATE_CONTENT' | 'OFF_PLATFORM_SOLICITATION' | 'THREAT_OR_DANGER' | 'OTHER'`
  - `ReportStatus`: `'OPEN' | 'UNDER_REVIEW' | 'ACTIONED' | 'DISMISSED'`
  - `ModerationActionType`: `'WARN_USER' | 'HIDE_PROFILE' | 'UNHIDE_PROFILE' | 'REJECT_PHOTO' | 'SUSPEND_ACCOUNT' | 'BAN_ACCOUNT' | 'RESTORE_ACCOUNT' | 'DISMISS_REPORT'`
  - `CreateBlockDto`: `{ targetUserId: string; reason?: string }`
  - `CreateReportDto`: `{ targetUserId: string; targetType: ReportTargetType; targetId: string; reason: ReportReason; description?: string; autoBlock?: boolean }`
  - `SafeBlock`: `{ id: string; blockedUserId: string; blockedProfile?: DiscoveryCandidate; createdAt: string }`
  - `SafeReport`: `{ id: string; targetType: ReportTargetType; targetId: string; reason: ReportReason; status: ReportStatus; createdAt: string }`
  - `ModeratorActionDto`: `{ targetUserId: string; actionType: ModerationActionType; reason: string; reportId?: string; photoId?: string }`
  - `ModerationAuditLogResponse`: `{ id: string; moderatorUserId: string; targetUserId: string; actionType: ModerationActionType; reason: string; createdAt: string }`

---

### Backend Safety Domain (`backend/src/safety/`)

#### [NEW] [safety-policy.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/services/safety-policy.service.ts)
- `canInteract(userIdA, userIdB)`: Checks mutual blocks and account statuses.
- `canDiscover(requesterUserId, candidateUserId)`: Checks mutual blocks and visibility.
- `canMessage(senderUserId, recipientUserId, conversationId)`: Checks match status, blocks, and account statuses.
- `getMutualBlockedUserIds(userId)`: Returns all user IDs that have either blocked or been blocked by `userId`.

#### [NEW] [blocks.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/services/blocks.service.ts)
- `blockUser(blockerUserId, targetUserId, reason)`:
  - Enforces `blockerUserId !== targetUserId`.
  - Upserts `Block` record idempotently.
  - Deactivates any existing `Match` between the two users.
- `unblockUser(blockerUserId, targetUserId)`: Removes block record.
- `listBlocks(blockerUserId, query)`: Returns paginated list of blocked users.

#### [NEW] [reports.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/services/reports.service.ts)
- `createReport(reporterUserId, dto)`:
  - Validates reporter and target exists, `reporter !== target`.
  - Captures evidence snapshot (e.g. message text snippet or photo metadata).
  - Rate limiting (max 10 reports/min).
  - Aggregates or creates `Report` record.
  - If `dto.autoBlock === true`, executes `blockUser` in transaction.

#### [NEW] [moderation.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/services/moderation.service.ts)
- `applyModeratorAction(moderatorUserId, dto)`:
  - Performs action (`SUSPEND_ACCOUNT`, `BAN_ACCOUNT`, `RESTORE_ACCOUNT`, `HIDE_PROFILE`, `UNHIDE_PROFILE`, `REJECT_PHOTO`, `DISMISS_REPORT`).
  - Writes immutable `ModerationAuditLog` record within transaction.
  - Emits domain log `[MODERATION_ACTION_APPLIED]`.
- `listReports(query)`: Paginated moderation queue for moderators.
- `listAuditLogs(query)`: Paginated audit log view for moderators.

#### [NEW] [roles.guard.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/guards/roles.guard.ts) & [roles.decorator.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/decorators/roles.decorator.ts)
- Enforces role-based authorization for `@Roles('MODERATOR', 'ADMIN')`.

#### [NEW] [blocks.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/blocks.controller.ts) & [reports.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/reports.controller.ts) & [moderation.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/safety/moderation.controller.ts)
- Exposes user endpoints (`/api/v1/blocks`, `/api/v1/reports`) and moderator endpoints (`/api/v1/moderation/*`).

#### [MODIFY] [exclusion.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/exclusion.service.ts)
- Queries `SafetyPolicyService` to exclude all mutual blocks from Discovery candidates.

#### [MODIFY] [actions.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/matching/services/actions.service.ts)
- Revalidates `SafetyPolicyService.canInteract(userId, targetUserId)` before recording Like/Pass.

#### [MODIFY] [messages.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/services/messages.service.ts)
- Validates `SafetyPolicyService.canMessage(userId, recipientUserId, conversationId)` before persisting messages.

---

### Mobile Safety Experience (`mobile/`)

#### [NEW] [safety-store.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/stores/safety-store.ts)
- Zustand store for blocking, unblocking, and reporting users.

#### [NEW] [ReportModal.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/components/ReportModal.tsx)
- Reusable safety reporting modal with:
  - 10 categorized reason selections.
  - Description input (max 1000 chars).
  - "Also block this user" toggle.
  - Submitting state and safe acknowledgement toast.

#### [MODIFY] [discovery.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/discovery.tsx), [matches.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/matches.tsx), [chat/[conversationId].tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/chat/[conversationId].tsx)
- Integrate Report and Block actions into profile discovery, match preview, and chat screens.

---

## Verification Plan

### Automated Tests
1. **Unit Tests**:
   - `backend/src/safety/services/safety-policy.service.spec.ts`:
     - Test mutual block evaluation in both directions.
     - Test active/suspended/banned account policy enforcement.
   - `backend/src/safety/services/blocks.service.spec.ts`:
     - Test block creation, duplicate idempotency, unblock, self-block rejection.
   - `backend/src/safety/services/reports.service.spec.ts`:
     - Test report creation, rate limiting, self-report rejection, evidence snapshotting.
   - `backend/src/safety/services/moderation.service.spec.ts`:
     - Test suspend, ban, restore, hide profile, reject photo, and audit logging.
2. **E2E Tests**:
   - `backend/test/safety.e2e-spec.ts`:
     - Full lifecycle: A blocks B $\rightarrow$ B cannot message A $\rightarrow$ A & B disappear from each other's discovery $\rightarrow$ unmatch / blocked state enforced.
     - Report lifecycle: A reports B $\rightarrow$ moderator reviews $\rightarrow$ moderator suspends B $\rightarrow$ audit log recorded $\rightarrow$ B fails closed.

### Quality Verification
- `npm run lint` in `backend/` (0 errors, 0 warnings).
- `npm run build` in `backend/` (0 errors).
- `npm test` and `npm run test:e2e` in `backend/` (all tests passing).
- `npm run type-check` in `mobile/` (0 errors).
