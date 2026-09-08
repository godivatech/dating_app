import { Platform } from 'react-native';
import {
  createAgoraRtcEngine,
  IRtcEngine as IAgoraEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngineEventHandler,
} from 'react-native-agora';
import { IRtcEngine, RtcJoinChannelOptions } from './rtc.interface';

export class AgoraRtcService implements IRtcEngine {
  private static instance: AgoraRtcService;
  private engine: IAgoraEngine | null = null;
  private isInitialized = false;
  private isAvailable = true;
  private currentAppId: string | null = null;

  private userJoinedCallbacks = new Set<(uid: number) => void>();
  private userOfflineCallbacks = new Set<(uid: number) => void>();
  private connectionStateCallbacks = new Set<(state: string) => void>();

  private eventHandler: IRtcEngineEventHandler | null = null;

  private constructor() {}

  static getInstance(): AgoraRtcService {
    if (!AgoraRtcService.instance) {
      AgoraRtcService.instance = new AgoraRtcService();
    }
    return AgoraRtcService.instance;
  }

  /**
   * Initializes the native Agora RTC engine with Communication profile.
   */
  async init(appId: string): Promise<boolean> {
    if (this.isInitialized && this.currentAppId === appId && this.engine) {
      return true;
    }

    if (Platform.OS === 'web') {
      console.warn('[AGORA_RTC] Web platform detected; native Agora RTC is not active in browser preview.');
      this.isAvailable = false;
      return false;
    }

    try {
      this.engine = createAgoraRtcEngine();
      this.engine.initialize({
        appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      this.eventHandler = {
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log(`[AGORA_RTC] Joined channel: ${connection.channelId} in ${elapsed}ms`);
        },
        onUserJoined: (connection, remoteUid, elapsed) => {
          console.log(`[AGORA_RTC] Remote user ${remoteUid} joined`);
          this.userJoinedCallbacks.forEach((cb) => cb(remoteUid));
        },
        onUserOffline: (connection, remoteUid, reason) => {
          console.log(`[AGORA_RTC] Remote user ${remoteUid} went offline (reason: ${reason})`);
          this.userOfflineCallbacks.forEach((cb) => cb(remoteUid));
        },
        onConnectionStateChanged: (connection, state, reason) => {
          console.log(`[AGORA_RTC] Connection state: ${state}, reason: ${reason}`);
          this.connectionStateCallbacks.forEach((cb) => cb(String(state)));
        },
        onError: (err, msg) => {
          console.warn(`[AGORA_RTC_ERROR] Code: ${err}, Message: ${msg}`);
        },
      };

      this.engine.registerEventHandler(this.eventHandler);
      this.engine.enableAudio();

      this.isInitialized = true;
      this.isAvailable = true;
      this.currentAppId = appId;
      return true;
    } catch (error: any) {
      console.warn(
        '[AGORA_RTC_UNAVAILABLE] Native Agora RTC driver could not be bound in this environment. ' +
        'This is normal in Expo Go or Web. Use an EAS development build for native calling.\n' +
        `Details: ${error?.message}`,
      );
      this.isAvailable = false;
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Joins an Agora video or voice channel with the given token and UID.
   */
  async joinChannel({ channelName, token, uid, isVideo }: RtcJoinChannelOptions): Promise<boolean> {
    if (!this.engine || !this.isAvailable) {
      console.log(`[AGORA_RTC_MOCK] Simulated join channel: ${channelName} (isVideo: ${isVideo})`);
      return true;
    }

    try {
      if (isVideo) {
        this.engine.enableVideo();
        this.engine.startPreview();
        this.engine.setDefaultAudioRouteToSpeakerphone(true);
        this.engine.setEnableSpeakerphone(true);
      } else {
        this.engine.disableVideo();
        this.engine.setDefaultAudioRouteToSpeakerphone(false);
        this.engine.setEnableSpeakerphone(false);
      }

      const result = this.engine.joinChannel(token, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
      });

      return result === 0;
    } catch (error: any) {
      console.error(`[AGORA_RTC] Failed to join channel: ${error.message}`);
      return false;
    }
  }

  /**
   * Leaves the active channel and stops local camera preview.
   */
  async leaveChannel(): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.stopPreview();
      this.engine.leaveChannel();
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error leaving channel: ${error.message}`);
    }
  }

  /**
   * Mutes or unmutes the local microphone.
   */
  async toggleMic(muted: boolean): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.muteLocalAudioStream(muted);
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error toggling mic: ${error.message}`);
    }
  }

  /**
   * Enables or disables the local video camera feed.
   */
  async toggleVideo(muted: boolean): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.muteLocalVideoStream(muted);
      if (muted) {
        this.engine.stopPreview();
      } else {
        this.engine.startPreview();
      }
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error toggling video: ${error.message}`);
    }
  }

  /**
   * Toggles audio output between loudspeaker and earpiece.
   */
  async toggleSpeaker(speakerOn: boolean): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.setEnableSpeakerphone(speakerOn);
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error toggling speaker: ${error.message}`);
    }
  }

  /**
   * Flips between front selfie camera and rear camera.
   */
  async flipCamera(): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.switchCamera();
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error flipping camera: ${error.message}`);
    }
  }

  /**
   * Completely destroys and unregisters the Agora engine.
   */
  async destroy(): Promise<void> {
    if (!this.engine || !this.isAvailable) return;

    try {
      if (this.eventHandler) {
        this.engine.unregisterEventHandler(this.eventHandler);
      }
      this.engine.release();
      this.engine = null;
      this.isInitialized = false;
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error destroying engine: ${error.message}`);
    }
  }

  onUserJoined(listener: (uid: number) => void): () => void {
    this.userJoinedCallbacks.add(listener);
    return () => this.userJoinedCallbacks.delete(listener);
  }

  onUserOffline(listener: (uid: number) => void): () => void {
    this.userOfflineCallbacks.add(listener);
    return () => this.userOfflineCallbacks.delete(listener);
  }

  onConnectionStateChanged(listener: (state: string) => void): () => void {
    this.connectionStateCallbacks.add(listener);
    return () => this.connectionStateCallbacks.delete(listener);
  }
}

export const agoraRtcService = AgoraRtcService.getInstance();
