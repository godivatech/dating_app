# Phase 10: Monetization, Entitlements & Business Foundation — Implementation Plan

## Objective

Build a production-grade, extensible **Monetization, Entitlements & Business Foundation** for the dating platform tailored for the Indian market (launching in Tamil Nadu with INR pricing) without disrupting or weakening the Phase 1–9 architecture.

The core principles are:
1. **Server-Authoritative Entitlements**: Other domains query `EntitlementService.has(userId, capability)` rather than inspecting subscription tables directly.
2. **Decoupled Billing Domain**: All subscription management, store receipt verification, transaction idempotency, and capability grants reside in a dedicated `backend/src/billing/` domain.
3. **Store Agnostic & Replay Protected**: Support Apple App Store & Google Play Billing interfaces with idempotent transaction verification and mock sandbox provider for automated testing.
4. **Marketplace Health Protection**: Keep foundational discovery, mutual matching, 1-to-1 chat, and safety 100% free; monetize non-essential convenience and visibility perks (e.g. `SEE_LIKES`, `UNLIMITED_LIKES`, `REWIND_PASS`, `DISCOVERY_PRIORITY`).

---

## 1. Architecture Audit & Domain Mapping

```text
               Mobile App (iOS / Android)
                           │
             In-App Purchase Transaction Proof
                           ▼
          POST /billing/verify-purchase
                           │
                           ▼
            BillingController / PurchaseService
                           │
               PurchaseProvider Verification
               (Apple / Google / Mock Sandbox)
                           │
                           ▼
              Atomic PostgreSQL Transaction
  ┌────────────────────────┼────────────────────────┐
  │                        │                        │
PurchaseTransaction    UserSubscription       UserEntitlement
(Idempotent Log)       (Lifecycle State)      (Granted Capabilities)
                           │
                           ▼
                 EntitlementService
      (Authoritative Gate queried by other domains)
         │                     │                    │
         ▼                     ▼                    ▼
   ActionsService        MatchesService      DiscoveryService
(Daily Like Quotas)     (Who Liked You)     (Priority Ranking)
```

---

## 2. Proposed Changes

### 2.1 Database & Schema (`backend/prisma/schema.prisma`)

