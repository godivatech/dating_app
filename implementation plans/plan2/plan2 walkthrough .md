# Phase 2 Walkthrough — Authentication & Account Foundation

## Overview
Phase 2 establishes a rock-solid, production-grade authentication and account foundation for the dating application across the backend (NestJS + PostgreSQL + Redis + Prisma) and mobile frontend (Expo SDK 57 + React Native + Zustand + Axios + SecureStore).

---

## Key Architecture Implemented

1. **Phone Number Normalization & Validation (`backend/src/auth/utils/phone.util.ts`)**:
   - Google `libphonenumber-js` parsing and strict E.164 canonical normalization (e.g. `+919876543210`).
   - Phone masking utility for logs and responses (`+91 98****3210`).

2. **OTP Challenge Generation & Security (`backend/src/auth/services/otp.service.ts`)**:
   - **HMAC Construction**: `HMAC-SHA256(key = OTP_PEPPER, message = challengeId + ":" + otp)`.
   - **Storage**: PostgreSQL `OtpChallenge` single source of truth; zero raw OTPs stored.
   - **Rate Limiting & Cooldown**: Atomic Redis `SET NX EX 60` (60s cooldown per number) and volume throttling (max 3 per 10 minutes).
   - **Attempt Exhaustion**: Constant-time verification (`crypto.timingSafeEqual`) with max 3 attempts before permanent challenge invalidation.
   - **Replay Protection**: `isConsumed` flag with atomic timestamping.

3. **Cryptographic Tokens & Session Management (`backend/src/auth/services/`)**:
   - **Access Token**: Short-lived JWT (15-minute validity).
   - **Refresh Token**: Cryptographically random 256-bit opaque string (64 hex characters). Raw token returned only to client.
   - **Session Storage**: SHA-256 hash stored in PostgreSQL `AuthSession`.
   - **Atomic Rotation**: Serializable transaction-isolated rotation with refresh token reuse detection. If an already-rotated token is submitted, the session is invalidated immediately.
   - **Account Status Guard**: Strict enforcement of `ACTIVE`, `SUSPENDED`, `BANNED`, and `DEACTIVATED` statuses.

4. **Mobile Client Architecture (`mobile/src/`)**:
   - **Secure Storage (`src/services/secure-storage.ts`)**: AES-encrypted token persistence with `expo-secure-store`.
   - **API Client (`src/services/api-client.ts`)**: Axios client with automatic Bearer token injection and mutex-guarded single-flight 401 refresh queue using an isolated client instance.
   - **State Management (`src/stores/auth-store.ts`)**: Zustand store managing session boot checking, OTP dispatching, OTP verification, and session logout.
   - **Screens**:
     - `app/(auth)/login.tsx`: +91 default, phone validation, OTP request, and error feedback.
     - `app/(auth)/verify-otp.tsx`: Masked phone display, 6-digit input, 60s countdown timer, and resend OTP.
     - `app/index.tsx`: Authenticated dashboard displaying verified phone number, `ACTIVE` badge, and session logout.

---

## Verification Results

### 1. Backend Linting & TypeScript Build
- `npm run lint`: **0 errors, 0 warnings**
- `npm run build`: **0 errors (successful NestJS compilation)**

### 2. Backend Unit Tests (`npm test`)
- **6 Test Suites Passed**
- **35 Total Tests Passed**
  - `phone.util.spec.ts` (E.164 parsing, validation, and masking)
  - `otp.service.spec.ts` (HMAC pepper binding, cooldowns, attempt limits, expiration, reuse prevention)
  - `token.service.spec.ts` (Access JWT generation, opaque refresh token hashing)
  - `session.service.spec.ts` (Atomic rotation, concurrent attempt protection, revocation, banned user blocking)
  - `auth.service.spec.ts` (OTP verify, user provisioning, `lastLoginAt` updates, `/me` profile safety)
  - `health.controller.spec.ts` (Service health)

### 3. Backend End-to-End Tests (`npm run test:e2e`)
- **2 Test Suites Passed**
- **10 Total Tests Passed**
  - Invalid phone number rejection (400)
  - OTP challenge creation & mock SMS dispatch (200)
  - 60s cooldown enforcement on rapid retries (429)
  - Incorrect OTP attempt tracking with remaining attempts (400)
  - Valid OTP verification & new user provisioning (200)
  - Unauthorized `/auth/me` rejection (401)
  - Authorized `/auth/me` returning safe user profile (200)
  - Refresh token rotation & old token invalidation (200, 401)
  - Session revocation and token invalidation on logout (200, 401)
  - Health check endpoint (200)

### 4. Mobile TypeScript Compilation (`npm run type-check`)
- `mobile/`: **0 errors** across all screens, hooks, stores, and services.
