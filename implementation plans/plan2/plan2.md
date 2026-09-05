# Phase 2: Authentication & Account Foundation — Implementation Plan

This plan establishes the secure, production-grade **Authentication & Account Foundation** for the dating app, updated with all required architectural corrections: opaque random refresh tokens, atomic token rotation with reuse detection, PostgreSQL as the sole OTP source of truth, atomic Redis rate-limiting/cooldowns, account status enforcement, phone privacy in logs, Axios single-flight refresh queue, and comprehensive security test suites.

---

## User Review Required

> [!IMPORTANT]
> **Opaque Refresh Tokens & Atomic Rotation**:
> - Refresh tokens are cryptographically random 256-bit opaque strings (`crypto.randomBytes(32).toString('hex')`), NOT signed JWTs.
> - Only the SHA-256 hash (`refreshTokenHash`) is persisted in PostgreSQL (`AuthSession`). The raw token is returned exclusively to the client over HTTPS.
> - Token rotation is executed in an atomic PostgreSQL transaction. If an already-rotated or invalid refresh token is submitted (token reuse detected), the entire session family is revoked immediately to protect the user against replay attacks.

> [!IMPORTANT]
> **OTP Storage & Single Source of Truth**:
> - PostgreSQL (`OtpChallenge`) is the **single source of truth** for OTP verification, attempts tracking, and consumption state.
> - OTP storage uses **HMAC-SHA256 using a server-side secret pepper, with the challenge ID bound into the HMAC message**:
>   `HMAC-SHA256(key = server-side OTP pepper, message = challengeId + ":" + otp)`
> - The OTP pepper exists only on the backend from environment/secret config, never committed to Git, never exposed to the mobile app, and never stored in PostgreSQL.
> - Redis is used strictly for high-speed rate-limiting, per-phone 60s cooldowns (`SET key value NX EX 60`), and abuse counters.
> - In-memory Redis fallback is permitted **only** in `development` and `test` environments. In `production`, the application strictly fails fast if Redis is unavailable.

---

## Architectural Corrections & Design Specifications

### 1. Database Schema (`backend/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
  DEACTIVATED
}

model User {
  id              String        @id @default(uuid())
  phoneNumber     String        @unique // Normalized canonical E.164 (e.g. +919876543210)
  phoneVerifiedAt DateTime?
  status          UserStatus    @default(ACTIVE)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  lastLoginAt     DateTime?

  sessions        AuthSession[]

  @@index([phoneNumber])
  @@index([status])
}

model OtpChallenge {
  id            String    @id @default(uuid())
  phoneNumber   String    // Normalized E.164
  otpHash       String    // HMAC-SHA256(key = OTP_PEPPER, message = challengeId + ":" + otp)
  expiresAt     DateTime
  attemptsCount Int       @default(0)
  maxAttempts   Int       @default(3)
  isConsumed    Boolean   @default(false)
  consumedAt    DateTime?
  createdAt     DateTime  @default(now())

  @@index([phoneNumber, isConsumed, expiresAt])
}

