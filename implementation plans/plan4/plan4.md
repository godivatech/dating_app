# Final Approved Implementation Plan — Phase 4: Profile Media & Cloudflare R2 Foundation

Build a secure, scalable, and production-oriented profile photo and media foundation using **Cloudflare R2** (S3-compatible API), **NestJS**, **BullMQ + Redis**, **Sharp**, **Prisma + PostgreSQL**, and **Expo SDK 57 (React Native)**.

---

## 1. Architectural Principles & Final User Corrections

> [!IMPORTANT]
> **Key Architecture Decisions & Final Corrections Applied**:
> 1. **Consistent BullMQ + Redis Queue Architecture (No Silent In-Memory Fallbacks)**:
>    - Execution pipeline is strictly: `API` $\rightarrow$ `BullMQ` $\rightarrow$ `Redis` $\rightarrow$ `Media Worker`.
>    - In production and development, if Redis is unavailable, the media queue fails explicitly and clearly rather than silently substituting an in-memory queue.
>    - For unit/E2E tests, BullMQ and Redis are cleanly mocked at the testing module boundary to test job dispatch and worker logic deterministically.
> 2. **Strict Memory Bounding on `getObject()` & Sharp Processing**:
>    - Bounded `getObject()`: Verifies `contentLength` via `headObject` before allocating memory buffer (max 10MB).
>    - Sharp Pixel Limit: Strict limit on decoded dimensions (`limitInputPixels: 36_000_000` i.e. 6000x6000px) to prevent decompression bombs.
>    - Controlled Concurrency: BullMQ worker processes jobs with concurrency limit = 2.
>    - Garbage Collection & Resource Release: Intermediate buffers are nullified, streams destroyed on failure, and memory bounds enforced.
> 3. **Asynchronous Non-Blocking Processing**:
>    - `POST /api/v1/profile/photos/:photoId/complete` verifies R2 object existence, marks status `PROCESSING`, enqueues BullMQ job `photo-process-${photoId}`, and immediately returns 200 with current status.
> 4. **Decoupled Moderation Lifecycle (No Automatic Approval)**:
>    - `UPLOADING` $\rightarrow$ `UPLOADED` $\rightarrow$ `PROCESSING` $\rightarrow$ `PENDING_MODERATION` $\rightarrow$ `APPROVED` | `REJECTED`.
>    - A dedicated test helper method / endpoint allows transitioning from `PENDING_MODERATION` to `APPROVED` for testing environments.
> 5. **Derived `isPrimary` & Contiguous 0..N-1 Ordering**:
>    - No redundant `isPrimary` database column. Derived as: `isPrimary = (position === 0 && status === PhotoStatus.APPROVED)`.
>    - Active approved photos occupy contiguous `0..N-1` positions. Deleting a photo atomically shifts remaining photos and enqueues async R2 cleanup.
>    - Reordering uses row-level locking on `DatingProfile` to prevent race corruptions.
> 6. **Format-Aware Originals & Private Delivery**:
>    - Originals are saved as `profiles/{profileId}/photos/{photoId}/original.{ext}` (validated JPEG, PNG, WebP) and kept strictly private.
>    - Derivatives are standardized WebP (`thumbnail.webp`, `medium.webp`, `large.webp`) and served through the CDN base URL.
> 7. **6-Photo Quota & Abuse Protections**:
>    - Max 6 active photos (`UPLOADING`, `UPLOADED`, `PROCESSING`, `PENDING_MODERATION`, `APPROVED`).
>    - Max 2 concurrent `UPLOADING` photos per user.
>    - Redis rate limit: 10 upload URL requests per 15 min.
>    - Signed upload URL expires in 15 minutes; DB pending records expire in 1 hour.
> 8. **Profile Completion (5 $\times$ 20%)**:
>    - Profile readiness strictly requires $\ge 1$ `APPROVED` photo.
>    - 5 milestones (20% each): Identity, Preferences, Interests, About/Location, Approved Photo.

---

## 2. Database Schema (`backend/prisma/schema.prisma`)

```prisma
enum PhotoStatus {
  UPLOADING
  UPLOADED
  PROCESSING
  PENDING_MODERATION
  APPROVED
  REJECTED
  DELETED
}

model ProfilePhoto {
  id              String        @id @default(uuid())
  profileId       String
  profile         DatingProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  objectKey       String        // e.g. profiles/{profileId}/photos/{photoId}/original.jpg
  thumbnailKey    String?       // e.g. profiles/{profileId}/photos/{photoId}/thumbnail.webp
  mediumKey       String?       // e.g. profiles/{profileId}/photos/{photoId}/medium.webp
  largeKey        String?       // e.g. profiles/{profileId}/photos/{photoId}/large.webp
  status          PhotoStatus   @default(UPLOADING)
  position        Int           @default(0) // Contiguous 0..N-1 for approved photos
  mimeType        String        // image/jpeg, image/png, image/webp
  fileSize        Int           // Bytes
  width           Int?
  height          Int?
  rejectionReason String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([profileId, status])
  @@index([profileId, position])
}
```

---

## 3. Implementation Steps

1. **Prisma & Database Layer**:
   - Update `backend/prisma/schema.prisma` with `ProfilePhoto` model and `PhotoStatus` enum.
   - Run `npx prisma db push` to push schema to Neon PostgreSQL.
   - Create migration SQL in `backend/prisma/migrations/20260831160000_add_profile_photos/migration.sql`.
   - Baseline migration via `npx prisma migrate resolve --applied ...`.
2. **Shared Types (`shared/src/types.ts`)**:
   - Add `PhotoStatus`, `SafeProfilePhoto`, `RequestPhotoUploadDto`, `RequestPhotoUploadResponse`, `ReorderPhotosDto`, `ModeratePhotoDto`.
3. **Backend Media Module (`backend/src/media/`)**:
   - Install `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`, `@types/sharp`, `bullmq`, `@nestjs/bullmq`.
   - Storage service: `R2StorageService` implementing `StorageService` interface.
   - Image processor: `ImageProcessorService` using Sharp (magic byte check, dimension limits, EXIF stripping, WebP derivative generation).
   - Media processor worker: `PhotoProcessingWorker` (BullMQ processor executing Sharp pipeline, idempotency guard, deletion race check).
   - Domain service: `PhotosService` (upload URL generation, quota validation, completion endpoint, reordering, primary photo shifting, deletion, rate limiting).
   - Controller: `PhotosController` exposing `/profile/photos/*` REST endpoints.
   - Update `ProfileCompletionService` to 5 milestones (20% each) with $\ge 1$ approved photo.
   - Register `MediaModule` in `backend/src/app.module.ts`.
4. **Backend Unit & E2E Tests**:
   - `storage.service.spec.ts`, `image-processor.service.spec.ts`, `photos.service.spec.ts`, `profile-completion.service.spec.ts`.
   - `test/photos.e2e-spec.ts`.
   - Run `npm run lint`, `npm test`, and `npm run test:e2e`.
5. **Mobile Photo Management (`mobile/`)**:
   - Install `expo-image-picker`.
   - Update `useProfileStore` with photo upload/reorder/delete actions.
   - Create `mobile/app/(onboarding)/photos.tsx` (Step 5 of onboarding).
   - Update `mobile/app/(onboarding)/ready.tsx` and `mobile/app/index.tsx` with photo gallery & primary photo avatar.
   - Run `npm run type-check`.
6. **Deliver Phase 4 Completion Report**.
