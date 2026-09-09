import { io, Socket } from 'socket.io-client';
import { SecureStorage } from './secure-storage';
import { API_BASE_URL } from './api-client';
import { SafeMessage } from '../../../shared/src/types';

export class ChatSocketService {
  private static instance: ChatSocketService;
  private socket: Socket | null = null;
  private isConnecting = false;

  private messageCreatedListeners: Set<(data: { conversationId: string; message: SafeMessage }) => void> = new Set();
  private messageDeliveredListeners: Set<(data: { conversationId: string; messageId: string; sequence: number }) => void> = new Set();
  private messageReadListeners: Set<(data: { conversationId: string; userId: string; throughSequence: number }) => void> = new Set();
  private typingStartListeners: Set<(data: { conversationId: string; userId: string }) => void> = new Set();
  private typingStopListeners: Set<(data: { conversationId: string; userId: string }) => void> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private syncResponseListeners: Set<(data: { conversationId: string; messages: SafeMessage[] }) => void> = new Set();
  private errorListeners: Set<(err: { event?: string; clientMessageId?: string; message: string }) => void> = new Set();
  private likeReceivedListeners: Set<(data: { hasNote: boolean; note?: string; actorDisplayName: string; actorProfileId: string }) => void> = new Set();
  private matchFormedListeners: Set<(data: { match: any; matchedUser: { displayName: string; profileId: string; photoUrl: string | null } }) => void> = new Set();
  private presenceListeners: Set<(data: { userId: string; isOnline: boolean; lastSeen?: string }) => void> = new Set();
  private presenceResultListeners: Set<(data: { userId: string; isOnline: boolean; lastSeen?: string }) => void> = new Set();

  private constructor() {}