model AuthSession {
  id               String     @id @default(uuid())
  userId           String
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String     @unique // SHA-256 hash of opaque refresh token
  userAgent        String?
  ipAddress        String?
  expiresAt        DateTime
  revokedAt        DateTime?
  lastUsedAt       DateTime   @default(now())
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@index([userId, revokedAt, expiresAt])
  @@index([refreshTokenHash])
}
```

---

### 2. OTP Security & Atomic Cooldown

* **Generation**: Cryptographically secure 6-digit number via `crypto.randomInt(100000, 999999)`.
* **Storage**: `HMAC-SHA256(key = OTP_PEPPER, message = challengeId + ":" + otp)` stored in PostgreSQL `OtpChallenge`.
* **Verification**: Constant-time comparison using `crypto.timingSafeEqual`.
* **Atomic Cooldown (`Redis`)**:
  * Key: `rl:otp:cooldown:<normalizedPhone>`
  * Execution: `SET key 1 NX EX 60`
  * Concurrent requests for the same phone will race atomically; only one succeeds, while the other receives `429 Too Many Requests (Cooldown Active)`.
* **Rate Limits (`Redis`)**:
  * Phone volume limit: Max 3 requests per 10 minutes (`rl:otp:phone:<normalizedPhone>`).
  * IP volume limit: Max 10 requests per 10 minutes (`rl:otp:ip:<ip>`).
* **Attempt Limits**:
  * Atomically increments `attemptsCount`. If `attemptsCount >= maxAttempts` (default 3), the challenge is marked invalid.
* **Enumeration Safe**: `POST /api/v1/auth/otp/request` returns generic challenge metadata (`{ challengeId, expiresIn }`) without revealing user existence.
* **Phone Privacy**: All logs redact phone numbers (e.g. `+91 98****3210`). Plaintext OTPs, tokens, and secrets are never logged.

---

### 3. Session Management & Atomic Rotation

* **Access Token**: Short-lived JWT (15 minutes) signed with `JWT_ACCESS_SECRET`, containing `{ sub: userId, sessionId: string }`.
* **Refresh Token**: Cryptographically random 256-bit opaque string (`crypto.randomBytes(32).toString('hex')`).
* **Atomic Rotation & Reuse Detection**:
  ```text
  Client sends raw refreshToken
      ↓
  Compute sha256(refreshToken) -> targetHash
      ↓
  Run PostgreSQL Transaction:
    1. Look up session where refreshTokenHash = targetHash
    2. If NOT found:
       Check if targetHash matches an already-rotated session
       -> If reuse detected: REVOKE all active sessions for that user & log security alert!
       -> Return 401 Unauthorized
    3. If found but revokedAt is NOT NULL or expiresAt <= now():
       -> Return 401 Unauthorized
    4. Check user status:
       -> If user.status != 'ACTIVE': Return 403 Forbidden
    5. Generate new opaque refreshToken & newAccessToken
    6. Atomically update session:
       UPDATE AuthSession
       SET refreshTokenHash = sha256(newRefreshToken),
           lastUsedAt = now(),
           expiresAt = now() + 30 days
       WHERE id = session.id AND refreshTokenHash = targetHash
    7. Commit transaction
    8. Return new tokens to client
  ```
* **`lastLoginAt`**: Updated on the `User` record only upon successful OTP verification or session creation (never upon OTP request).
* **Logout (`POST /api/v1/auth/logout`)**: Server-side revocation by setting `revokedAt = new Date()` on the authenticated `AuthSession`.

---

### 4. Mobile Architecture (Axios Single-Flight Refresh Queue)

* **HTTP Client**: Standardized exclusively on **Axios** with interceptors:
  * **Request Interceptor**: Injects `Authorization: Bearer <accessToken>`.
  * **Response Interceptor (401 Handler with Mutex Queue)**:
    * When Request A, B, and C hit 401 simultaneously:
      1. Request A initiates `POST /api/v1/auth/refresh` (`isRefreshing = true`).
      2. Requests B & C are queued into `failedQueue`.
      3. The `/api/v1/auth/refresh` endpoint itself uses a clean axios instance to **never** trigger the 401 interceptor (preventing infinite loops).
      4. On refresh success: Updates `expo-secure-store`, resolves `failedQueue`, and retries Requests A, B, and C with the new access token.
      5. On refresh failure: Rejects `failedQueue`, clears `expo-secure-store`, resets Zustand auth store to `UNAUTHENTICATED`, and navigates to the login screen.
* **Secure Storage**: `expo-secure-store` used exclusively for storing `accessToken` and `refreshToken`. User profile data/metadata is kept in Zustand memory.
* **Country Code**: India-first (`+91`), parses and normalizes via `libphonenumber-js`.

---

## Comprehensive Test Suite

### Backend Unit & Integration Tests (`npm run test`)
1. **Phone Utility**:
   - Valid Indian national numbers (`9876543210` -> `+919876543210`).
   - Valid international numbers (`+14155552671`).
   - Invalid numbers (letters, too short, too long).
2. **OTP Security**:
   - Generates 6-digit OTP.
   - Hashes with `HMAC-SHA256(key = OTP_PEPPER, message = challengeId + ":" + otp)`.
   - Rejects incorrect OTP and decrements remaining attempts.
   - Rejects expired OTP challenge.
   - Rejects consumed OTP challenge (replay prevention).
   - Invalidation upon reaching max attempts (attempt exhaustion).
3. **Concurrency & Rate Limiting**:
   - **Concurrent OTP requests**: 2 simultaneous requests for same phone -> 1 succeeds, 1 receives 429 Cooldown.
   - **Rate limit bypass attempts**: 4th request within 10m window receives 429.
4. **Session & Token Management**:
   - Access token JWT signing and expiration check.
   - Opaque refresh token generation and SHA-256 database storage.
   - **Concurrent refresh requests**: 2 simultaneous refresh requests for same token -> exactly 1 rotates successfully, the other is rejected.
   - **Refresh token reuse detection**: Presenting an already-rotated token revokes all sessions.
   - **Revoked & expired session rejection**: Cannot refresh from revoked/expired sessions.
5. **Account Status Enforcement**:
   - `SUSPENDED`, `BANNED`, `DEACTIVATED` accounts cannot authenticate via OTP verify or refresh.
6. **`lastLoginAt` Lifecycle**:
   - Verified that `lastLoginAt` is updated only on successful auth, not on OTP request.

### Backend E2E Tests (`npm run test:e2e`)
* Complete flow:
  1. `POST /api/v1/auth/otp/request` -> 200 `{ challengeId, expiresIn }`.
  2. `POST /api/v1/auth/otp/verify` with wrong OTP -> 400 Bad Request.
  3. `POST /api/v1/auth/otp/verify` with valid OTP -> 200 with tokens + user.
  4. `GET /api/v1/auth/me` with Bearer token -> 200 with safe user info.
  5. `POST /api/v1/auth/refresh` -> 200 with rotated tokens.
  6. `POST /api/v1/auth/logout` -> 200 session revoked.
  7. `GET /api/v1/auth/me` -> 401 Unauthorized.

### Mobile Verification
* `npm run type-check` in `mobile/` (`tsc --noEmit` passing 0 errors).
* Verify Axios single-flight refresh queue logic and SecureStore error handling.
