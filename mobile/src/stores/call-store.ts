import { create } from 'zustand';
import { callSocket } from '../services/call-socket.service';
import { agoraRtcService, AppAudioRoute } from '../services/rtc/agora-rtc.service';
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
  currentAudioRoute: AppAudioRoute;
  connectedExternalDevice: 'BLUETOOTH' | 'HEADSET' | null;
  bluetoothDeviceName: string | null;
  headsetDeviceName: string | null;
  isCameraFlipped: boolean;
  partnerVideoMuted: boolean;
  partnerAudioMuted: boolean;
  statusMessage: string;
  isInitialized: boolean;

  initCallSocket: () => void;
  handleIncomingCallPayload: (payload: IncomingCallPayload) => void;
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
  setAudioRoute: (route: AppAudioRoute) => Promise<void>;
  detectAudioDevices: () => void;
  flipCamera: () => void;
  resetCall: () => void;
}

let timerInterval: ReturnType<typeof setInterval> | null = null;
let resetTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingCancelledMatchId: string | null = null;
let userExplicitlySelectedRoute = false;
let userSelectedRoute: AppAudioRoute | null = null;

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
  currentAudioRoute: 'SPEAKER',
  connectedExternalDevice: null,
  bluetoothDeviceName: null,
  headsetDeviceName: null,
  isCameraFlipped: false,
  partnerVideoMuted: false,
  partnerAudioMuted: false,
  statusMessage: '',
  isInitialized: false,

  handleIncomingCallPayload: (data: IncomingCallPayload) => {
    clearPendingResetTimeout();
    userExplicitlySelectedRoute = false;
    userSelectedRoute = null;
    get().initCallSocket();

    const isVideo = data.callType === CallType.VIDEO;
    const initialRoute: AppAudioRoute = isVideo ? 'SPEAKER' : 'EARPIECE';

    // Initialize Agora & detect connected devices early for incoming call
    const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '07f3de63ed2c431c9e7c40cd26b1c91b';
    agoraRtcService.init(appId).then(() => {
      get().detectAudioDevices();
      if (isVideo) {
        agoraRtcService.setDefaultRoute(true);
      } else {
        agoraRtcService.setDefaultRoute(false);
      }
      agoraRtcService.playRingtone('incoming');
    }).catch(() => { });

    set({
      callState: 'INCOMING_RINGING',
      currentAudioRoute: initialRoute,
      isSpeakerOn: initialRoute === 'SPEAKER',
      activeCall: {
        callId: data.callId,
        matchId: data.matchId,
        partnerUserId: data.callerUserId,
        partnerName: data.callerName,
        partnerAvatarUrl: data.callerAvatarUrl || null,
        callType: data.callType,
        channelName: data.channelName,
        isVibeCheck: data.isVibeCheck,
        maxDurationSeconds: data.maxDurationSeconds,
      },
      durationSeconds: 0,
      statusMessage: `Incoming ${data.callType === CallType.VIDEO ? 'Video' : 'Audio'} Call...`,
    });
  },

  initCallSocket: () => {
    if (get().isInitialized) return;
    callSocket.connect();

    callSocket.onIncomingCall((data: IncomingCallPayload) => {
      get().handleIncomingCallPayload(data);
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
      // Instantly stop outgoing ringback tone or incoming ringtone
      await agoraRtcService.stopRingtone();

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

      // Query connected audio devices before establishing audio route
      get().detectAudioDevices();
      const extDevice = get().connectedExternalDevice;

      // Respect user's explicit selection if already made during ringing, or determine sensible target
      let targetAudioRoute: AppAudioRoute = 'EARPIECE';
      if (userExplicitlySelectedRoute && userSelectedRoute) {
        targetAudioRoute = userSelectedRoute;
        console.log(`[AUDIO_ROUTE] Preserving user-selected route across connect: ${targetAudioRoute}`);
      } else if (isVideo) {
        targetAudioRoute = 'SPEAKER';
      } else if (extDevice === 'BLUETOOTH') {
        targetAudioRoute = 'BLUETOOTH';
      } else if (extDevice === 'HEADSET') {
        targetAudioRoute = 'HEADSET';
      } else {
        targetAudioRoute = 'EARPIECE';
      }

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
          await agoraRtcService.setAudioRoute(targetAudioRoute);
          await agoraRtcService.joinChannel({
            channelName: data.channelName,
            token,
            uid: myUid,
            isVideo,
          });

          // Schedule automated diagnostic sequence during active call to inspect real Android routing behavior
          setTimeout(() => {
            if (get().callState === 'CONNECTED') {
              agoraRtcService.runDiagnosticSequence().catch((e) => {
                console.warn('[AUDIO_DIAGNOSTICS] Error in diagnostic sequence:', e);
              });
            }
          }, 3500);
        }
      } catch (err: any) {
        console.warn('[CALL_STORE] Failed to initialize Agora RTC channel:', err?.message);
      }
    });

    callSocket.onCallRejected((data: any) => {
      clearPendingResetTimeout();
      agoraRtcService.stopRingtone();
      set({
        statusMessage: data.reason || 'Call Declined',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallBusy((data: any) => {
      clearPendingResetTimeout();
      agoraRtcService.stopRingtone();
      set({
        statusMessage: data.message || 'User is busy on another call',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2500);
    });

    callSocket.onCallError((data: { message: string }) => {
      clearPendingResetTimeout();
      agoraRtcService.stopRingtone();
      let userFriendlyMessage = 'Call failed. Please try again.';
      if (data?.message) {
        if (
          data.message.includes('Prisma') ||
          data.message.includes('database') ||
          data.message.includes('column') ||
          data.message.includes('invocation')
        ) {
          userFriendlyMessage = 'Unable to start call. Please try again in a moment.';
        } else {
          userFriendlyMessage = data.message;
        }
      }
      set({
        statusMessage: userFriendlyMessage,
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2500);
    });

    callSocket.onCallTimeout(() => {
      clearPendingResetTimeout();
      agoraRtcService.stopRingtone();
      set({
        statusMessage: 'Call Unanswered (Missed)',
      });
      resetTimeout = setTimeout(() => {
        get().resetCall();
      }, 2000);
    });

    callSocket.onCallEnded((data: CallEndedNotification) => {
      clearPendingResetTimeout();
      agoraRtcService.stopRingtone();
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

    // Authoritative synchronization of native audio route changes (Speaker, Earpiece, Bluetooth, Headset)
    agoraRtcService.onAudioRoutingChanged((routing: number) => {
      const route = agoraRtcService.getAudioRouteFromAgora(routing);
      const isSpeaker = route === 'SPEAKER';
      const detected = agoraRtcService.detectConnectedDevices();

      let extDevice: 'BLUETOOTH' | 'HEADSET' | null = null;
      if (route === 'BLUETOOTH' || detected.hasBluetooth) {
        extDevice = 'BLUETOOTH';
      } else if (route === 'HEADSET' || detected.hasHeadset) {
        extDevice = 'HEADSET';
      }

      console.log(
        `[AUDIO_ROUTE] authoritative update: route=${route} | isSpeakerOn=${isSpeaker} | extDevice=${extDevice}`
      );

      set({
        currentAudioRoute: route,
        isSpeakerOn: isSpeaker,
        connectedExternalDevice: extDevice,
        bluetoothDeviceName: detected.bluetoothDeviceName || (extDevice === 'BLUETOOTH' ? 'Bluetooth Headset' : null),
        headsetDeviceName: detected.headsetDeviceName || (extDevice === 'HEADSET' ? 'Wired Headset' : null),
      });
    });

    set({ isInitialized: true });
  },

  startCall: async (matchId, receiverUserId, partnerName, partnerAvatarUrl, callType = CallType.VIDEO) => {
    clearPendingResetTimeout();
    pendingCancelledMatchId = null;
    userExplicitlySelectedRoute = false;
    userSelectedRoute = null;
    get().initCallSocket();

    // Ensure socket is actively connected before initiating
    await callSocket.ensureConnected(4000);

    const granted = await requestCallingPermissions(callType === CallType.VIDEO);
    if (!granted) return;

    // Initialize Agora & detect connected devices early before dialing
    const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID || '07f3de63ed2c431c9e7c40cd26b1c91b';
    try {
      await agoraRtcService.init(appId);
      get().detectAudioDevices();
    } catch { }

    const isVideo = callType === CallType.VIDEO;
    const extDevice = get().connectedExternalDevice;
    let initialRoute: AppAudioRoute = 'EARPIECE';

    if (isVideo) {
      initialRoute = 'SPEAKER';
      agoraRtcService.setDefaultRoute(true);
    } else if (extDevice === 'BLUETOOTH') {
      initialRoute = 'BLUETOOTH';
      agoraRtcService.setAudioRoute('BLUETOOTH').catch(() => { });
    } else if (extDevice === 'HEADSET') {
      initialRoute = 'HEADSET';
      agoraRtcService.setAudioRoute('HEADSET').catch(() => { });
    } else {
      initialRoute = 'EARPIECE';
      // For audio call with no external device forced, apply system default route policy
      // (-1 on Android) so if a Bluetooth headset is connected, Android routes to it without interference.
      agoraRtcService.setDefaultRoute(false);
    }

    agoraRtcService.playRingtone('outgoing').catch(() => { });

    set({
      callState: 'OUTGOING_RINGING',
      durationSeconds: 0,
      statusMessage: 'Calling...',
      currentAudioRoute: initialRoute,
      isSpeakerOn: initialRoute === 'SPEAKER',
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
    await agoraRtcService.stopRingtone();
    const { activeCall } = get();
    if (!activeCall || !activeCall.callId) return;

    const granted = await requestCallingPermissions(activeCall.callType === CallType.VIDEO);
    if (!granted) return;

    set({ statusMessage: 'Connecting...' });

    // Ensure the socket is live before emitting call:accept
    const isConnected = await callSocket.ensureConnected(6000);
    if (!isConnected) {
      console.warn('[CALL_STORE] Socket not connected after 6s; cannot accept call.');
      set({ statusMessage: 'Connection failed. Please try again.' });
      setTimeout(() => get().resetCall(), 2000);
      return;
    }

    callSocket.acceptCall(activeCall.callId);
  },

  rejectIncomingCall: (reason?: string) => {
    clearPendingResetTimeout();
    agoraRtcService.stopRingtone();
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
    agoraRtcService.stopRingtone();
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

  toggleSpeaker: async () => {
    const { currentAudioRoute, connectedExternalDevice } = get();
    // Intelligent toggle:
    // If currently on SPEAKER:
    //   Switch back to BLUETOOTH if headset connected, or HEADSET, else EARPIECE.
    // If currently on EARPIECE / BLUETOOTH / HEADSET:
    //   Switch to physical SPEAKER.
    let nextRoute: AppAudioRoute = 'SPEAKER';
    if (currentAudioRoute === 'SPEAKER') {
      if (connectedExternalDevice === 'BLUETOOTH') {
        nextRoute = 'BLUETOOTH';
      } else if (connectedExternalDevice === 'HEADSET') {
        nextRoute = 'HEADSET';
      } else {
        nextRoute = 'EARPIECE';
      }
    } else {
      nextRoute = 'SPEAKER';
    }

    userExplicitlySelectedRoute = true;
    userSelectedRoute = nextRoute;
    await agoraRtcService.setAudioRoute(nextRoute);
  },

  setAudioRoute: async (route: AppAudioRoute) => {
    userExplicitlySelectedRoute = true;
    userSelectedRoute = route;
    await agoraRtcService.setAudioRoute(route);
  },

  detectAudioDevices: () => {
    const detected = agoraRtcService.detectConnectedDevices();
    let extDevice: 'BLUETOOTH' | 'HEADSET' | null = null;
    if (detected.hasBluetooth) {
      extDevice = 'BLUETOOTH';
    } else if (detected.hasHeadset) {
      extDevice = 'HEADSET';
    }

    set({
      connectedExternalDevice: extDevice,
      bluetoothDeviceName: detected.bluetoothDeviceName || (detected.hasBluetooth ? 'Bluetooth Headset' : null),
      headsetDeviceName: detected.headsetDeviceName || (detected.hasHeadset ? 'Wired Headset' : null),
    });
  },

  flipCamera: () => {
    set((state) => ({ isCameraFlipped: !state.isCameraFlipped }));
    agoraRtcService.flipCamera();
  },

  resetCall: () => {
    clearPendingResetTimeout();
    userExplicitlySelectedRoute = false;
    userSelectedRoute = null;
    agoraRtcService.stopRingtone();
    agoraRtcService.resetRoutingState();
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
      currentAudioRoute: 'SPEAKER',
      connectedExternalDevice: null,
      bluetoothDeviceName: null,
      headsetDeviceName: null,
      isCameraFlipped: false,
      partnerVideoMuted: false,
      partnerAudioMuted: false,
      statusMessage: '',
    });
  },
}));

if (typeof globalThis !== 'undefined') {
  (globalThis as any).runAudioDiagnostics = () => agoraRtcService.runDiagnosticSequence();
}