  static getInstance(): ChatSocketService {
    if (!ChatSocketService.instance) {
      ChatSocketService.instance = new ChatSocketService();
    }
    return ChatSocketService.instance;
  }

  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) return;

    this.isConnecting = true;
    const token = await SecureStorage.getAccessToken();
    if (!token) {
      this.isConnecting = false;
      return;
    }

    const host = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

    this.socket = io(`${host}/chat`, {
      auth: async (cb) => {
        try {
          const freshToken = await SecureStorage.getAccessToken();
          cb({ token: freshToken ? `Bearer ${freshToken}` : '' });
        } catch {
          cb({ token: '' });
        }
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.notifyConnection(true);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      this.notifyConnection(false);
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          this.reconnect();
        }, 1500);
      }
    });

    this.socket.on('connect_error', () => {
      this.isConnecting = false;
      this.notifyConnection(false);
    });

    this.socket.on('message.created', (data: { conversationId: string; message: SafeMessage }) => {
      this.messageCreatedListeners.forEach((listener) => listener(data));
    });

    this.socket.on('message.delivered', (data: { conversationId: string; messageId: string; sequence: number }) => {
      this.messageDeliveredListeners.forEach((listener) => listener(data));
    });

    this.socket.on('message.read', (data: { conversationId: string; userId: string; throughSequence: number }) => {
      this.messageReadListeners.forEach((listener) => listener(data));
    });

    this.socket.on('typing.start', (data: { conversationId: string; userId: string }) => {
      this.typingStartListeners.forEach((listener) => listener(data));
    });

    this.socket.on('typing.stop', (data: { conversationId: string; userId: string }) => {
      this.typingStopListeners.forEach((listener) => listener(data));
    });

    this.socket.on('conversation.sync_response', (data: { conversationId: string; messages: SafeMessage[] }) => {
      this.syncResponseListeners.forEach((listener) => listener(data));
    });

    this.socket.on('error', (err: { event?: string; clientMessageId?: string; message: string }) => {
      this.errorListeners.forEach((listener) => listener(err));
    });

    this.socket.on('like.received', (data: { hasNote: boolean; note?: string; actorDisplayName: string; actorProfileId: string }) => {
      this.likeReceivedListeners.forEach((listener) => listener(data));
    });

    this.socket.on('match.formed', (data: { match: any; matchedUser: { displayName: string; profileId: string; photoUrl: string | null } }) => {
      this.matchFormedListeners.forEach((listener) => listener(data));
    });

    this.socket.on('user.presence', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      this.presenceListeners.forEach((listener) => listener(data));
    });

    this.socket.on('presence.result', (data: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      this.presenceResultListeners.forEach((listener) => listener(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.notifyConnection(false);
  }

  async reconnect(): Promise<void> {
    if (this.socket) {
      try {
        const token = await SecureStorage.getAccessToken();
        if (token) {
          (this.socket as any).auth = { token: `Bearer ${token}` };
        }
      } catch {}
      this.socket.connect();
    } else {
      await this.connect();
    }
  }

  async ensureConnected(timeoutMs = 5000): Promise<boolean> {
    if (this.socket?.connected) return true;

    this.connect();

    return new Promise((resolve) => {
      if (this.socket?.connected) {
        return resolve(true);
      }

      const timer = setTimeout(() => {
        cleanup();
        resolve(!!this.socket?.connected);
      }, timeoutMs);

      const onConnect = () => {
        cleanup();
        resolve(true);
      };

      const onError = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.socket?.off('connect', onConnect);
        this.socket?.off('connect_error', onError);
      };

      this.socket?.once('connect', onConnect);
      this.socket?.once('connect_error', onError);
    });
  }

  joinConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation.join', { conversationId });
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation.leave', { conversationId });
    }
  }

  sendMessage(conversationId: string, clientMessageId: string, body: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message.send', {
        conversationId,
        clientMessageId,
        body,
      });
    }
  }

  sendDeliveryAck(conversationId: string, messageId: string, sequence: number): void {
    if (this.socket?.connected) {
      this.socket.emit('message.delivery_ack', {
        conversationId,
        messageId,
        sequence,
      });
    }
  }

  sendReadReceipt(conversationId: string, throughSequence: number): void {
    if (this.socket?.connected) {
      this.socket.emit('message.read', {
        conversationId,
        throughSequence,
      });
    }
  }

  startTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing.start', { conversationId });
    }
  }

  stopTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing.stop', { conversationId });
    }
  }

  sync(conversationId: string, sinceSequence: number): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation.sync', { conversationId, sinceSequence });
    }
  }

  onMessageCreated(fn: (data: { conversationId: string; message: SafeMessage }) => void): () => void {
    this.messageCreatedListeners.add(fn);
    return () => this.messageCreatedListeners.delete(fn);
  }

  onMessageDelivered(fn: (data: { conversationId: string; messageId: string; sequence: number }) => void): () => void {
    this.messageDeliveredListeners.add(fn);
    return () => this.messageDeliveredListeners.delete(fn);
  }

  onMessageRead(fn: (data: { conversationId: string; userId: string; throughSequence: number }) => void): () => void {
    this.messageReadListeners.add(fn);
    return () => this.messageReadListeners.delete(fn);
  }

  onTypingStart(fn: (data: { conversationId: string; userId: string }) => void): () => void {
    this.typingStartListeners.add(fn);
    return () => this.typingStartListeners.delete(fn);
  }

  onTypingStop(fn: (data: { conversationId: string; userId: string }) => void): () => void {
    this.typingStopListeners.add(fn);
    return () => this.typingStopListeners.delete(fn);
  }

  onConnectionChange(fn: (connected: boolean) => void): () => void {
    this.connectionListeners.add(fn);
    return () => this.connectionListeners.delete(fn);
  }

  onSyncResponse(fn: (data: { conversationId: string; messages: SafeMessage[] }) => void): () => void {
    this.syncResponseListeners.add(fn);
    return () => this.syncResponseListeners.delete(fn);
  }

  onError(fn: (err: { event?: string; clientMessageId?: string; message: string }) => void): () => void {
    this.errorListeners.add(fn);
    return () => this.errorListeners.delete(fn);
  }

  onLikeReceived(fn: (data: { hasNote: boolean; note?: string; actorDisplayName: string; actorProfileId: string }) => void): () => void {
    this.likeReceivedListeners.add(fn);
    return () => this.likeReceivedListeners.delete(fn);
  }

  onMatchFormed(fn: (data: { match: any; matchedUser: { displayName: string; profileId: string; photoUrl: string | null } }) => void): () => void {
    this.matchFormedListeners.add(fn);
    return () => this.matchFormedListeners.delete(fn);
  }

  onPresenceChange(fn: (data: { userId: string; isOnline: boolean; lastSeen?: string }) => void): () => void {
    this.presenceListeners.add(fn);
    return () => this.presenceListeners.delete(fn);
  }

  onPresenceResult(fn: (data: { userId: string; isOnline: boolean; lastSeen?: string }) => void): () => void {
    this.presenceResultListeners.add(fn);
    return () => this.presenceResultListeners.delete(fn);
  }

  queryPresence(targetUserId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('presence.query', { targetUserId });
    }
  }

  private notifyConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

export const chatSocket = ChatSocketService.getInstance();
