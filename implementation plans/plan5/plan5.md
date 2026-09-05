# Phase 5: Discovery & Recommendation Foundation — Implementation Plan

Phase 5 builds the **Discovery & Recommendation Foundation** for the dating application. Given an authenticated user, the discovery pipeline generates a safe, relevant, diverse, and explainable set of candidate profiles that the user is eligible to discover.

---

## User Review Required

> [!IMPORTANT]
> **Strict Architectural Boundaries**:
> 1. **No ML / AI Models**: The ranking engine is a deterministic, replaceable server-side strategy (`baseline-v1`) with transparent, versioned feature weights.
> 2. **No Likes, Passes, Matches, Chat, or Swiping**: Phase 5 focuses exclusively on discovery eligibility, candidate generation, mutual compatibility, ranking, impression tracking, and presentation.
> 3. **Authoritative Backend Eligibility**: The backend strictly enforces reciprocal mutual compatibility (User A accepts Candidate B AND Candidate B accepts User A).
> 4. **Safety-First & Privacy**: Stale discovery caches never bypass safety state transitions (e.g. `VISIBLE` $\rightarrow$ `HIDDEN` or `ACTIVE` $\rightarrow$ `SUSPENDED`). Exact DOB, phone numbers, and raw ranking scores are never exposed.

---

## Architecture & Pipeline Design

```text
Authenticated User
       ↓
[1. Discovery Eligibility] ─── (Account ACTIVE + Profile READY + Profile VISIBLE + 18+)
       ↓
[2. Candidate Generation] ──── (PostgreSQL query: READY + VISIBLE + >=1 APPROVED photo + != User)
       ↓
[3. Hard Eligibility Filtering] ─ (Active accounts, 18+ age constraints, safety restrictions)
       ↓
[4. Mutual Compatibility] ─── (A accepts B [Gender + Age] AND B accepts A [Gender + Age])
       ↓
[5. Exclusion Filtering] ───── (Self, recent impressions suppression [7 days], safety blocks)
       ↓
[6. Feature Extraction] ────── (Age proximity, Jaccard interest overlap, location match, intent match, freshness, quality)
       ↓
[7. Baseline Ranking (v1)] ─── (Weighted multi-criteria scoring algorithm: baseline-v1)
       ↓
[8. Diversity Adjustment] ──── (Interleaved variety in location/intent across candidate batch)
       ↓
[9. Cursor Pagination] ─────── (Opaque, tamper-resistant cursor with bounded limit [1-50])
       ↓
[10. Discovery Response & Mobile Presentation]
       ↓
[11. Idempotent Impression Recording]
```

---

## Proposed Changes

### Database & Schema Layer (`backend/prisma/`)

#### [MODIFY] [schema.prisma](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/prisma/schema.prisma)
- Add `DiscoveryImpression` model:
  ```prisma
  model DiscoveryImpression {
    id                 String        @id @default(uuid())
    requestingUserId   String
    requestingUser     User          @relation(fields: [requestingUserId], references: [id], onDelete: Cascade)
    candidateProfileId String
    candidateProfile   DatingProfile @relation(fields: [candidateProfileId], references: [id], onDelete: Cascade)
    position           Int           @default(0)
    algorithmVersion   String        @default("baseline-v1")
    servedAt           DateTime      @default(now())
    createdAt          DateTime      @default(now())

    @@index([requestingUserId, servedAt])
    @@index([requestingUserId, candidateProfileId])
    @@index([candidateProfileId, servedAt])
  }
  ```
- Add composite performance indexes on `DatingProfile` (`@@index([gender, dateOfBirth])`) and `DatingPreferences` (`@@index([minAge, maxAge])`).
- Create and apply migration `20260831170000_add_discovery_impressions`.

---

### Shared Contracts & Types (`shared/src/types.ts`)

