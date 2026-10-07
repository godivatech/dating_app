import { Platform } from 'react-native';
import {
  createAgoraRtcEngine,
  IRtcEngine as IAgoraEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngineEventHandler,
  AudioProfileType,
  AudioScenarioType,
  AudioRoute,
} from 'react-native-agora';
import { IRtcEngine, RtcJoinChannelOptions } from './rtc.interface';
import { requestCallingPermissions } from '../../utils/call-permissions';

export type AppAudioRoute = 'SPEAKER' | 'EARPIECE' | 'HEADSET' | 'BLUETOOTH';

export interface DetectedAudioDevices {
  hasBluetooth: boolean;
  hasHeadset: boolean;
  bluetoothDeviceName?: string;
  headsetDeviceName?: string;
}

// High-fidelity standard VoIP call progress tones (open source, telecom spec)
const OUTGOING_RINGBACK_URL =
  'https://raw.githubusercontent.com/matrix-org/matrix-react-sdk/develop/res/media/ringback.mp3';
const INCOMING_RINGTONE_URL =
  'https://raw.githubusercontent.com/matrix-org/matrix-react-sdk/develop/res/media/ring.mp3';

export class AgoraRtcService implements IRtcEngine {
  private static instance: AgoraRtcService;
  private engine: IAgoraEngine | null = null;
  private isInitialized = false;
  private isAvailable = true;
  private currentAppId: string | null = null;
  private webAudio: any = null;
  private currentRoute: AppAudioRoute = 'SPEAKER';
  // Track which external devices are currently active based on native OS audio routing events
  private _nativeBluetoothActive = false;
  private _nativeHeadsetActive = false;

