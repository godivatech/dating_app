import { create } from 'zustand';
import { apiClient } from '../services/api-client';
import { chatSocket } from '../services/chat-socket.service';
import {
  SafeConversationSummary,
  SafeMessage,
  ConversationsListResponse,
  MessagesListResponse,
  MessageDeliveryStatus,
  MessageType,
} from '../../../shared/src/types';
import { useAuthStore } from './auth-store';

interface ChatState {
  conversations: SafeConversationSummary[];
  activeConversation: SafeConversationSummary | null;
  messages: Record<string, SafeMessage[]>;
  nextCursor: Record<string, string | null>;
  hasMore: Record<string, boolean>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  typingStatus: Record<string, boolean>;
  isSocketConnected: boolean;
  error: string | null;

  initSocket: () => void;
  fetchConversations: () => Promise<void>;
  createOrGetConversationByMatchId: (matchId: string) => Promise<string>;
  openConversation: (conversationId: string) => Promise<void>;
  closeConversation: (conversationId: string) => void;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {},
  nextCursor: {},
  hasMore: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  typingStatus: {},
  isSocketConnected: false,
  error: null,

  initSocket: () => {
    chatSocket.connect();

    chatSocket.onConnectionChange((connected) => {
      set({ isSocketConnected: connected });
    });

    chatSocket.onMessageCreated(({ conversationId, message }) => {
      const myUserId = useAuthStore.getState().user?.id;
      const isMine = myUserId ? message.senderUserId === myUserId : message.senderUserId === 'me';
      const normalizedMessage: SafeMessage = {
        ...message,
        isMine,
      };

      const currentMessages = get().messages[conversationId] || [];
      // Deduplicate by id or clientMessageId
      const exists = currentMessages.some(
        (m) => m.id === normalizedMessage.id || m.clientMessageId === normalizedMessage.clientMessageId,
      );

      let updatedMessages = currentMessages;
      if (exists) {
        updatedMessages = currentMessages.map((m) =>
          m.clientMessageId === normalizedMessage.clientMessageId || m.id === normalizedMessage.id
            ? normalizedMessage
            : m,
        );
      } else {
        updatedMessages = [...currentMessages, normalizedMessage].sort(
          (a, b) => a.sequence - b.sequence,
        );
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: normalizedMessage,
                unreadCount:
                  state.activeConversation?.id === conversationId || isMine
                    ? c.unreadCount
                    : c.unreadCount + 1,
                updatedAt: normalizedMessage.createdAt,
              }
            : c,
        ),
      }));

      // Send delivery ACK if not sent by me
      if (!isMine) {
        chatSocket.sendDeliveryAck(conversationId, normalizedMessage.id, normalizedMessage.sequence);
        // If active conversation, auto mark read
        if (get().activeConversation?.id === conversationId) {
          get().markAsRead(conversationId);
        }
      }
    });

    chatSocket.onMessageDelivered(({ conversationId, messageId }) => {
      const convMsgs = get().messages[conversationId] || [];
      const updated = convMsgs.map((m) =>
        m.id === messageId && m.deliveryStatus === MessageDeliveryStatus.SENT
          ? { ...m, deliveryStatus: MessageDeliveryStatus.DELIVERED }
          : m,
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
      }));
    });

    chatSocket.onMessageRead(({ conversationId, throughSequence }) => {
      const convMsgs = get().messages[conversationId] || [];
      const updated = convMsgs.map((m) =>
        m.sequence <= throughSequence && m.deliveryStatus !== MessageDeliveryStatus.READ
          ? { ...m, deliveryStatus: MessageDeliveryStatus.READ }
          : m,
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: updated,
        },
      }));
    });

    chatSocket.onTypingStart(({ conversationId }) => {
      set((state) => ({
        typingStatus: { ...state.typingStatus, [conversationId]: true },
      }));
    });

    chatSocket.onTypingStop(({ conversationId }) => {
      set((state) => ({
        typingStatus: { ...state.typingStatus, [conversationId]: false },
      }));
    });

    chatSocket.onSyncResponse(({ conversationId, messages }) => {
      if (!messages || messages.length === 0) return;
      const current = get().messages[conversationId] || [];
      const map = new Map<string, SafeMessage>();
      current.forEach((m) => map.set(m.id, m));
      messages.forEach((m) => map.set(m.id, m));

      const merged = Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: merged,
        },
      }));
    });

    chatSocket.onError(({ clientMessageId, message }) => {
      set({ isSending: false, error: message });
      if (clientMessageId) {
        // Rollback optimistic message
        set((state) => {
          const updatedMessages: Record<string, SafeMessage[]> = {};
          for (const [convId, msgs] of Object.entries(state.messages)) {
            updatedMessages[convId] = msgs.filter(
              (m) => m.clientMessageId !== clientMessageId,
            );
          }
          return { messages: updatedMessages };
        });
      }
    });
  },

  fetchConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const res = await apiClient.get<ConversationsListResponse>('/conversations');
      set({
        conversations: res.data.conversations,
        isLoadingConversations: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to load conversations.',
        isLoadingConversations: false,
      });
    }
  },

  createOrGetConversationByMatchId: async (matchId: string) => {
    try {
      const res = await apiClient.post<SafeConversationSummary>(
        `/conversations/matches/${matchId}`,
      );
      // Add or update in list
      set((state) => ({
        conversations: [
          res.data,
          ...state.conversations.filter((c) => c.id !== res.data.id),
        ],
      }));
      return res.data.id;
    } catch (err: any) {
      throw new Error(
        err.response?.data?.message || 'Failed to open conversation.',
      );
    }
  },

  openConversation: async (conversationId: string) => {
    set({ isLoadingMessages: true, error: null });
    chatSocket.joinConversation(conversationId);

    try {
      // 1. Fetch conversation detail
      const detailRes = await apiClient.get<SafeConversationSummary>(
        `/conversations/${conversationId}`,
      );

      // 2. Fetch recent messages
      const msgsRes = await apiClient.get<MessagesListResponse>(
        `/conversations/${conversationId}/messages`,
      );

      const myUserId = useAuthStore.getState().user?.id;
      const normalizedMessages = (msgsRes.data.messages || []).map((m) => ({
        ...m,
        isMine: myUserId ? m.senderUserId === myUserId : m.senderUserId === 'me',
      }));

      set((state) => ({
        activeConversation: detailRes.data,
        messages: {
          ...state.messages,
          [conversationId]: normalizedMessages,
        },
        hasMore: {
          ...state.hasMore,
          [conversationId]: msgsRes.data.hasMore,
        },
        nextCursor: {
          ...state.nextCursor,
          [conversationId]: msgsRes.data.nextCursor,
        },
        isLoadingMessages: false,
      }));

      // Mark read
      get().markAsRead(conversationId);
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to load chat history.',
        isLoadingMessages: false,
      });
    }
  },

  closeConversation: (conversationId: string) => {
    chatSocket.leaveConversation(conversationId);
    set({ activeConversation: null });
  },

  loadOlderMessages: async (conversationId: string) => {
    const cursor = get().nextCursor[conversationId];
    const hasMore = get().hasMore[conversationId];
    if (!cursor || !hasMore || get().isLoadingMessages) return;

    try {
      const res = await apiClient.get<MessagesListResponse>(
        `/conversations/${conversationId}/messages`,
        { params: { cursor } },
      );

      const myUserId = useAuthStore.getState().user?.id;
      const normalizedOlder = (res.data.messages || []).map((m) => ({
        ...m,
        isMine: myUserId ? m.senderUserId === myUserId : m.senderUserId === 'me',
      }));

      const existing = get().messages[conversationId] || [];
      const merged = [...normalizedOlder, ...existing].sort(
        (a, b) => a.sequence - b.sequence,
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: merged,
        },
        hasMore: {
          ...state.hasMore,
          [conversationId]: res.data.hasMore,
        },
        nextCursor: {
          ...state.nextCursor,
          [conversationId]: res.data.nextCursor,
        },
      }));
    } catch (_err) {
      // Non-blocking history pagination failure
    }
  },

  sendMessage: async (conversationId: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed || get().isSending) return;

    set({ isSending: true, error: null });
    const clientMessageId = `msg-cli-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const currentUserId = useAuthStore.getState().user?.id || 'me';

    // Optimistic message representation
    const optimisticSeq =
      ((get().messages[conversationId] || []).slice(-1)[0]?.sequence || 0) + 1;

    const optimisticMsg: SafeMessage = {
      id: `temp-${clientMessageId}`,
      conversationId,
      senderUserId: currentUserId,
      clientMessageId,
      sequence: optimisticSeq,
      body: trimmed,
      type: MessageType.TEXT,
      deliveryStatus: MessageDeliveryStatus.SENT,
      createdAt: new Date().toISOString(),
      isMine: true,
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          optimisticMsg,
        ],
      },
    }));

    try {
      if (chatSocket.isConnected()) {
        chatSocket.sendMessage(conversationId, clientMessageId, trimmed);
      } else {
        // REST Fallback
        const res = await apiClient.post<SafeMessage>(
          `/conversations/${conversationId}/messages`,
          { clientMessageId, body: trimmed },
        );

        const current = get().messages[conversationId] || [];
        const replaced = current.map((m) =>
          m.clientMessageId === clientMessageId ? res.data : m,
        );

        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: replaced,
          },
        }));
      }
      set({ isSending: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to send message.',
        isSending: false,
      });
    }
  },

  markAsRead: async (conversationId: string) => {
    const msgs = get().messages[conversationId] || [];
    const maxSeq = msgs.reduce((max, m) => Math.max(max, m.sequence), 0);
    if (maxSeq === 0) return;

    // Reset unread count locally
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    }));

    if (chatSocket.isConnected()) {
      chatSocket.sendReadReceipt(conversationId, maxSeq);
    } else {
      try {
        await apiClient.post(`/conversations/${conversationId}/read`, {
          throughSequence: maxSeq,
        });
      } catch (_err) {}
    }
  },

  startTyping: (conversationId: string) => {
    chatSocket.startTyping(conversationId);
  },

  stopTyping: (conversationId: string) => {
    chatSocket.stopTyping(conversationId);
  },
}));
