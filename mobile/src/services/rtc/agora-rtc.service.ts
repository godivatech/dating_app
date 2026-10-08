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
import {
  logAudioDiagnostics,
  AgoraDiagnosticsSnapshot,
  testNativeAndroidSpeaker,
} from '../../utils/audio-diagnostics';

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
  // Target route requested by the application/user
  private targetRoute: AppAudioRoute | null = null;
  // Authoritative route confirmed by native Agora onAudioRoutingChanged
  private confirmedRoute: AppAudioRoute = 'SPEAKER';
  // Track external device availability strictly from native Agora routing events (NO desktop device manager enumeration)
  private _isBluetoothAvailable = false;
  private _isHeadsetAvailable = false;
  private _bluetoothProfile: 'HFP' | 'A2DP' | null = null;
  // Track currently active ringtone so routing changes can rebind the playback stream immediately
  private currentRingtoneType: 'outgoing' | 'incoming' | null = null;

  // Diagnostic tracking return codes
  private lastRawRoutingCallback: number | null = null;
  private lastSetDefaultRouteCode: number | null = null;
  private lastSetEnableSpeakerphoneCode: number | null = null;
  private lastSetRouteInCommunicationModeCode: number | null = null;

  getDiagnosticsSnapshot(): AgoraDiagnosticsSnapshot {
    return {
      currentRoute: this.currentRoute,
      targetRoute: this.targetRoute,
      confirmedRoute: this.confirmedRoute,
      rawRoutingCallback: this.lastRawRoutingCallback,
      isSpeakerphoneEnabled: this.isSpeakerphoneEnabled(),
      lastSetDefaultRouteCode: this.lastSetDefaultRouteCode,
      lastSetEnableSpeakerphoneCode: this.lastSetEnableSpeakerphoneCode,
      lastSetRouteInCommunicationModeCode: this.lastSetRouteInCommunicationModeCode,
    };
  }

  private userJoinedCallbacks = new Set<(uid: number) => void>();
  private userOfflineCallbacks = new Set<(uid: number) => void>();
  private connectionStateCallbacks = new Set<(state: string) => void>();
  private audioRoutingCallbacks = new Set<(routing: number) => void>();

  private eventHandler: IRtcEngineEventHandler | null = null;

  private constructor() { }

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
          this.lastRawRoutingCallback = routing;
          const mappedRoute = this.getAudioRouteFromAgora(routing);
          const prevConfirmed = this.confirmedRoute;
          this.confirmedRoute = mappedRoute;
          this.currentRoute = mappedRoute;

          // Track availability based on native reported route
          if (routing === AudioRoute.RouteBluetoothDeviceHfp) {
            this._isBluetoothAvailable = true;
            this._bluetoothProfile = 'HFP';
          } else if (routing === AudioRoute.RouteBluetoothDeviceA2dp) {
            this._isBluetoothAvailable = true;
            this._bluetoothProfile = 'A2DP';
          } else if (
            routing === AudioRoute.RouteHeadset ||
            routing === AudioRoute.RouteHeadsetnomic ||
            routing === AudioRoute.RouteUsb
          ) {
            this._isHeadsetAvailable = true;
          } else if (
            (routing === AudioRoute.RouteSpeakerphone || routing === AudioRoute.RouteEarpiece) &&
            prevConfirmed === 'BLUETOOTH' &&
            this.targetRoute !== 'SPEAKER' &&
            this.targetRoute !== 'EARPIECE'
          ) {
            // Spontaneous transition away from Bluetooth while Bluetooth was targeted:
            // Hardware headset was disconnected or powered off by user!
            console.log('[AUDIO_ROUTE] Spontaneous Bluetooth disconnection detected by native Agora.');
            this._isBluetoothAvailable = false;
            this._bluetoothProfile = null;
          }

          console.log(
            `[AUDIO_ROUTE] native callback: ${mappedRoute} (raw: ${routing}) | prev: ${prevConfirmed} | btAvailable: ${this._isBluetoothAvailable} | speakerOn: ${mappedRoute === 'SPEAKER'}`
          );

          this.audioRoutingCallbacks.forEach((cb) => cb(routing));
          logAudioDiagnostics(`ON_AUDIO_ROUTING_CHANGED_RAW_${routing}`, this.getDiagnosticsSnapshot());
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
    this.currentRingtoneType = type;
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
          this.webAudio.play().catch(() => { });
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
      } catch { }
    }
  }

  /**
   * Stops any currently playing ringback tone or ringtone.
   */
  async stopRingtone(): Promise<void> {
    this.currentRingtoneType = null;
    if (Platform.OS === 'web') {
      if (this.webAudio) {
        try {
          this.webAudio.pause();
          this.webAudio = null;
        } catch { }
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
   * Detects connected audio devices (Bluetooth headsets, wired headsets)
   * strictly from confirmed native OS routing states.
   * Does NOT use desktop enumeratePlaybackDevices() which causes ghost devices on Android.
   */
  detectConnectedDevices(): DetectedAudioDevices {
    return {
      hasBluetooth: this._isBluetoothAvailable,
      hasHeadset: this._isHeadsetAvailable,
      bluetoothDeviceName: this._isBluetoothAvailable
        ? (this._bluetoothProfile === 'A2DP' ? 'Bluetooth Headset (A2DP)' : 'Bluetooth Headset (HFP)')
        : undefined,
      headsetDeviceName: this._isHeadsetAvailable ? 'Wired Headset' : undefined,
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
        return this.confirmedRoute || this.currentRoute || 'EARPIECE';
    }
  }

  /**
   * Resets internal audio routing state between calls.
   */
  resetRoutingState(): void {
    this._isBluetoothAvailable = false;
    this._isHeadsetAvailable = false;
    this._bluetoothProfile = null;
    this.currentRoute = 'SPEAKER';
    this.targetRoute = null;
    this.confirmedRoute = 'SPEAKER';
    this.currentRingtoneType = null;
  }

  /**
   * Sets default audio route policy without forcing a specific device in communication mode.
   * Setting default route to speakerphone allows the OS to route naturally:
   * Bluetooth headset (if connected) > Wired headset > Built-in speaker / Earpiece.
   */
  setDefaultRoute(toSpeaker: boolean): void {
    if (!this.engine || !this.isAvailable) return;
    try {
      this.lastSetDefaultRouteCode = this.engine.setDefaultAudioRouteToSpeakerphone(toSpeaker);
      if (Platform.OS === 'android') {
        if (this._isBluetoothAvailable) {
          this.lastSetRouteInCommunicationModeCode = this.engine.setRouteInCommunicationMode(
            toSpeaker ? AudioRoute.RouteSpeakerphone : AudioRoute.RouteDefault
          );
        } else {
          this.lastSetEnableSpeakerphoneCode = this.engine.setEnableSpeakerphone(toSpeaker);
        }
      } else {
        this.lastSetEnableSpeakerphoneCode = this.engine.setEnableSpeakerphone(toSpeaker);
      }
      logAudioDiagnostics(`SET_DEFAULT_ROUTE_${toSpeaker ? 'SPEAKER' : 'DEFAULT'}`, this.getDiagnosticsSnapshot());
    } catch (err: any) {
      console.warn('[AGORA_RTC] setDefaultRoute warning:', err?.message);
    }
  }

  /**
   * Selects an audio route explicitly (Speakerphone, Earpiece, Bluetooth, or Headset).
   * Follows single authoritative routing strategy according to Agora 4.6.4 specs:
   * - Never calls setEnableSpeakerphone and setRouteInCommunicationMode together.
   * - If Bluetooth device is connected on Android: uses setRouteInCommunicationMode alone.
   * - If NO Bluetooth device is connected on Android: uses setEnableSpeakerphone alone.
   * - On iOS: uses setEnableSpeakerphone alone.
   * Rebinds active ringtone effect so playback stream physical AudioTrack updates immediately.
   */
  async setAudioRoute(route: AppAudioRoute): Promise<void> {
    const prevRoute = this.currentRoute;
    this.targetRoute = route;

    console.log(
      `[AUDIO_ROUTE] request: ${route} | prev: ${prevRoute} | btAvailable: ${this._isBluetoothAvailable}`
    );

    if (Platform.OS === 'web' || !this.engine || !this.isAvailable) {
      console.log(`[AUDIO_ROUTE_MOCK] Applying simulated route: ${route}`);
      this.currentRoute = route;
      this.confirmedRoute = route;
      const simRouting =
        route === 'SPEAKER'
          ? AudioRoute.RouteSpeakerphone
          : route === 'BLUETOOTH'
          ? AudioRoute.RouteBluetoothDeviceHfp
          : route === 'HEADSET'
          ? AudioRoute.RouteHeadset
          : AudioRoute.RouteEarpiece;
      this.audioRoutingCallbacks.forEach((cb) => cb(simRouting));
      return;
    }

    try {
      const isSpeaker = route === 'SPEAKER';

      // 1. Configure default audio route preference
      this.lastSetDefaultRouteCode = this.engine.setDefaultAudioRouteToSpeakerphone(isSpeaker);

      // 2. Hardware routing control:
      if (Platform.OS === 'android') {
        if (this._isBluetoothAvailable) {
          let targetCode = AudioRoute.RouteSpeakerphone;
          if (route === 'SPEAKER') {
            targetCode = AudioRoute.RouteSpeakerphone; // 3
          } else if (route === 'BLUETOOTH') {
            targetCode =
              this._bluetoothProfile === 'A2DP'
                ? AudioRoute.RouteBluetoothDeviceA2dp // 10
                : AudioRoute.RouteBluetoothDeviceHfp; // 5
          } else if (route === 'HEADSET') {
            targetCode = AudioRoute.RouteHeadset; // 0
          } else if (route === 'EARPIECE') {
            targetCode = AudioRoute.RouteEarpiece; // 1
          }
          this.lastSetRouteInCommunicationModeCode = this.engine.setRouteInCommunicationMode(targetCode);
          console.log(`[AUDIO_ROUTE] setRouteInCommunicationMode(${targetCode}) returned: ${this.lastSetRouteInCommunicationModeCode}`);
        } else {
          if (route === 'BLUETOOTH') {
            console.warn('[AUDIO_ROUTE] Cannot route to Bluetooth: no Bluetooth device connected.');
            return;
          }
          if (route === 'HEADSET' && this._isHeadsetAvailable) {
            this.lastSetRouteInCommunicationModeCode = this.engine.setRouteInCommunicationMode(AudioRoute.RouteHeadset);
          } else {
            this.lastSetEnableSpeakerphoneCode = this.engine.setEnableSpeakerphone(isSpeaker);
            console.log(`[AUDIO_ROUTE] setEnableSpeakerphone(${isSpeaker}) returned: ${this.lastSetEnableSpeakerphoneCode}`);
          }
        }
      } else {
        this.lastSetEnableSpeakerphoneCode = this.engine.setEnableSpeakerphone(isSpeaker);
        console.log(`[AUDIO_ROUTE] iOS setEnableSpeakerphone(${isSpeaker}) returned: ${this.lastSetEnableSpeakerphoneCode}`);
      }

      logAudioDiagnostics(`SET_AUDIO_ROUTE_${route}`, this.getDiagnosticsSnapshot());

      // 3. Ringtone AudioTrack migration:
      if (this.currentRingtoneType) {
        try {
          this.engine.stopAllEffects();
          const soundId = this.currentRingtoneType === 'outgoing' ? 101 : 102;
          const url =
            this.currentRingtoneType === 'outgoing'
              ? OUTGOING_RINGBACK_URL
              : INCOMING_RINGTONE_URL;
          this.engine.playEffect(
            soundId,
            url,
            -1,
            1.0,
            0.0,
            100,
            false,
          );
        } catch (e) {
          console.warn('[AUDIO_ROUTE] Error rebinding ringtone effect:', e);
        }
      }
    } catch (error: any) {
      console.warn(`[AUDIO_ROUTE] Error setting audio route to ${route}: ${error?.message}`);
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

      // Setup initial audio routing based on active route preference or call type
      const targetRoute = this.targetRoute || this.currentRoute;
      const isSpeaker = targetRoute === 'SPEAKER';

      this.engine.setDefaultAudioRouteToSpeakerphone(isSpeaker);

      if (Platform.OS === 'android') {
        if (this._isBluetoothAvailable) {
          let routeCode = AudioRoute.RouteSpeakerphone;
          if (targetRoute === 'SPEAKER') routeCode = AudioRoute.RouteSpeakerphone;
          else if (targetRoute === 'BLUETOOTH') {
            routeCode =
              this._bluetoothProfile === 'A2DP'
                ? AudioRoute.RouteBluetoothDeviceA2dp
                : AudioRoute.RouteBluetoothDeviceHfp;
          } else if (targetRoute === 'HEADSET') routeCode = AudioRoute.RouteHeadset;
          else if (targetRoute === 'EARPIECE') routeCode = AudioRoute.RouteEarpiece;
          this.engine.setRouteInCommunicationMode(routeCode);
        } else {
          this.engine.setEnableSpeakerphone(isSpeaker);
        }
      } else {
        this.engine.setEnableSpeakerphone(isSpeaker);
      }

      const result = this.engine.joinChannel(token, channelName, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        autoSubscribeAudio: true,
        autoSubscribeVideo: isVideo,
        publishMicrophoneTrack: true,
        publishCameraTrack: isVideo,
      });

      logAudioDiagnostics(`JOIN_CHANNEL_RES_${result}`, this.getDiagnosticsSnapshot());
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
    this.resetRoutingState();
    if (!this.engine || !this.isAvailable) return;

    try {
      this.engine.stopPreview();
      this.engine.leaveChannel();
      logAudioDiagnostics('LEAVE_CHANNEL', this.getDiagnosticsSnapshot());
    } catch (error: any) {
      console.warn(`[AGORA_RTC] Error leaving channel: ${error.message}`);
    }
  }

  /**
   * Automated diagnostic routine for user sequence verification:
   * A/B/C: Baseline output devices & Agora route
   * D/E: Request Speaker and log Android state immediately
   * F/G: Request Earpiece and log Android state immediately
   * H/I: Request Bluetooth and log Android state immediately
   * Also tests native Android AudioManager speakerphone toggle to isolate Agora vs Android OS
   */
  async runDiagnosticSequence(): Promise<void> {
    console.log('\n>>>> STARTING AUTOMATED AUDIO ROUTING DIAGNOSTIC SEQUENCE <<<<');

    // A/B/C Baseline
    await logAudioDiagnostics('SEQ_A_BASELINE', this.getDiagnosticsSnapshot());

    // D/E Speaker
    console.log('>>>> [SEQ STEP D/E] Requesting SPEAKER <<<<');
    await this.setAudioRoute('SPEAKER');
    await new Promise((r) => setTimeout(r, 1200));
    await logAudioDiagnostics('SEQ_E_AFTER_SPEAKER', this.getDiagnosticsSnapshot());

    // F/G Earpiece
    console.log('>>>> [SEQ STEP F/G] Requesting EARPIECE <<<<');
    await this.setAudioRoute('EARPIECE');
    await new Promise((r) => setTimeout(r, 1200));
    await logAudioDiagnostics('SEQ_G_AFTER_EARPIECE', this.getDiagnosticsSnapshot());

    // H/I Bluetooth
    console.log('>>>> [SEQ STEP H/I] Requesting BLUETOOTH <<<<');
    if (this._isBluetoothAvailable) {
      await this.setAudioRoute('BLUETOOTH');
      await new Promise((r) => setTimeout(r, 1200));
      await logAudioDiagnostics('SEQ_I_AFTER_BLUETOOTH', this.getDiagnosticsSnapshot());
    } else {
      console.log('>>>> [SEQ STEP H/I] Bluetooth not flagged as available by Agora; logging baseline state <<<<');
      await logAudioDiagnostics('SEQ_I_NO_BLUETOOTH_FLAG', this.getDiagnosticsSnapshot());
    }

    // Native Speaker Bypass Test
    console.log('>>>> [SEQ TEST] Directly invoking Native Android AudioManager.setSpeakerphoneOn(true) <<<<');
    const nativeRes = await testNativeAndroidSpeaker(true);
    console.log('>>>> Native AudioManager.setSpeakerphoneOn(true) result:', nativeRes);
    await new Promise((r) => setTimeout(r, 800));
    await logAudioDiagnostics('SEQ_AFTER_NATIVE_SPEAKER_ON', this.getDiagnosticsSnapshot());

    console.log('>>>> [SEQ TEST] Restoring Native Android AudioManager.setSpeakerphoneOn(false) <<<<');
    await testNativeAndroidSpeaker(false);
    await logAudioDiagnostics('SEQ_AFTER_NATIVE_SPEAKER_OFF', this.getDiagnosticsSnapshot());

    console.log('>>>> COMPLETED AUTOMATED AUDIO ROUTING DIAGNOSTIC SEQUENCE <<<<\n');
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


