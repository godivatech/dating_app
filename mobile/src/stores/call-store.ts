import { create } from 'zustand';
import { callSocket } from '../services/call-socket.service';
import {
  CallType,
  CallEndReason,
  IncomingCallPayload,
  CallConnectedPayload,
  CallEndedNotification,
} from '../../../shared/src/types';

export type CallStateMode = 'IDLE' | 'OUTGOING_RINGING' | 'INCOMING_RINGING' | 'CONNECTED' | 'ENDED';

export interface ActiveCallData {
  callId: string;
  matchId: string;
  partnerUserId: string;
  partnerName: string;
  partnerAvatarUrl: string | null;
  callType: CallType;
  channelName: string;
  agoraToken?: string;
  agoraUid?: number;
}

interface CallStoreState {
  callState: CallStateMode;
  activeCall: ActiveCallData | null;
  durationSeconds: number;
  isMicMuted: boolean;
  isVideoMuted: boolean;
  isSpeakerOn: boolean;
  isCameraFlipped: boolean;
  partnerVideoMuted: boolean;
  partnerAudioMuted: boolean;
  statusMessage: string;
  isInitialized: boolean;

  initCallSocket: () => void;
  startCall: (
    matchId: string,
    receiverUserId: string,
    partnerName: string,
    partnerAvatarUrl: string | null,
    callType?: CallType,
  ) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: (reason?: string) => void;
  hangupCall: () => void;
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => void;
  resetCall: () => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const useCallStore = create<CallStoreState>((set, get) => ({
  callState: 'IDLE',
  activeCall: null,
  durationSeconds: 0,
  isMicMuted: false,
  isVideoMuted: false,
  isSpeakerOn: true,
  isCameraFlipped: false,
  partnerVideoMuted: false,
  partnerAudioMuted: false,
  statusMessage: '',
  isInitialized: false,

  initCallSocket: () => {
    if (get().isInitialized) return;
    callSocket.connect();

    callSocket.onIncomingCall((data: IncomingCallPayload) => {
      set({
        callState: 'INCOMING_RINGING',
        activeCall: {
          callId: data.callId,
          matchId: data.matchId,
          partnerUserId: data.callerUserId,
          partnerName: data.callerName,
          partnerAvatarUrl: data.callerAvatarUrl,
          callType: data.callType,
          channelName: data.channelName,
        },
        durationSeconds: 0,
        statusMessage: `Incoming ${data.callType === CallType.VIDEO ? 'Video' : 'Audio'} Call...`,
      });
    });

    callSocket.onOutgoingCall((data: any) => {
      set((state) => ({
        statusMessage: 'Ringing...',
        activeCall: state.activeCall
          ? {
              ...state.activeCall,
              callId: data.callId,
              channelName: data.channelName,
            }
          : null,
      }));
    });

    callSocket.onCallConnected((data: CallConnectedPayload) => {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        set((state) => ({ durationSeconds: state.durationSeconds + 1 }));
      }, 1000);

      set((state) => ({
        callState: 'CONNECTED',
        statusMessage: 'Connected',
        activeCall: state.activeCall
          ? {
              ...state.activeCall,
              callId: data.callId,
              channelName: data.channelName,
              agoraToken: data.agoraToken,
              agoraUid: data.agoraUid,
              callType: data.callType,
            }
          : null,
      }));
    });

    callSocket.onCallRejected((data: any) => {
      set({
        statusMessage: data.reason || 'Call Declined',
      });
      setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallBusy((data: any) => {
      set({
        statusMessage: data.message || 'User is busy on another call',
      });
      setTimeout(() => {
        get().resetCall();
      }, 2500);
    });

    callSocket.onCallTimeout(() => {
      set({
        statusMessage: 'Call Unanswered (Missed)',
      });
      setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallEnded((data: CallEndedNotification) => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      set({
        callState: 'ENDED',
        statusMessage: `Call Ended (${data.durationSeconds}s)`,
      });
      setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onPartnerMediaChanged((data: any) => {
      set({
        partnerVideoMuted: !!data.videoMuted,
        partnerAudioMuted: !!data.audioMuted,
      });
    });

    set({ isInitialized: true });
  },

  startCall: (matchId, receiverUserId, partnerName, partnerAvatarUrl, callType = CallType.VIDEO) => {
    get().initCallSocket();

    set({
      callState: 'OUTGOING_RINGING',
      durationSeconds: 0,
      statusMessage: 'Calling...',
      activeCall: {
        callId: '',
        matchId,
        partnerUserId: receiverUserId,
        partnerName,
        partnerAvatarUrl,
        callType,
        channelName: '',
      },
    });

    callSocket.initiateCall(matchId, receiverUserId, callType);
  },

  acceptIncomingCall: () => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.callId) return;

    set({ statusMessage: 'Connecting...' });
    callSocket.acceptCall(activeCall.callId);
  },

  rejectIncomingCall: (reason?: string) => {
    const { activeCall } = get();
    if (!activeCall || !activeCall.callId) {
      get().resetCall();
      return;
    }

    callSocket.rejectCall(activeCall.callId, reason);
    get().resetCall();
  },

  hangupCall: () => {
    const { activeCall } = get();
    if (activeCall?.callId) {
      callSocket.endCall(activeCall.callId, CallEndReason.CALLER_HANGUP);
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    get().resetCall();
  },

  toggleMic: () => {
    const next = !get().isMicMuted;
    set({ isMicMuted: next });
    const { activeCall } = get();
    if (activeCall?.callId) {
      callSocket.toggleMedia(activeCall.callId, activeCall.partnerUserId, get().isVideoMuted, next);
    }
  },

  toggleVideo: () => {
    const next = !get().isVideoMuted;
    set({ isVideoMuted: next });
    const { activeCall } = get();
    if (activeCall?.callId) {
      callSocket.toggleMedia(activeCall.callId, activeCall.partnerUserId, next, get().isMicMuted);
    }
  },

  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  flipCamera: () => {
    set((state) => ({ isCameraFlipped: !state.isCameraFlipped }));
  },

  resetCall: () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    set({
      callState: 'IDLE',
      activeCall: null,
      durationSeconds: 0,
      isMicMuted: false,
      isVideoMuted: false,
      isSpeakerOn: true,
      isCameraFlipped: false,
      partnerVideoMuted: false,
      partnerAudioMuted: false,
      statusMessage: '',
    });
  },
}));