  private userJoinedCallbacks = new Set<(uid: number) => void>();
  private userOfflineCallbacks = new Set<(uid: number) => void>();
  private connectionStateCallbacks = new Set<(state: string) => void>();
  private audioRoutingCallbacks = new Set<(routing: number) => void>();

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
        onAudioRoutingChanged: (routing) => {
          console.log(`[AGORA_RTC] Audio route changed to: ${routing}`);
          this.currentRoute = this.getAudioRouteFromAgora(routing);
          // Track external device presence based on real OS audio routing events
          if (this.currentRoute === 'BLUETOOTH') {
            this._nativeBluetoothActive = true;
          } else {
            this._nativeBluetoothActive = false;
          }
          if (this.currentRoute === 'HEADSET') {
            this._nativeHeadsetActive = true;
          } else {
            this._nativeHeadsetActive = false;
          }
          this.audioRoutingCallbacks.forEach((cb) => cb(routing));
        },
        onError: (err, msg) => {
          console.warn(`[AGORA_RTC_ERROR] Code: ${err}, Message: ${msg}`);
        },
      };

      this.engine.registerEventHandler(this.eventHandler);
      this.engine.enableAudio();
      this.engine.enableLocalAudio(true);
      this.engine.adjustRecordingSignalVolume(100);
      this.engine.adjustPlaybackSignalVolume(100);

      // Set audio profile for clear communication: Auto scenario handles Bluetooth SCO and hardware AEC properly
      this.engine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault,
      );

      // Enable audio volume indication for monitoring
      this.engine.enableAudioVolumeIndication(250, 3, true);

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
   * Plays outgoing ringback tone (for caller) or incoming musical ringtone (for receiver).
   * Uses Agora playEffect / startAudioMixing in loopback mode so it plays locally through active audio route.
   */
  async playRingtone(type: 'outgoing' | 'incoming'): Promise<void> {
    const soundId = type === 'outgoing' ? 101 : 102;
    const url = type === 'outgoing' ? OUTGOING_RINGBACK_URL : INCOMING_RINGTONE_URL;

    if (Platform.OS === 'web') {
      try {
        if (typeof Audio !== 'undefined') {
          if (this.webAudio) {
            this.webAudio.pause();
          }
          this.webAudio = new Audio(url);
          this.webAudio.loop = true;
          this.webAudio.play().catch(() => {});
        }
      } catch (e) {
        console.warn('[AGORA_RTC] Web ringtone error:', e);
      }
      return;
    }

    if (!this.engine || !this.isAvailable) return;

    try {
      // 1. First attempt playEffect which works seamlessly outside and inside an RTC channel
      const res = this.engine.playEffect(
        soundId,
        url,
        -1, // loop indefinitely
        1.0, // pitch
        0.0, // pan center
        100, // volume
        false, // publish=false (local playback only)
      );

      // 2. If playEffect returned error code (< 0), fall back to startAudioMixing
      if (res < 0) {
        this.engine.startAudioMixing(url, true, -1);
        this.engine.adjustAudioMixingPlayoutVolume(100);
      }
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error playing ringtone: ${error?.message}`);
      try {
        this.engine.startAudioMixing(url, true, -1);
      } catch {}
    }
  }

  /**
   * Stops any currently playing ringback tone or ringtone.
   */
  async stopRingtone(): Promise<void> {
    if (Platform.OS === 'web') {
      if (this.webAudio) {
        try {
          this.webAudio.pause();
          this.webAudio = null;
        } catch {}
      }
      return;
    }

    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.stopAllEffects();
      this.engine.stopAudioMixing();
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error stopping ringtone: ${error?.message}`);
    }
  }

  /**
   * Detects connected audio devices based on the native OS audio routing state.
   * On Android/iOS mobile, getAudioDeviceManager().enumeratePlaybackDevices() is a
   * desktop-only API and returns stale/virtual entries causing ghost Bluetooth detections.
   * Instead we rely on the actual onAudioRoutingChanged native callbacks to track which
   * external devices (Bluetooth, wired headset) the OS has routed audio to.
   */
  detectConnectedDevices(): DetectedAudioDevices {
    if (!this.engine || !this.isAvailable) {
      return { hasBluetooth: false, hasHeadset: false };
    }

    // On mobile, we trust the native OS routing events tracked in _nativeBluetoothActive
    // and _nativeHeadsetActive. These are only set to true when the OS actually routes
    // audio through that hardware — no string-matching heuristics, no stale device lists.
    return {
      hasBluetooth: this._nativeBluetoothActive,
      hasHeadset: this._nativeHeadsetActive,
      bluetoothDeviceName: this._nativeBluetoothActive ? 'Bluetooth Device' : undefined,
      headsetDeviceName: this._nativeHeadsetActive ? 'Wired Headset' : undefined,
    };
  }

  /**
   * Directly queries native Agora engine whether speakerphone is currently active.
   */
  isSpeakerphoneEnabled(): boolean {
    if (!this.engine || !this.isAvailable) return false;
    try {
      return this.engine.isSpeakerphoneEnabled();
    } catch {
      return this.currentRoute === 'SPEAKER';
    }
  }

  /**
   * Maps native Agora routing integers to semantic AppAudioRoute types.
   */
  getAudioRouteFromAgora(routing: number): AppAudioRoute {
    switch (routing) {
      case AudioRoute.RouteBluetoothDeviceHfp:
      case AudioRoute.RouteBluetoothDeviceA2dp:
        return 'BLUETOOTH';
      case AudioRoute.RouteHeadset:
      case AudioRoute.RouteHeadsetnomic:
      case AudioRoute.RouteUsb:
        return 'HEADSET';
      case AudioRoute.RouteSpeakerphone:
      case AudioRoute.RouteLoudspeaker:
        return 'SPEAKER';
      case AudioRoute.RouteEarpiece:
        return 'EARPIECE';
      case AudioRoute.RouteDefault:
      default:
        return this.currentRoute || 'EARPIECE';
    }
  }

  /**
   * Selects an audio route explicitly (Speakerphone, Earpiece, Bluetooth, or Headset).
   * Ensures physical speakerphone hardware and communication routing are simultaneously activated.
   */
  async setAudioRoute(route: AppAudioRoute): Promise<void> {
    if (!this.engine || !this.isAvailable) return;
    this.currentRoute = route;

    try {
      const isSpeaker = route === 'SPEAKER';

      // 1. Primary Agora speakerphone control (Invokes AudioManager.setSpeakerphoneOn on Android & AVAudioSession on iOS)
      this.engine.setDefaultAudioRouteToSpeakerphone(isSpeaker);
      this.engine.setEnableSpeakerphone(isSpeaker);

      // 2. On Android, explicitly set routing in communication mode
      if (Platform.OS === 'android') {
        let targetRoute = AudioRoute.RouteSpeakerphone;
        if (route === 'SPEAKER') {
          targetRoute = AudioRoute.RouteSpeakerphone; // 3
        } else if (route === 'BLUETOOTH') {
          targetRoute = AudioRoute.RouteBluetoothDeviceHfp; // 5
        } else if (route === 'HEADSET') {
          targetRoute = AudioRoute.RouteHeadset; // 0
        } else if (route === 'EARPIECE') {
          targetRoute = AudioRoute.RouteEarpiece; // 1
        }
        this.engine.setRouteInCommunicationMode(targetRoute);
      }

      console.log(`[AGORA_RTC] Audio route set to: ${route} (speakerphone enabled: ${this.isSpeakerphoneEnabled()})`);
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error setting audio route to ${route}: ${error?.message}`);
    }
  }

  /**
   * Intelligently toggles between speakerphone and external connected headset/bluetooth or earpiece.
   */
  async toggleAudioRoute(
    currentRoute: AppAudioRoute,
    connectedExternalDevice?: 'BLUETOOTH' | 'HEADSET' | null,
  ): Promise<AppAudioRoute> {
    let nextRoute: AppAudioRoute = 'SPEAKER';

    if (currentRoute === 'SPEAKER') {
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

    await this.setAudioRoute(nextRoute);
    return nextRoute;
  }

  /**
   * Joins an Agora video or voice channel with the given token and UID.
   */
  async joinChannel({ channelName, token, uid, isVideo }: RtcJoinChannelOptions): Promise<boolean> {
    // Ensure microphone, camera, and Bluetooth permissions are granted before joining
    await requestCallingPermissions(isVideo);

    if (!this.engine || !this.isAvailable) {
      console.log(`[AGORA_RTC_MOCK] Simulated join channel: ${channelName} (isVideo: ${isVideo})`);
      return true;
    }

    try {
      if (isVideo) {
        this.engine.enableVideo();
        // Pin video encoder strictly to 720p HD @ 30fps
        this.engine.setVideoEncoderConfiguration({
          dimensions: { width: 1280, height: 720 },
          frameRate: 30,
          bitrate: 1710,
        });
        this.engine.startPreview();
      } else {
        this.engine.disableVideo();
      }

      // Ensure local audio capture is active and volumes are nominal
      this.engine.enableLocalAudio(true);
      this.engine.adjustRecordingSignalVolume(100);
      this.engine.adjustPlaybackSignalVolume(100);

      // Setup audio routing based on active route preference or call type
      const targetRoute = this.currentRoute;
      const isSpeaker = targetRoute === 'SPEAKER';

      this.engine.setDefaultAudioRouteToSpeakerphone(isSpeaker);
      this.engine.setEnableSpeakerphone(isSpeaker);

      if (Platform.OS === 'android') {
        let routeCode = AudioRoute.RouteSpeakerphone;
        if (targetRoute === 'SPEAKER') routeCode = AudioRoute.RouteSpeakerphone;
        else if (targetRoute === 'BLUETOOTH') routeCode = AudioRoute.RouteBluetoothDeviceHfp;
        else if (targetRoute === 'HEADSET') routeCode = AudioRoute.RouteHeadset;
        else if (targetRoute === 'EARPIECE') routeCode = AudioRoute.RouteEarpiece;
        this.engine.setRouteInCommunicationMode(routeCode);
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
    await this.stopRingtone();
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
   * Toggles audio output between loudspeaker and earpiece/headset.
   */
  async toggleSpeaker(speakerOn: boolean): Promise<void> {
    await this.setAudioRoute(speakerOn ? 'SPEAKER' : 'EARPIECE');
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
    await this.stopRingtone();
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

  onAudioRoutingChanged(listener: (routing: number) => void): () => void {
    this.audioRoutingCallbacks.add(listener);
    return () => this.audioRoutingCallbacks.delete(listener);
  }
}

export const agoraRtcService = AgoraRtcService.getInstance();


