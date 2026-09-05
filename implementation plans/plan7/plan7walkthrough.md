# Phase 7 Walkthrough: Real-Time Chat & Messaging Foundation

## Overview
Phase 7 establishes the **1-to-1 Real-Time Chat and Messaging Foundation** between matched users. A mutual match creates permission to communicate; the messaging domain reliably persists, sequences, synchronizes, and delivers messages with full delivery/read state tracking, typing indicators, and safety/unmatch enforcement.

---

## Architecture & Implementation Highlights

### 1. Database Schema & Migration (`backend/prisma/`)
- **`Conversation` Model**:
  - `id`: UUID primary key
  - `matchId`: Unique foreign key to `Match` (`@unique`, cascade on delete)
  - `lastSequence`: Integer sequence counter (`@default(0)`). Used for atomic PostgreSQL row-level lock incrementing during sends to guarantee gapless, monotonic message ordering without concurrency collisions.
  - `lastMessageAt`: Timestamp of latest message activity for fast sorting
  - `lastMessagePreview`: Snippet of latest message body (first 100 characters)
  - Indexes: `@@index([matchId])`, `@@index([updatedAt])`, `@@index([lastMessageAt])`.
- **`ConversationParticipantState` Model**:
  - `conversationId`, `userId`
  - `lastReadSequence`: Integer sequence through which the user has acknowledged reading
  - `lastReadAt`: Timestamp of latest read
  - `@@unique([conversationId, userId])` provides $O(1)$ read-through tracking and instant unread count calculation.
- **`Message` Model**:
  - `id`: UUID primary key
  - `conversationId`: Foreign key to `Conversation`
  - `senderUserId`: Foreign key to `User`
  - `clientMessageId`: Client-generated idempotency UUID
  - `sequence`: Monotonic integer sequence within the conversation ($1, 2, 3\dots$)
  - `body`: Plain text message body (max 2000 chars, UTF-8/multilingual support)
  - `type`: `MessageType` enum (`TEXT`)
  - `deliveryStatus`: `MessageDeliveryStatus` enum (`SENT`, `DELIVERED`, `READ`)
  - Indexes: `@@unique([conversationId, clientMessageId])`, `@@unique([conversationId, sequence])`, `@@index([conversationId, sequence])`, `@@index([senderUserId])`.
- **Migration**: Created and applied `20260831190000_add_chat_and_messaging`.

---

### 2. Backend Messaging Domain (`backend/src/chat/`)
- **`MessagesService` (`services/messages.service.ts`)**:
  - **Account & Match Status Checks**: Fails closed with `403 Forbidden` if either participant is suspended/banned or if the match has been `UNMATCHED`.
  - **Rate Limiting**: Redis sliding window enforces max 60 messages/min per user.
  - **Atomic Row-Lock Sequence Allocation**: Updates `Conversation.lastSequence` with `{ increment: 1 }` within a PostgreSQL transaction, guaranteeing that concurrent sends allocate unique, contiguous sequence numbers.
  - **Client Message Idempotency**: Checks `clientMessageId` within the conversation. Retried requests return the existing message row without creating duplicates.
  - **Read Receipts & Delivery Acks**: Updates message status (`SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ`) and tracks participant `lastReadSequence`.
  - **Reconnect Synchronization**: `syncMissedMessages(userId, conversationId, sinceSequence)` fetches all messages created after `sinceSequence`.
- **`ConversationsService` (`services/conversations.service.ts`)**:
  - `getOrCreateConversation(matchId, userId)`: Authorizes match participants and returns conversation summary with safe candidate profile and unread counts.
  - `listConversations(userId, query)`: Cursor-paginated conversation list ordered by latest activity.
- **`ChatGateway` (`gateways/chat.gateway.ts`)**:
  - WebSocket gateway on namespace `/chat`.
  - JWT Bearer authentication on connection handshake.
  - Subscriptions: `conversation.join`, `conversation.leave`.
  - Real-time events: `message.send`, `message.ack`, `message.created`, `message.delivery_ack`, `message.delivered`, `message.read`, `typing.start`, `typing.stop`, `conversation.sync`.

---

### 3. Mobile Real-Time Chat Experience (`mobile/`)
- **`chatSocket` (`src/services/chat-socket.service.ts`)**:
  - Socket.IO client manager with automatic reconnect, JWT header injection, and event dispatchers.
- **`useChatStore` (`src/stores/chat-store.ts`)**:
  - Zustand store managing conversations, messages per conversation, unread counts, typing status, and optimistic message delivery.
- **`ConversationsScreen` (`app/conversations.tsx`)**:
  - Responsive conversation list with avatar thumbnails, partner names, message previews, timestamps, unread badges, and connection indicators.
- **`ChatScreen` (`app/chat/[conversationId].tsx`)**:
  - 1:1 messaging interface:
    - Partner header with avatar, name, typing status.
    - Differentiated message bubbles (sent vs received).
    - Delivery tick indicators: ✓ Sent, ✓✓ Delivered, ✓✓ Read.
    - Ephemeral typing indicator animation banner.
    - Multiline input composer with character counter and safe area insets.
    - Disabled composer banner if match has ended.
- **`MatchesScreen` (`app/matches.tsx`)**:
  - "💬 Send Message" CTA seamlessly opens or creates the conversation and navigates to the chat screen.

---

## Verification & Test Results

```text
Backend:
- npm run lint: 0 errors, 0 warnings
- npm run build: Compiled successfully (0 errors)
- npm test: 24 passed, 24 total (126/126 unit tests passing)
- npm run test:e2e: 8 passed, 8 total (51/51 E2E tests passing)

Mobile:
- npm run type-check (tsc --noEmit): Passed with 0 errors
```