#### [MODIFY] [types.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/shared/src/types.ts)
- Add discovery types:
  - `DiscoveryCandidate`: safe presentation payload with `profileId`, `userId`, `displayName`, `age`, `gender`, `bio`, `locationCity`, `locationRegion`, `locationCountry`, `relationshipIntent`, `interests`, `photos`, `algorithmVersion`.
  - `DiscoveryEligibilityStatus`: `{ eligible: boolean; reason?: string; message?: string }`.
  - `DiscoveryFeedResponse`: `{ candidates: DiscoveryCandidate[]; nextCursor: string | null; hasMore: boolean; algorithmVersion: string; eligibility: DiscoveryEligibilityStatus }`.
  - `RecordImpressionDto` & `RecordImpressionResponse`.

---

### Backend Discovery Domain (`backend/src/discovery/`)

#### [NEW] [discovery-eligibility.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/discovery-eligibility.service.ts)
- Evaluates requesting user's discovery eligibility:
  - Account status is `ACTIVE`.
  - Dating profile is `READY` (100% completion across all 5 milestones).
  - Profile visibility is `VISIBLE` (or provide structured reason if `HIDDEN`).
  - Age is verified $\ge 18$.

#### [NEW] [mutual-compatibility.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/mutual-compatibility.service.ts)
- Reusable reciprocal compatibility validator:
  - **Gender Compatibility**:
    - Mode `ANY`: accepts all genders.
    - Mode `SELECTED`: accepts only if target gender is in `preferredGenders`.
    - Enforces both `A accepts B` AND `B accepts A`.
  - **Age Compatibility**:
    - Derives calendar age from UTC DOB.
    - Checks `B.age in [A.minAge, A.maxAge]` AND `A.age in [B.minAge, B.maxAge]`.

#### [NEW] [candidate-generator.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/candidate-generator.service.ts)
- Generates bounded candidate pool from PostgreSQL:
  - Filters for `status: READY`, `visibility: VISIBLE`, `id != requestingProfileId`, `user.status: ACTIVE`, and has $\ge 1$ `APPROVED` photo.
  - Generates a bounded pool ($N = \min(\text{limit} \times 3, 100)$) to allow ranking and diversity layers room to operate.

#### [NEW] [exclusion.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/exclusion.service.ts)
- Excludes:
  - Self.
  - Incomplete/hidden profiles or non-active accounts.
  - Profiles with recent impressions (suppression window: 7 days).
  - Safety boundary placeholder for future blocks/reports (Phase 8).

#### [NEW] [feature-extraction.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/feature-extraction.service.ts)
- Extracts normalized feature vectors:
  - `ageProximity`: $1.0 - \frac{|\text{age} - \text{midpoint}|}{\text{rangeSpan} / 2}$ (capped at $[0, 1.0]$).
  - `interestOverlap`: Jaccard index $\frac{|A \cap B|}{|A \cup B|}$.
  - `locationMatch`: Same city ($1.0$), same region ($0.6$), same country ($0.3$), other ($0.0$).
  - `intentMatch`: Exact relationship intent match ($1.0$), compatible intent ($0.5$), disjoint ($0.2$).
  - `freshnessScore`: Recency decay score based on profile update timestamp.
  - `qualityScore`: Normalized score based on approved photo count ($\ge 3 \rightarrow 1.0$) and bio length.

#### [NEW] [ranking.strategy.interface.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/strategies/ranking.strategy.interface.ts) & [baseline-ranking.strategy.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/strategies/baseline-ranking.strategy.ts)
- Replaceable ranking strategy with algorithm version `baseline-v1`.
- Configured weights:
  - Location: `0.25`
  - Relationship Intent: `0.20`
  - Interests Jaccard: `0.20`
  - Age Proximity: `0.15`
  - Profile Quality: `0.10`
  - Profile Freshness: `0.10`

#### [NEW] [diversity.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/diversity.service.ts)
- Post-ranking diversity pass: prevents streaks of identical location or identical intent in a single page while preserving candidate relevance and never violating hard filters.

#### [NEW] [discovery-pagination.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/discovery-pagination.service.ts)
- Opaque cursor generator & validator:
  - Encodes timestamp, offset/seed, and cryptographic checksum.
  - Prevents leaking internal database UUIDs or raw ranking scores.

