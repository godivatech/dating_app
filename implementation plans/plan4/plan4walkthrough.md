# Phase 4 Walkthrough: Profile Media & Cloudflare R2 Foundation

## Overview
Phase 4 implements a secure profile photo foundation integrating Cloudflare R2 presigned uploads, asynchronous BullMQ image processing, Sharp WebP derivative generation, dynamic primary photo indexing, and mobile photo management UI.

---

## Changes Implemented

### 1. Database Schema & Migration (`backend/prisma/`)
- **`PhotoStatus` Enum**: `UPLOADING`, `UPLOADED`, `PROCESSING`, `PENDING_MODERATION`, `APPROVED`, `REJECTED`, `DELETED`.
- **`ProfilePhoto` Model**:
  - `objectKey`: Private original image object path (`profiles/:profileId/photos/:photoId/original.:ext`).
  - `thumbnailKey`, `mediumKey`, `largeKey`: Derivative object paths.
  - `position`: Contiguous zero-indexed photo order (`0..N-1`).
  - Note: `isPrimary` was omitted from the DB schema and is derived dynamically (`isPrimary = position === 0 && status === APPROVED`).
- **Neon Migration**: Applied and verified `20260831160000_add_profile_photos`.

### 2. Storage & Image Processing Pipeline (`backend/src/media/`)
- **`StorageService` & `R2StorageService`**:
  - Direct presigned PUT URLs with 15-minute expiry.
  - Memory-bounded `getObject()` with strict 10MB pre-buffer check.
  - Async multi-object deletion.
- **`ImageProcessorService`**:
  - Input pixel limit: 36,000,000 pixels (6000x6000px max).
  - EXIF and GPS metadata stripping.
  - WebP derivatives: Thumbnail (300x300), Medium (720x960), Large (1080x1440).
- **`PhotoProcessingWorker`**:
  - BullMQ background worker with bounded concurrency (`concurrency: 2`).
  - Race condition checks before Sharp processing and before committing to DB.
  - Transitions successfully processed photos to `PENDING_MODERATION`.
- **`PhotosService` & `PhotosController`**:
  - Upload URL generation with Redis rate-limiting (10 req / 15 min), 6-photo quota, and max 2 pending uploads.
  - Idempotent upload finalization (`POST /profile/photos/:photoId/complete`).
  - Atomic primary photo shift (`PATCH /profile/photos/:photoId/primary`).
  - Atomic reordering (`PATCH /profile/photos/reorder`).
  - Atomic deletion and remaining photo re-indexing (`DELETE /profile/photos/:photoId`).

### 3. Profile Completion 5 Milestones (`backend/src/profile/`)
- Milestone breakdown (20% each = 100%):
  1. Identity (20%): `displayName`, `dateOfBirth` (18+), `gender`
  2. Preferences (20%): `minAge`, `maxAge`, `relationshipIntent`
  3. Interests (20%): $\ge 3$ active reference interests
  4. About & Location (20%): `bio` ($\ge 10$ chars) and `locationCity`
  5. Photos (20%): $\ge 1$ `APPROVED` photo
- Profile readiness strictly requires 100% score (`isReady = true`).
- `ProfileVisibility.VISIBLE` is blocked until profile is `READY`.

### 4. Mobile Integration (`mobile/`)
- **`profile-store.ts`**: Integrated `uploadPhoto` (blob upload to presigned R2 URL + complete), `setPrimaryPhoto`, `reorderPhotos`, `deletePhoto`.
- **`photos.tsx` (Step 5 of 5)**: Photo grid, upload button with `expo-image-picker`, primary badge, move up/down, delete action.
- **`about-location.tsx` & `ready.tsx`**: Updated step indicators and profile review card.
- **`index.tsx`**: Updated dashboard with primary photo cover display and onboarding routing guards.

---

## Verification Results

### Backend Automated Tests
- **Unit Test Suites**: 12 passed, 12 total (80/80 tests passing).
- **E2E Test Suites**: 4 passed, 4 total (32/32 tests passing).
- **Linter**: ESLint passed with 0 errors and 0 warnings.
- **Build**: NestJS production build completed successfully.

### Mobile Type Check
- **TypeScript**: `tsc --noEmit` passed with 0 errors.
