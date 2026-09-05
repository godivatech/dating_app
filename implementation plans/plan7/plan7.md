# Phase 7: Real-Time Chat & Messaging Foundation — Implementation Plan

Phase 7 introduces the **1-to-1 Real-Time Chat and Messaging Foundation** between matched users. A mutual match establishes permission to communicate; the messaging domain reliably persists, orders, synchronizes, and delivers messages with full delivery/read state tracking, typing indicators, and unmatch/safety enforcement.

---

## User Review Required

> [!IMPORTANT]
> **Strict Architectural Boundaries**:
> 1. **Database as Single Source of Truth**: Messages are durably persisted to PostgreSQL before WebSocket distribution. WebSockets serve purely as an ephemeral delivery mechanism.
> 2. **Deterministic Sequence Ordering**: Every conversation maintains an incrementing integer `sequence` number ($1, 2, 3\dots$) alongside timestamps, ensuring unambiguous message ordering across concurrent sends and multi-device sync.
> 3. **Client Message Idempotency**: All message writes require a client-generated UUID (`clientMessageId`). Retries reuse the ID and return the existing message without duplicate row creation or sequence increment.
> 4. **Delivery & Read Lifecycle**: 
>    - `SENT`: Persisted in PostgreSQL.
>    - `DELIVERED`: Recipient's client sends delivery ACK.
>    - `READ`: Recipient opens conversation and acknowledges messages through `throughSequence`.
> 5. **Safety & Unmatch Invalidation**: When a match is `UNMATCHED` or an account is `SUSPENDED`/`BANNED`, new message sending is immediately blocked.

---

## Architecture & Data Flow

```text
               Mobile Client A (Sender)
                         │
         1. Sends Message (clientMessageId, body)
                         ▼
        ┌───────────────────────────────────┐
        │  NestJS ChatGateway / MessagesAPI │
        └─────────────────┬─────────────────┘
                          │ 2. Authenticate & Authorize Match
                          │ 3. Check Idempotency
                          │ 4. Assign Monotonic Sequence
                          ▼
        ┌───────────────────────────────────┐
        │       PostgreSQL Transaction      │
        │  - Insert/Upsert Message          │
        │  - Update Conversation lastMessage│
        └─────────────────┬─────────────────┘
                          │ 5. Authoritative ACK to Sender
                          ▼
        ┌───────────────────────────────────┐
        │  Redis / WebSocket Distribution   │
        └─────────────────┬─────────────────┘
                          │ 6. Real-Time Event (message.created)
                          ▼
               Mobile Client B (Recipient)
                          │
          7. Sends Delivery ACK (message.delivered)
          8. Sends Read Receipt (message.read)
```

---

## Proposed Changes

### Dependencies (`backend/` & `mobile/`)

#### [MODIFY] [backend/package.json](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/package.json)
- Add `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`.

#### [MODIFY] [mobile/package.json](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/package.json)
- Add `socket.io-client`.

---

### Database Schema & Migrations (`backend/prisma/`)

#### [MODIFY] [schema.prisma](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/prisma/schema.prisma)
- Add `MessageDeliveryStatus` enum: `SENT`, `DELIVERED`, `READ`.
- Add `MessageType` enum: `TEXT` (extensible for future media).
- Add `Conversation` model:
  ```prisma
  model Conversation {
    id                  String             @id @default(uuid())
    matchId             String             @unique
    match               Match              @relation(fields: [matchId], references: [id], onDelete: Cascade)
    lastMessageAt       DateTime?
    lastMessagePreview  String?
    createdAt           DateTime           @default(now())
    updatedAt           DateTime           @updatedAt

    messages            Message[]
    participantStates   ConversationParticipantState[]

    @@index([matchId])
    @@index([updatedAt])
    @@index([lastMessageAt])
  }
  ```
- Add `ConversationParticipantState` model:
  ```prisma
  model ConversationParticipantState {
    id                 String        @id @default(uuid())
    conversationId     String
    conversation       Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    userId             String
    user               User          @relation(fields: [userId], references: [id], onDelete: Cascade)
    lastReadSequence   Int           @default(0)
    lastReadAt         DateTime      @default(now())

    @@unique([conversationId, userId])
    @@index([conversationId])
    @@index([userId])
  }
  ```
