/**
 * Generic Real-Time Communication (RTC) Interface.
 * 
 * Encapsulates all audio/video streaming, device control, and engine lifecycle
 * behind a clean boundary so the application business logic remains provider-agnostic.
 */

export interface RtcJoinChannelOptions {
  channelName: string;
  token: string;
  uid: number;
  isVideo: boolean;
}

export interface IRtcEngine {
  /**
   * Initializes the native RTC media engine.
   */
  init(appId: string): Promise<boolean>;

  /**
   * Joins a live audio/video communication channel.
   */
  joinChannel(options: RtcJoinChannelOptions): Promise<boolean>;

  /**
   * Leaves the active channel and stops local streaming.
   */
  leaveChannel(): Promise<void>;

  /**
   * Mutes or unmutes local microphone.
   */
  toggleMic(muted: boolean): Promise<void>;

  /**
   * Enables or disables local camera video capture.
   */
  toggleVideo(muted: boolean): Promise<void>;

  /**
   * Switches audio output route between speakerphone and earpiece/receiver.
   */
  toggleSpeaker(speakerOn: boolean): Promise<void>;

  /**
   * Flips between front selfie camera and back camera.
   */
  flipCamera(): Promise<void>;

  /**
   * Cleans up listeners and completely releases camera/audio HAL resources.
   */
  destroy(): Promise<void>;

  /**
   * Registers a listener for remote participant joining the room.
   */
  onUserJoined(listener: (uid: number) => void): () => void;

  /**
   * Registers a listener for remote participant leaving the room.
   */
  onUserOffline(listener: (uid: number) => void): () => void;

  /**
   * Registers a listener for network / connection state changes.
   */
  onConnectionStateChanged(listener: (state: string) => void): () => void;
}
