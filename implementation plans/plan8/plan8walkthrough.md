# Phase 8: Safety, Blocking, Reporting & Moderation Foundation — Walkthrough

## Summary of Accomplishments

Phase 8 establishes a production-grade, authoritative **Safety, Blocking, Reporting, and Moderation Foundation** for the dating platform. All safety policies are enforced server-side via the centralized `SafetyPolicyService`, providing deterministic, mutual safety filtering across Discovery, Matching, and Chat.

---

## 1. Core Architecture & Safety Pipeline

```text
User Actions / Safety Incidents
      ↓
Safety Policy Gate (SafetyPolicyService)
  ├── BlocksService (Idempotent Blocking + Immediate Unmatch)
  ├── ReportsService (Rate-Limited Reports + Evidence Snapshots)
  └── ModerationService (Role-Guarded Actions + Immutable Audit Logs)
      ↓
Cross-Domain Enforcement
  ├── Discovery: ExclusionService suppresses mutual blocked pairs
  ├── Matching: ActionsService rejects Likes/Passes with 403 Forbidden
  └── Chat: MessagesService rejects persistent delivery with 403 Forbidden
```

---

## 2. Key Components Delivered

### 2.1 Database & Domain Layer (`backend/prisma/schema.prisma`)
- **`UserRole` Enum**: `USER`, `MODERATOR`, `ADMIN` with role checks.
- **`Block` Model**: Unique composite `(blockerUserId, blockedUserId)` with indexed timestamps.
- **`ReportTargetType` & `ReportReason`**: Typed target types (`USER`, `PROFILE`, `PHOTO`, `MESSAGE`) and 10 specific reason categories.
- **`Report` Model**: Captures report details, status (`OPEN`, `UNDER_REVIEW`, `ACTIONED`, `DISMISSED`), and immutable snapshot JSON.
- **`ModerationAuditLog` Model**: Immutable audit trail recording moderator ID, action type, target ID, reason, and before/after metadata snapshots.

### 2.2 Authoritative Safety Gate (`backend/src/safety/`)
- **`SafetyPolicyService`**:
  - `getMutualBlockedUserIds(userId)`: Computes the full union of blockers and blocked users.
  - `canInteract(userA, userB)`: Validates interaction permissions before likes/passes.
  - `canDiscover(requester, candidate)`: Validates discovery feed candidacy.
  - `canMessage(sender, recipient, conversationId)`: Enforces that both users are active and non-blocked before message delivery.
  - `canViewProfile(requester, target)`: Prevents profile inspection across safety barriers.
- **`BlocksService`**: Handles user blocking, cascading match deactivation (`MatchStatus.UNMATCHED`), unblocking, and paginated block querying.
- **`ReportsService`**: Handles rate-limited report submissions (10 reports/min sliding window), snapshot capture, and optional auto-blocking.
- **`ModerationService`**: Executes moderator actions (`SUSPEND_ACCOUNT`, `BAN_ACCOUNT`, `RESTORE_ACCOUNT`, `HIDE_PROFILE`, `UNHIDE_PROFILE`, `REJECT_PHOTO`, `DISMISS_REPORT`), revokes active auth sessions in Redis and DB, updates report status, and logs immutable audit trails.

### 2.3 Cross-Domain Integrations
- **Discovery Integration (`ExclusionService`)**: Dynamically includes mutual blocked users into suppression lists so blocked individuals never appear in candidate feeds.
- **Matching Integration (`ActionsService`)**: Blocks like/pass interactions between blocked pairs with `ForbiddenException`.
- **Chat Integration (`MessagesService`)**: Enforces safety validation prior to message sequence generation and real-time delivery.

### 2.4 Mobile Safety UI (`mobile/`)
- **`useSafetyStore` (`mobile/src/stores/safety-store.ts`)**: Zustand store managing blocking, unblocking, and reporting actions with optimistic updates.
- **`ReportModal` (`mobile/src/components/ReportModal.tsx`)**: Modal offering 10 report categories, description input, and "Also block this user immediately" toggle.
- **Discovery Screen (`mobile/app/discovery.tsx`)**: Integrated 🛡️ Safety button to report/block candidate cards directly.
- **Matches Screen (`mobile/app/matches.tsx`)**: Integrated Block and Report actions on match cards.
- **Chat Screen (`mobile/app/chat/[conversationId].tsx`)**: Added header options menu ("⋮") for blocking/reporting with active composer disabling.

---

## 3. Verification & Test Results

### 3.1 Backend Unit Tests
- **28 Unit Test Suites**: **145 / 145 Tests Passing (100%)**
  - `blocks.service.spec.ts` (100% passing)
  - `reports.service.spec.ts` (100% passing)
  - `safety-policy.service.spec.ts` (100% passing)
  - `moderation.service.spec.ts` (100% passing)
  - `exclusion.service.spec.ts` (100% passing)
  - `actions.service.spec.ts` (100% passing)
  - `messages.service.spec.ts` (100% passing)

### 3.2 Backend E2E Integration Tests
- **9 E2E Test Suites**: **60 / 60 Tests Passing (100%)**
  - `safety.e2e-spec.ts` (Block lifecycle, rate-limited reporting, moderator RBAC, account suspension, and audit logging)
  - `chat.e2e-spec.ts`
  - `matching-concurrency.e2e-spec.ts`
  - `matching.e2e-spec.ts`
  - `discovery.e2e-spec.ts`
  - `photos.e2e-spec.ts`
  - `profile.e2e-spec.ts`
  - `auth.e2e-spec.ts`
  - `app.e2e-spec.ts`

### 3.3 Static Analysis & Compiles
- **ESLint**: 0 errors, 0 warnings.
- **Mobile TypeScript Check**: `npx tsc --noEmit` completed with 0 errors.
- **NestJS Build**: `npm run build` completed successfully.