- **New Enums**:
  - `SubscriptionTier`: `FREE`, `PLUS`, `GOLD`, `A_LA_CARTE`
  - `SubscriptionStatus`: `ACTIVE`, `CANCELED`, `EXPIRED`, `REVOKED`, `GRACE_PERIOD`, `PAUSED`
  - `BillingPeriod`: `MONTHLY`, `QUARTERLY`, `ANNUAL`, `ONE_TIME`
  - `PaymentProvider`: `APPLE`, `GOOGLE`, `MOCK`
  - `TransactionStatus`: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`, `REVOKED`
  - `EntitlementKey`: `UNLIMITED_LIKES`, `SEE_LIKES`, `REWIND_PASS`, `PROFILE_BOOST`, `ADVANCED_PREFERENCES`, `DISCOVERY_PRIORITY`
  - `EntitlementSource`: `SUBSCRIPTION`, `ONE_TIME_PURCHASE`, `PROMOTION`, `ADMIN_GRANT`, `REFERRAL`

- **New Models**:
  - `SubscriptionProduct`: Defines plans (e.g., Spark Plus 1 Month @ ₹299, Spark Gold 3 Months @ ₹799, Boost Pack @ ₹99) with platform store identifiers.
  - `UserSubscription`: Tracks active/historical subscription lifecycle, `expiresAt`, `autoRenewing`, `canceledAt`.
  - `PurchaseTransaction`: Stores verified receipts, `providerTransactionId` (unique for replay protection), amount, currency.
  - `UserEntitlement`: Stores discrete user capabilities, `startsAt`, `expiresAt`, `isActive`.

- **User Model Relations**:
  - `subscriptions UserSubscription[]`
  - `transactions PurchaseTransaction[]`
  - `entitlements UserEntitlement[]`

---

### 2.2 Shared Contracts (`shared/src/types.ts`)

- Add TypeScript enums and interfaces:
  - `SubscriptionTier`, `SubscriptionStatus`, `BillingPeriod`, `PaymentProvider`, `TransactionStatus`, `EntitlementKey`, `EntitlementSource`
  - `SafeSubscriptionProduct`, `SafeUserSubscription`, `SafeUserEntitlement`, `BillingStatusResponse`
  - `VerifyPurchaseDto`, `VerifyPurchaseResponse`, `RestorePurchasesDto`, `RestorePurchasesResponse`
  - `IncomingLikesResponse`, `IncomingLikeItem`

---

### 2.3 Backend Billing Domain (`backend/src/billing/`)

- **`PurchaseProvider` Interface & `MockPurchaseProvider`**:
  - Defines `verifyReceipt(platform, receiptToken, storeProductId)` and `restorePurchases(platform, receiptTokens)`.
  - `MockPurchaseProvider`: Simulates store validation for testing.
- **`EntitlementService`**:
  - `hasEntitlement(userId: string, key: EntitlementKey): Promise<boolean>`
  - `getUserEntitlements(userId: string): Promise<SafeUserEntitlement[]>`
  - `grantEntitlement(userId, key, source, sourceId, expiresAt)`
  - `revokeEntitlementsForSource(source, sourceId)`
- **`SubscriptionService`**:
  - `getActiveSubscription(userId: string): Promise<SafeUserSubscription | null>`
  - `getAvailableProducts(): Promise<SafeSubscriptionProduct[]>`
  - `createOrUpdateSubscription(userId, productId, provider, providerSubId, expiresAt, autoRenewing)`
  - `cancelSubscription(userId: string): Promise<SafeUserSubscription>`
  - `syncSubscriptionState(userId: string)`
- **`PurchaseService`**:
  - `verifyPurchase(userId: string, dto: VerifyPurchaseDto): Promise<VerifyPurchaseResponse>`: Replay-protected, atomic transaction updating transaction history, subscription state, and granting entitlements.
  - `restorePurchases(userId: string, dto: RestorePurchasesDto): Promise<RestorePurchasesResponse>`
- **`BillingController`**:
  - `GET /billing/products`: Returns active subscription and a-la-carte products with INR pricing.
  - `GET /billing/status`: Returns user's active subscription, renewal dates, and active entitlements.
  - `POST /billing/verify-purchase`: Verifies mobile transaction and grants entitlements.
  - `POST /billing/restore-purchases`: Restores previous active purchases.
  - `POST /billing/cancel`: Cancels auto-renewal (access remains active until `expiresAt`).
- **`BillingModule`**:
  - Registered and exported in `app.module.ts`.

---

### 2.4 Cross-Domain Entitlement Integrations

- **`ActionsService` (`backend/src/matching/services/actions.service.ts`)**:
  - Daily Free Likes Quota: 25 likes / 24 hours tracked via Redis.
  - Free users exceeding quota without `UNLIMITED_LIKES` entitlement receive a `402 Payment Required` with `DAILY_LIKE_LIMIT_REACHED` error and upsell payload.
  - Users with `UNLIMITED_LIKES` bypass the limit.
  - `undoLastPass(userId)`: Checks `REWIND_PASS` entitlement before un-passing.
- **`MatchesService` (`backend/src/matching/services/matches.service.ts`)**:
  - `getIncomingLikes(userId, query)`:
    - Counts users who liked requester's profile.
    - If user has `SEE_LIKES` entitlement: returns full profile candidates.
    - If user does not have `SEE_LIKES`: returns total count and blurred placeholders (`unlocked: false`).

---

### 2.5 Mobile Monetization & Paywall Layer (`mobile/`)

- **`mobile/src/stores/billing-store.ts`**: Zustand store for subscription state, entitlements, plans, purchase verification, and paywall modal triggers.
- **`mobile/src/components/PaywallModal.tsx`**: Modern bottom-sheet paywall with INR pricing (₹299/mo, ₹699/3-mo), Free vs Plus vs Gold comparison, purchase handler, and restore button.
- **`mobile/app/premium.tsx`**: Dedicated membership screen displaying active benefits, renewal dates, and upgrade options.
- **`mobile/app/matches.tsx`**: "Who Liked You" incoming likes grid showing real count, blurred teaser cards for free users, and full unlock for `SEE_LIKES` holders.
- **`mobile/app/index.tsx`**: Premium badge, "Upgrade to Spark Plus" banner, and direct link to membership and "Who Liked You".

---

## 3. Verification & Testing Plan

### 3.1 Backend Unit Tests
- `billing/services/entitlement.service.spec.ts`: Entitlement checks, expiration handling, multi-source grants.
- `billing/services/subscription.service.spec.ts`: Subscription transitions, cancellations, renewal states.
- `billing/services/purchase.service.spec.ts`: Receipt validation, idempotency, duplicate receipt rejection.
- `matching/services/actions.service.spec.ts`: Daily like limits vs `UNLIMITED_LIKES` bypass.
- `matching/services/matches.service.spec.ts`: `getIncomingLikes` with and without `SEE_LIKES`.

### 3.2 Backend E2E Tests (`backend/test/billing.e2e-spec.ts`)
- Product listing with INR currency and pricing tiers.
- In-App Purchase verification and entitlement activation.
- Replay attack protection (duplicate provider transaction ID rejected).
- Daily like quota enforcement and premium bypass.
- Incoming likes inspection with `SEE_LIKES` entitlement.
- Subscription cancellation (remains active until `expiresAt`).
- Purchase restoration.

### 3.3 Mobile Compilation & Integration
- `npx tsc --noEmit` in `mobile/`.
- Full lint and build checks in `backend/`.