- Add `Message` model:
  ```prisma
  model Message {
    id                 String                @id @default(uuid())
    conversationId     String
    conversation       Conversation          @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    senderUserId       String
    senderUser         User                  @relation(fields: [senderUserId], references: [id], onDelete: Cascade)
    clientMessageId    String
    sequence           Int                   // Monotonic sequence within conversation
    body               String                // Trimmed text (max 2000 chars)
    type               MessageType           @default(TEXT)
    deliveryStatus     MessageDeliveryStatus @default(SENT)
    createdAt          DateTime              @default(now())
    updatedAt          DateTime              @updatedAt

    @@unique([conversationId, clientMessageId])
    @@unique([conversationId, sequence])
    @@index([conversationId, sequence])
    @@index([conversationId, createdAt])
    @@index([senderUserId])
  }
  ```
- Apply migration `20260831190000_add_chat_and_messaging`.

---

### Shared Types & Contracts (`shared/src/types.ts`)

#### [MODIFY] [types.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/shared/src/types.ts)
- Add:
  - `MessageDeliveryStatus`: `'SENT' | 'DELIVERED' | 'READ'`
  - `MessageType`: `'TEXT'`
  - `SafeMessage`: `{ id: string; conversationId: string; senderUserId: string; clientMessageId: string; sequence: number; body: string; type: MessageType; deliveryStatus: MessageDeliveryStatus; createdAt: string; isMine?: boolean }`
  - `SafeConversationSummary`: `{ id: string; matchId: string; matchedProfile: DiscoveryCandidate; lastMessage: SafeMessage | null; unreadCount: number; isMatchActive: boolean; updatedAt: string }`
  - `ConversationsListResponse`: `{ conversations: SafeConversationSummary[]; nextCursor: string | null; hasMore: boolean }`
  - `MessagesListResponse`: `{ messages: SafeMessage[]; nextCursor: string | null; hasMore: boolean }`
  - `SendMessageDto`: `{ clientMessageId: string; body: string }`
  - `ReadReceiptDto`: `{ throughSequence: number }`

---

### Backend Messaging Domain (`backend/src/chat/`)

#### [NEW] [conversations.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/services/conversations.service.ts)
- `getOrCreateConversation(matchId: string, userId: string)`: Ensures 1:1 conversation exists for active match.
- `listConversations(userId: string, query: ConversationsQueryDto)`: Lists paginated conversations with unread count calculation and latest message snippet.
- `getConversationDetail(conversationId: string, userId: string)`: Validates membership and returns conversation with match context.

#### [NEW] [messages.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/services/messages.service.ts)
- `sendMessage(userId: string, conversationId: string, dto: SendMessageDto)`:
  - Validates sender status (`ACTIVE`), recipient status (`ACTIVE`), and match status (`ACTIVE`).
  - Redis rate limiting (max 60 messages/min).
  - Validates message body (1–2000 chars, UTF-8/multilingual).
  - Transactional insert:
    - Checks `clientMessageId` idempotency.
    - Calculates monotonic `sequence = (max(sequence) || 0) + 1`.
    - Inserts `Message`.
    - Updates `Conversation.lastMessageAt` and `lastMessagePreview`.
    - Updates sender's `lastReadSequence = sequence`.
  - Returns `SafeMessage`.
- `getMessagesHistory(userId: string, conversationId: string, query: MessagesQueryDto)`: Cursor-paginated history in chronological sequence.
- `markMessagesRead(userId: string, conversationId: string, throughSequence: number)`: Updates participant's `lastReadSequence` and marks unread messages as `READ`.
- `acknowledgeDelivery(userId: string, conversationId: string, messageId: string, sequence: number)`: Marks message as `DELIVERED`.
- `syncMissedMessages(userId: string, conversationId: string, sinceSequence: number)`: Recovers messages after `sinceSequence`.

