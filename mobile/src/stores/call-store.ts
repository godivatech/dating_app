import { create } from 'zustand';
import { callSocket } from '../services/call-socket.service';
import { agoraRtcService } from '../services/rtc/agora-rtc.service';
import { requestCallingPermissions } from '../utils/call-permissions';
import {
  CallType,
  CallEndReason,
  IncomingCallPayload,
  CallConnectedPayload,
  CallEndedNotification,
} from '../../../shared/src/types';
import { useBillingStore } from './billing-store';

export type CallStateMode = 'IDLE' | 'OUTGOING_RINGING' | 'INCOMING_RINGING' | 'CONNECTED' | 'ENDED';

export interface ActiveCallData {
  callId: string;
  matchId: string;
  partnerUserId: string;
  partnerName: string;
  partnerAvatarUrl: string | null;
  callType: CallType;
  channelName: string;
  rtcToken?: string;
  rtcUid?: number;
  agoraToken?: string;
  agoraUid?: number;
  partnerAgoraUid?: number;
  isVibeCheck?: boolean;
  maxDurationSeconds?: number;
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
  hangupCall: (reason?: CallEndReason) => void;
  toggleMic: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  flipCamera: () => void;
  resetCall: () => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let resetTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingCancelledMatchId: string | null = null;

const clearPendingResetTimeout = () => {
  if (resetTimeout) {
    clearTimeout(resetTimeout);
    resetTimeout = null;
  }
};

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
      clearPendingResetTimeout();
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
          isVibeCheck: data.isVibeCheck,
          maxDurationSeconds: data.maxDurationSeconds,
        },
        durationSeconds: 0,
        statusMessage: `Incoming ${data.callType === CallType.VIDEO ? 'Video' : 'Audio'} Call...`,
      });
    });

    callSocket.onOutgoingCall((data: any) => {
      clearPendingResetTimeout();
      if (pendingCancelledMatchId && (data.matchId === pendingCancelledMatchId || !pendingCancelledMatchId) && data.callId) {
        console.log('[CALL_STORE] User hung up before callId was assigned; ending call now:', data.callId);
        callSocket.endCall(data.callId, CallEndReason.CALLER_HANGUP);
        pendingCancelledMatchId = null;
        get().resetCall();
        return;
      }

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

    callSocket.onCallConnected(async (data: CallConnectedPayload) => {
      clearPendingResetTimeout();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const nextSecs = get().durationSeconds + 1;
        set({ durationSeconds: nextSecs });

        const currentActive = get().activeCall;
        const maxLimit =
          currentActive?.maxDurationSeconds ||
          (currentActive?.isVibeCheck ? 60 : 3600);

        if (currentActive?.isVibeCheck && nextSecs >= maxLimit) {
          console.log(
            '[CALL_STORE] Vibe check limit reached. Auto-hanging up with VIBE_CHECK_COMPLETE.',
          );
          get().hangupCall(CallEndReason.VIBE_CHECK_COMPLETE);
        }
      }, 1000);

      const isVideo = data.callType === CallType.VIDEO;
      const myUid = data.rtcUid || data.agoraUid;
      const partnerUid = myUid === 1001 ? 2002 : 1001;
      const token = data.rtcToken || data.agoraToken;

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
              rtcToken: token,
              rtcUid: myUid,
              partnerAgoraUid: partnerUid,
              callType: data.callType,
              isVibeCheck: data.isVibeCheck ?? state.activeCall.isVibeCheck,
              maxDurationSeconds:
                data.maxDurationSeconds ?? state.activeCall.maxDurationSeconds,
            }
          : null,
      }));

      // Initialize and join the live Agora media channel
      try {
        const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '07f3de63ed2c431c9e7c40cd26b1c91b';
        if (appId) {
          await agoraRtcService.init(appId);
          await agoraRtcService.joinChannel({
            channelName: data.channelName,
            token,
            uid: myUid,
            isVideo,
          });
        }
      } catch (err: any) {
        console.warn('[CALL_STORE] Failed to initialize Agora RTC channel:', err?.message);
      }
    });

    callSocket.onCallRejected((data: any) => {
      clearPendingResetTimeout();
      set({
        statusMessage: data.reason || 'Call Declined',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallBusy((data: any) => {
      clearPendingResetTimeout();
      set({
        statusMessage: data.message || 'User is busy on another call',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2500);
    });

    callSocket.onCallError((data: { message: string }) => {
      clearPendingResetTimeout();
      set({
        statusMessage: data.message || 'Call failed. Please try again.',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2500);
    });

    callSocket.onCallTimeout(() => {
      clearPendingResetTimeout();
      set({
        statusMessage: 'Call Unanswered (Missed)',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallEnded((data: CallEndedNotification) => {
      clearPendingResetTimeout();
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      const isVibeComplete = data.reason === CallEndReason.VIBE_CHECK_COMPLETE;
      set({
        callState: 'ENDED',
        statusMessage: isVibeComplete
          ? '1-Minute Vibe Check Complete! ✨'
          : `Call Ended (${data.durationSeconds}s)`,
      });
      if (isVibeComplete) {
        useBillingStore.getState().openPaywall('CALL');
      }
      useBillingStore.getState().fetchCreditBalance();
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 1500);
    });

    callSocket.onPartnerMediaChanged((data: any) => {
      set({
        partnerVideoMuted: !!data.videoMuted,
        partnerAudioMuted: !!data.audioMuted,
      });
    });

    // Automatically sync speaker state with native audio route (e.g. Bluetooth headset or loudspeaker)
    agoraRtcService.onAudioRoutingChanged((routing: number) => {
      // 3 = Built-in speaker; 5 = Bluetooth headset; 0/2 = Wired headset; 1 = Earpiece
      set({ isSpeakerOn: routing === 3 });
    });

    // Auto-terminate call when remote partner disconnects or kills the app
    agoraRtcService.onUserOffline((remoteUid: number) => {
      const { activeCall, callState } = get();
      if (callState === 'CONNECTED' && activeCall) {
        console.log(`[CALL_STORE] Remote partner ${remoteUid} went offline in Agora.`);
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        set({
          callState: 'ENDED',
          statusMessage: 'Partner Disconnected',
        });
        if (activeCall.callId) {
          callSocket.endCall(activeCall.callId, CallEndReason.NETWORK_FAILURE);
        }
        clearPendingResetTimeout();
        resetTimeout = setTimeout(() => {
          get().resetCall();
        }, 1500);
      }
    });

    // Handle unexpected RTC connection failure
    agoraRtcService.onConnectionStateChanged((state: string) => {
      if (state === '5') {
        const { activeCall, callState } = get();
        if (callState === 'CONNECTED' && activeCall) {
          console.warn('[CALL_STORE] Agora connection failed unexpectedly.');
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
          set({
            callState: 'ENDED',
            statusMessage: 'Connection Lost',
          });
          clearPendingResetTimeout();
          resetTimeout = setTimeout(() => {
            get().resetCall();
          }, 1500);
        }
      }
    });

    set({ isInitialized: true });
  },

  startCall: async (matchId, receiverUserId, partnerName, partnerAvatarUrl, callType = CallType.VIDEO) => {
    clearPendingResetTimeout();
    pendingCancelledMatchId = null;
    get().initCallSocket();

    // Ensure socket is actively connected before initiating
    await callSocket.ensureConnected(4000);

    const granted = await requestCallingPermissions(callType === CallType.VIDEO);
    if (!granted) return;

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

  acceptIncomingCall: async () => {
    clearPendingResetTimeout();
    const { activeCall } = get();
    if (!activeCall || !activeCall.callId) return;

    const granted = await requestCallingPermissions(activeCall.callType === CallType.VIDEO);
    if (!granted) return;

    set({ statusMessage: 'Connecting...' });
    callSocket.acceptCall(activeCall.callId);
  },

  rejectIncomingCall: (reason?: string) => {
    clearPendingResetTimeout();
    const { activeCall } = get();
    if (!activeCall || !activeCall.callId) {
      get().resetCall();
      return;
    }

    callSocket.rejectCall(activeCall.callId, reason);
    get().resetCall();
  },

  hangupCall: (reason: CallEndReason = CallEndReason.CALLER_HANGUP) => {
    clearPendingResetTimeout();
    const { activeCall, callState } = get();
    if (activeCall?.callId) {
      callSocket.endCall(activeCall.callId, reason);
    } else if (callState === 'OUTGOING_RINGING' && activeCall?.matchId) {
      // User cancelled before callId arrived from backend
      pendingCancelledMatchId = activeCall.matchId;
    }
    agoraRtcService.leaveChannel();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    useBillingStore.getState().fetchCreditBalance();
    if (reason === CallEndReason.VIBE_CHECK_COMPLETE) {
      set({
        callState: 'ENDED',
        statusMessage: '1-Minute Vibe Check Complete! ✨',
      });
      useBillingStore.getState().openPaywall('CALL');
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 1500);
    } else {
      get().resetCall();
    }
  },

  toggleMic: () => {
    const next = !get().isMicMuted;
    set({ isMicMuted: next });
    agoraRtcService.toggleMic(next);
    const { activeCall } = get();
    if (activeCall?.callId) {
      callSocket.toggleMedia(activeCall.callId, activeCall.partnerUserId, get().isVideoMuted, next);
    }
  },

  toggleVideo: () => {
    const next = !get().isVideoMuted;
    set({ isVideoMuted: next });
    agoraRtcService.toggleVideo(next);
    const { activeCall } = get();
    if (activeCall?.callId) {
      callSocket.toggleMedia(activeCall.callId, activeCall.partnerUserId, next, get().isMicMuted);
    }
  },

  toggleSpeaker: () => {
    const next = !get().isSpeakerOn;
    set({ isSpeakerOn: next });
    agoraRtcService.toggleSpeaker(next);
  },

  flipCamera: () => {
    set((state) => ({ isCameraFlipped: !state.isCameraFlipped }));
    agoraRtcService.flipCamera();
  },

  resetCall: () => {
    clearPendingResetTimeout();
    agoraRtcService.leaveChannel();
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
