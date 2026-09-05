# Phase 5 Walkthrough: Discovery & Recommendation Foundation

## Overview
Phase 5 implements the **Discovery & Recommendation Foundation** for the dating app, establishing a layered, modular recommendation pipeline. It delivers safe, mutually compatible, diverse, and ranked candidate profiles to authenticated users with opaque cursor pagination, idempotent impression tracking, and a mobile presentation UI.

---

## Architecture & Pipeline Implementation

### 1. Database Schema & Migration (`backend/prisma/`)
- **`DiscoveryImpression` Model**:
  - `id`: UUID primary key
  - `requestingUserId`: Reference to requesting `User` (cascade on delete)
  - `candidateProfileId`: Reference to presented `DatingProfile` (cascade on delete)
  - `position`: Candidate rank position in served batch
  - `algorithmVersion`: Traceable version string (`baseline-v1`)
  - `servedAt`: Timestamp of presentation
- **Performance Indexes**:
  - `@@index([requestingUserId, servedAt])` (Fast suppression window querying)
  - `@@index([requestingUserId, candidateProfileId])` (Fast duplicate/idempotency check)
  - `@@index([gender, dateOfBirth])` on `DatingProfile`
  - `@@index([minAge, maxAge])` on `DatingPreferences`
- **Neon Migration**: Applied and verified `20260831170000_add_discovery_impressions`.

### 2. Layered Discovery Pipeline (`backend/src/discovery/`)
- **`DiscoveryEligibilityService`**:
  - Evaluates requesting user: Account `ACTIVE`, Profile `READY` (100% completion score across all 5 milestones), Profile `VISIBLE`, Age $\ge 18$, and $\ge 1$ `APPROVED` photo.
  - Returns structured `DiscoveryEligibilityStatus` (`PROFILE_NOT_READY`, `PROFILE_HIDDEN`, `NO_APPROVED_PHOTOS`, `AGE_RESTRICTION`).
- **`CandidateGeneratorService`**:
  - Pushes hard constraints to PostgreSQL: active user account, ready profile, visible profile, not requester, contains $\ge 1$ approved photo.
  - Bounded candidate pool generation: $N = \min(\max(\text{limit} \times 4, 40), 150)$.
- **`MutualCompatibilityService`**:
  - Reciprocal gender compatibility (`ANY` vs `SELECTED` with `preferredGenders` array).
  - Reciprocal age range compatibility derived dynamically from normalized UTC calendar DOB.
  - Enforces both `User A accepts Candidate B` AND `Candidate B accepts User A`.
- **`ExclusionService`**:
  - Excludes requesting user profile/account.
  - Suppresses profiles presented within the last 7 days (`DiscoveryImpression`).
  - Extensible hook for future safety blocks/reports.
- **`FeatureExtractionService`**:
  - Normalized feature vectors $\in [0, 1.0]$:
    - `ageProximity`: Proximity to preferred age midpoint.
    - `interestOverlap`: Jaccard similarity index $\frac{|A \cap B|}{|A \cup B|}$.
    - `locationMatch`: Same city ($1.0$), same region ($0.6$), same country ($0.3$), other ($0.0$).
    - `intentMatch`: Exact match ($1.0$), compatible pairing ($0.6$), disjoint ($0.2$).
    - `qualityScore`: Approved photo count and bio length completeness.
    - `freshnessScore`: Recency decay based on update timestamp.
- **`BaselineRankingStrategy` (`baseline-v1`)**:
  - Transparent, versioned weights: Location (0.25), Intent (0.20), Interests (0.20), Age Proximity (0.15), Quality (0.10), Freshness (0.10).
  - Deterministic sorting with secondary ID tiebreaker.
- **`DiversityService`**:
  - Controlled sliding-window diversity pass preventing homogeneous streaks ($> 3$) of identical city or intent in a single page.
- **`DiscoveryPaginationService`**:
  - Opaque, tamper-resistant HMAC-SHA256 cursor token encoding offset and timestamp without leaking internal IDs or raw scores.
- **`ImpressionService`**:
  - Idempotent recording with duplicate suppression and Redis rate limiting (max 60 impression submissions per minute).
- **`DiscoveryController`**:
  - `GET /api/v1/discovery?limit=20&cursor=...`
  - `POST /api/v1/discovery/impressions`

### 3. Mobile Discovery UI (`mobile/`)
- **`useDiscoveryStore` (`mobile/src/stores/discovery-store.ts`)**:
  - Zustand store managing `candidates`, `currentIndex`, `currentPhotoIndex`, `cursor`, `hasMore`, `eligibility`, `isLoading`, `isRefreshing`, and `error`.
  - Actions: `fetchDiscoveryFeed`, `loadMore`, `nextCandidate`, `prevCandidate`, `nextPhoto`, `prevPhoto`, `recordImpression`.
- **`DiscoveryScreen` (`mobile/app/discovery.tsx`)**:
  - Profile presentation card with multi-photo tap carousel and indicator dots.
  - Display name, age, location pin, relationship intent chip, bio, and interest tags.
  - Navigation footer with "Next Profile" action and automatic impression acknowledgment.
  - Explicit empty and ineligible states (`PROFILE_NOT_READY`, `PROFILE_HIDDEN`, `NO_NEW_PROFILES`).
- **Dashboard CTA (`mobile/app/index.tsx`)**:
  - Prominent "Open Discovery Feed" action displayed when profile is `READY`.

---

## Verification Results

### Backend Automated Tests
- **Unit Test Suites**: **20 passed, 20 total (102/102 tests passing)**
  - `feature-extraction.service.spec.ts`
  - `mutual-compatibility.service.spec.ts`
  - `baseline-ranking.strategy.spec.ts`
  - `diversity.service.spec.ts`
  - `discovery-pagination.service.spec.ts`
  - `exclusion.service.spec.ts`
  - `impression.service.spec.ts`
  - `discovery.service.spec.ts`
  - `photos.service.spec.ts`
  - `profile.service.spec.ts`
  - `auth.service.spec.ts`
  - and all other domain test suites.
- **E2E Test Suites**: **5 passed, 5 total (37/37 tests passing)**
  - `discovery.e2e-spec.ts`: Mutual compatibility, age exclusions, hidden exclusions, idempotent impressions, safety state transitions (`VISIBLE` $\rightarrow$ `HIDDEN`, `ACTIVE` $\rightarrow$ `SUSPENDED`).
  - `photos.e2e-spec.ts`
  - `profile.e2e-spec.ts`
  - `auth.e2e-spec.ts`
  - `app.e2e-spec.ts`
- **Linting & Compilation**:
  - `npm run lint`: **0 errors, 0 warnings**.
  - `npm run build`: **Compiled successfully**.

### Mobile Type Check
- **TypeScript**: `tsc --noEmit` passed with **0 errors**.
