import { io, Socket } from 'socket.io-client';
import { SecureStorage } from './secure-storage';
import { API_BASE_URL } from './api-client';
import {
  CallType,
  CallEndReason,
  IncomingCallPayload,
  CallConnectedPayload,
  CallEndedNotification,
  CallBusyNotification,
} from '../../../shared/src/types';

export class CallSocketService {
  private static instance: CallSocketService;
  private socket: Socket | null = null;
  private isConnecting = false;

  private incomingCallListeners: Set<(payload: IncomingCallPayload) => void> = new Set();
  private outgoingCallListeners: Set<(payload: any) => void> = new Set();
  private callConnectedListeners: Set<(payload: CallConnectedPayload) => void> = new Set();
  private callEndedListeners: Set<(payload: CallEndedNotification) => void> = new Set();
  private callRejectedListeners: Set<(payload: any) => void> = new Set();
  private callTimeoutListeners: Set<(payload: { callId: string }) => void> = new Set();
  private callBusyListeners: Set<(payload: CallBusyNotification) => void> = new Set();
  private partnerMediaListeners: Set<(payload: { videoMuted?: boolean; audioMuted?: boolean }) => void> = new Set();

  private constructor() {}

  static getInstance(): CallSocketService {
    if (!CallSocketService.instance) {
      CallSocketService.instance = new CallSocketService();
    }
    return CallSocketService.instance;
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

    this.socket = io(`${host}/call`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
    });

    this.socket.on('call:incoming', (data: IncomingCallPayload) => {
      this.incomingCallListeners.forEach((l) => l(data));
    });

    this.socket.on('call:outgoing', (data: any) => {
      this.outgoingCallListeners.forEach((l) => l(data));
    });

    this.socket.on('call:connected', (data: CallConnectedPayload) => {
      this.callConnectedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:rejected', (data: any) => {
      this.callRejectedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:ended', (data: CallEndedNotification) => {
      this.callEndedListeners.forEach((l) => l(data));
    });

    this.socket.on('call:timeout', (data: { callId: string }) => {
      this.callTimeoutListeners.forEach((l) => l(data));
    });

    this.socket.on('call:busy', (data: CallBusyNotification) => {
      this.callBusyListeners.forEach((l) => l(data));
    });

    this.socket.on('call:partner_media_changed', (data: any) => {
      this.partnerMediaListeners.forEach((l) => l(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  initiateCall(matchId: string, receiverUserId: string, callType: CallType = CallType.VIDEO): void {
    this.socket?.emit('call:initiate', { matchId, receiverUserId, callType });
  }

  acceptCall(callId: string): void {
    this.socket?.emit('call:accept', { callId });
  }

  rejectCall(callId: string, reason?: string): void {
    this.socket?.emit('call:reject', { callId, reason });
  }

  endCall(callId: string, reason?: CallEndReason): void {
    this.socket?.emit('call:end', { callId, reason });
  }

  toggleMedia(callId: string, partnerUserId: string, videoMuted?: boolean, audioMuted?: boolean): void {
    this.socket?.emit('call:toggle_media', { callId, partnerUserId, videoMuted, audioMuted });
  }

  onIncomingCall(fn: (data: IncomingCallPayload) => void): () => void {
    this.incomingCallListeners.add(fn);
    return () => this.incomingCallListeners.delete(fn);
  }

  onOutgoingCall(fn: (data: any) => void): () => void {
    this.outgoingCallListeners.add(fn);
    return () => this.outgoingCallListeners.delete(fn);
  }

  onCallConnected(fn: (data: CallConnectedPayload) => void): () => void {
    this.callConnectedListeners.add(fn);
    return () => this.callConnectedListeners.delete(fn);
  }

  onCallEnded(fn: (data: CallEndedNotification) => void): () => void {
    this.callEndedListeners.add(fn);
    return () => this.callEndedListeners.delete(fn);
  }

  onCallRejected(fn: (data: any) => void): () => void {
    this.callRejectedListeners.add(fn);
    return () => this.callRejectedListeners.delete(fn);
  }

  onCallTimeout(fn: (data: { callId: string }) => void): () => void {
    this.callTimeoutListeners.add(fn);
    return () => this.callTimeoutListeners.delete(fn);
  }

  onCallBusy(fn: (data: CallBusyNotification) => void): () => void {
    this.callBusyListeners.add(fn);
    return () => this.callBusyListeners.delete(fn);
  }

  onPartnerMediaChanged(fn: (data: { videoMuted?: boolean; audioMuted?: boolean }) => void): () => void {
    this.partnerMediaListeners.add(fn);
    return () => this.partnerMediaListeners.delete(fn);
  }
}

export const callSocket = CallSocketService.getInstance();