#### [NEW] [impression.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/impression.service.ts)
- Idempotent recording of impressions.
- Validates candidate IDs belong to the requesting user's discovery feed.
- Enforces Redis rate limiting (max 60 impression events per minute).

#### [NEW] [discovery.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/services/discovery.service.ts)
- Pipeline orchestrator combining all services.
- Traceable with `requestId` and `algorithmVersion`.

#### [NEW] [discovery.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/discovery.controller.ts)
- `GET /api/v1/discovery?cursor=...&limit=20` (`@UseGuards(JwtAuthGuard)`)
- `POST /api/v1/discovery/impressions` (`@UseGuards(JwtAuthGuard)`)

#### [NEW] [discovery.module.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/discovery/discovery.module.ts)
- Registers providers, controllers, and exports `DiscoveryService`.

#### [MODIFY] [app.module.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/app.module.ts)
- Imports `DiscoveryModule`.

---

### Mobile Discovery Experience (`mobile/`)

#### [NEW] [discovery-store.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/stores/discovery-store.ts)
- Zustand store for discovery state:
  - `candidates: DiscoveryCandidate[]`
  - `currentIndex: number`
  - `cursor: string | null`
  - `hasMore: boolean`
  - `eligibility: DiscoveryEligibilityStatus | null`
  - `isLoading: boolean`
  - Actions: `fetchFeed()`, `loadMore()`, `nextCandidate()`, `recordImpression()`, `reset()`.

#### [NEW] [discovery.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/discovery.tsx)
- Complete discovery presentation UI:
  - Profile card with cover photo carousel, display name, age, location, relationship intent, bio, and shared interest tags.
  - "Next Profile" action button (with automatic impression recording).
  - Explicit empty states:
    - Incomplete profile notice with direct CTA to onboarding.
    - No more candidates notice with refresh CTA.
    - Network error notice with retry CTA.

#### [MODIFY] [index.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/index.tsx)
- Adds prominent "Explore Discovery Feed" button when profile is `READY`.

---

## Verification Plan

### Automated Tests
1. **Unit Tests**:
   - `backend/src/discovery/services/mutual-compatibility.service.spec.ts` (test reciprocal gender combinations `ANY` vs `SELECTED`, age ranges, leap day DOBs).
   - `backend/src/discovery/services/feature-extraction.service.spec.ts` (test feature calculations, Jaccard overlap, age proximity, location hierarchy, intent matrix).
   - `backend/src/discovery/strategies/baseline-ranking.strategy.spec.ts` (test deterministic scoring and weight configuration).
   - `backend/src/discovery/services/diversity.service.spec.ts` (test diversity interleaving).
   - `backend/src/discovery/services/discovery-pagination.service.spec.ts` (test opaque cursor creation, parsing, validation, tamper rejection).
   - `backend/src/discovery/services/exclusion.service.spec.ts` (test suppression window, self exclusion, safety exclusions).
   - `backend/src/discovery/services/discovery.service.spec.ts` (test full pipeline orchestration).
   - `backend/src/discovery/services/impression.service.spec.ts` (test impression recording, idempotency, rate limiting).
2. **E2E Tests**:
   - `backend/test/discovery.e2e-spec.ts`:
     - User A requests discovery $\rightarrow$ mutually compatible User B returned.
     - Impression recorded idempotently.
     - User B toggles to `HIDDEN` $\rightarrow$ User B immediately excluded from User A's discovery.
     - User B becomes `SUSPENDED` $\rightarrow$ User B immediately excluded.
     - Cursor pagination across multiple pages without duplicate candidates.
     - Ineligible requesting user (e.g. `IN_PROGRESS` profile) receives clear `PROFILE_NOT_READY` response.

### Build & Linter Verification
- `npm run lint` in `backend/` (0 errors, 0 warnings).
- `npm run build` in `backend/` (compile cleanly).
- `npm test` and `npm run test:e2e` in `backend/` (all tests passing).
- `npm run type-check` in `mobile/` (0 errors).