#### [NEW] [chat.gateway.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/gateways/chat.gateway.ts)
- WebSocket Gateway handling:
  - Connection JWT authentication using `TokenService`.
  - Room subscription authorization (`conversation:<conversationId>`).
  - Events: `conversation.join`, `conversation.leave`, `message.send`, `message.delivery_ack`, `message.read`, `typing.start`, `typing.stop`, `conversation.sync`.
  - Broadcasting to room members with proper multi-device event routing.

#### [NEW] [conversations.controller.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/conversations.controller.ts)
- REST Endpoints:
  - `GET /api/v1/conversations`
  - `GET /api/v1/conversations/:conversationId`
  - `GET /api/v1/conversations/:conversationId/messages`
  - `POST /api/v1/conversations/:conversationId/messages`
  - `POST /api/v1/conversations/:conversationId/read`

#### [NEW] [chat.module.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/backend/src/chat/chat.module.ts)
- Registers providers, gateway, and controllers; registers in `AppModule`.

---

### Mobile Chat UI & State (`mobile/`)

#### [NEW] [chat-socket.service.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/services/chat-socket.service.ts)
- Socket.IO connection manager with JWT authentication, event emission/subscription, auto-reconnect, and connection state tracking.

#### [NEW] [chat-store.ts](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/src/stores/chat-store.ts)
- Zustand store managing:
  - `conversations: SafeConversationSummary[]`
  - `activeMessages: Record<string, SafeMessage[]>`
  - `typingUsers: Record<string, boolean>`
  - `connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'`
  - Actions: `loadConversations()`, `openConversation(conversationId)`, `sendMessage(conversationId, body)`, `retryMessage(tempId)`, `markAsRead(conversationId)`, `startTyping(conversationId)`, `stopTyping(conversationId)`.

#### [NEW] [conversations.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/conversations.tsx)
- Conversations screen with avatar, name, last message snippet, timestamp, unread badge, pull-to-refresh, and empty state.

#### [NEW] [chat/[conversationId].tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/chat/[conversationId].tsx)
- 1-to-1 Chat screen with:
  - Header with avatar, partner name, back button.
  - Message bubbles (sent vs received) with multiline, Tamil/Unicode, and emoji support.
  - Delivery ticks (✓ Sent, ✓✓ Delivered, ✓✓ Read).
  - Typing indicator animation banner.
  - Multiline message composer with character limit indicator.
  - Reconnect / unmatch state banners.

#### [MODIFY] [matches.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/matches.tsx)
- Enable "Send Message" button on match cards to open `chat/[conversationId]`.

#### [MODIFY] [index.tsx](file:///g:/Godivatech/Products/dating%20app/applicaiton/mobile/app/index.tsx)
- Add "💬 Chat & Messages" navigation CTA.

---

## Verification Plan

### Automated Tests
1. **Unit Tests**:
   - `backend/src/chat/services/conversations.service.spec.ts`:
     - Test conversation listing and lazy creation.
     - Test unread count calculation.
   - `backend/src/chat/services/messages.service.spec.ts`:
     - Test monotonic sequence ordering.
     - Test clientMessageId idempotency.
     - Test delivery and read receipt status transitions.
     - Test rejection on unmatched/suspended accounts.
2. **E2E Tests**:
   - `backend/test/chat.e2e-spec.ts`:
     - Complete REST and WebSocket lifecycle: Connect socket $\rightarrow$ Join room $\rightarrow$ Send message $\rightarrow$ Receive real-time event $\rightarrow$ Send delivery ACK $\rightarrow$ Mark read $\rightarrow$ Sync missed messages.
     - Unmatch race condition test (simultaneous message send during unmatch).
     - Concurrent sends idempotency test.

### Quality & Compilation Verification
- `npm run lint` in `backend/` (0 errors, 0 warnings).
- `npm run build` in `backend/` (compiled successfully).
- `npm test` and `npm run test:e2e` in `backend/` (all tests passing).
- `npm run type-check` in `mobile/` (0 errors).
