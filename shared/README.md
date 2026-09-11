# shared/

> **Status**: Active & Implemented.

This package contains **shared TypeScript types, interfaces, DTOs, and Domain Enums** consumed across `mobile/`, `backend/`, and `admin/`.

## Architecture & Guiding Principles

1. **Single Source of Truth**: All shared domain models (Enums, API Requests/Responses, WebSocket Event Payloads) are defined in [`shared/src/types.ts`](./src/types.ts).
2. **Type Safety Across Monorepo**: Used directly by:
   - `backend/`: NestJS controllers, services, validation DTOs.
   - `mobile/`: React Native (Expo) stores, screens, socket services.
   - `admin/`: Vite React administrative management portal.

## Key Shared Domains

- **Authentication & Security**: `UserStatus`, `UserRole`, `SafeUser`, OTP request/verify DTOs, JWT payload formats.
- **Profile & Discovery**: `Gender`, `RelationshipIntent`, `PreferredGenderMode`, `ProfileStatus`, `ProfileVisibility`, `DiscoveryCardDto`, `MatchPreferencesDto`.
- **Media & Photos**: `PhotoStatus`, `SafeProfilePhoto`, upload URL request/response interfaces.
- **Matching & Interactions**: `UserActionType`, `InteractionResult`, `MatchStatus`, `MutualMatchDto`, Direct Note envelopes.
- **Messaging & Chat**: `ConversationSummaryDto`, `ChatMessageDto`, `MessageStatus`, real-time Socket.io payloads.
- **Audio & Video Calling**: `CallType`, `CallStatus`, `CallEndReason`, Agora RTC tokens, WebRTC signalling payloads.
- **Monetization & Billing**: `SubscriptionTier`, `SubscriptionStatus`, `EntitlementKey`, store product SKU IDs, purchase receipts.
- **Trust & Safety / Moderation**: `ReportReason`, `ReportStatus`, `ModerationActionType`, `StrikeSeverity`, `AdminUserDetailDto`, audit log contracts.
