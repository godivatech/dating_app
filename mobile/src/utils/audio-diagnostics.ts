import { NativeModules, Platform } from 'react-native';

export interface AndroidAudioDevice {
  id: number;
  type: number;
  typeName: string;
  productName: string;
  isSink?: boolean;
  isSource?: boolean;
  address?: string;
}

export interface AndroidBondedDevice {
  name: string;
  address: string;
  type: number;
  bondState: number;
}

export interface AndroidAudioDiagnostics {
  audioManager: {
    mode: number;
    modeName: string;
    isSpeakerphoneOn: boolean;
    isBluetoothScoOn: boolean;
    isBluetoothA2dpOn: boolean;
    isMusicActive: boolean;
    communicationDevice?: {
      id: number;
      type: number;
      typeName: string;
      productName: string;
    } | null;
  };
  outputDevices: AndroidAudioDevice[];
  inputDevices: AndroidAudioDevice[];
  bluetooth: {
    hasAdapter: boolean;
    isEnabled: boolean;
    hasConnectPermission: boolean;
    bondedDevices?: AndroidBondedDevice[];
    headsetConnected?: boolean;
    a2dpConnected?: boolean;
    securityError?: string;
  };
  permissions: {
    RECORD_AUDIO: boolean;
    MODIFY_AUDIO_SETTINGS: boolean;
    BLUETOOTH_CONNECT: boolean;
    BLUETOOTH: boolean;
  };
  deviceInfo: {
    sdkInt: number;
    model: string;
    manufacturer: string;
  };
}

export interface AgoraDiagnosticsSnapshot {
  currentRoute?: string;
  targetRoute?: string | null;
  confirmedRoute?: string | null;
  rawRoutingCallback?: number | null;
  isSpeakerphoneEnabled?: boolean;
  lastSetDefaultRouteCode?: number | null;
  lastSetEnableSpeakerphoneCode?: number | null;
  lastSetRouteInCommunicationModeCode?: number | null;
}

/**
 * Fetches the full runtime audio diagnostics from the native Android layer.
 * Returns null on iOS, Web, or if native module is not yet linked.
 */
export async function getAndroidAudioDiagnostics(): Promise<AndroidAudioDiagnostics | null> {
  if (Platform.OS !== 'android') return null;
  const AudioDiagnostics = NativeModules.AudioDiagnostics;
  if (!AudioDiagnostics || typeof AudioDiagnostics.getAudioDiagnostics !== 'function') {
    return null;
  }
  try {
    return await AudioDiagnostics.getAudioDiagnostics();
  } catch (error) {
    console.warn('[AUDIO_DIAGNOSTICS] Failed to get native audio diagnostics:', error);
    return null;
  }
}

/**
 * Executes a direct native speakerphone test on Android AudioManager.
 */
export async function testNativeAndroidSpeaker(enabled: boolean): Promise<any> {
  if (Platform.OS !== 'android') return null;
  const AudioDiagnostics = NativeModules.AudioDiagnostics;
  if (!AudioDiagnostics || typeof AudioDiagnostics.testNativeSpeakerphone !== 'function') {
    return null;
  }
  try {
    return await AudioDiagnostics.testNativeSpeakerphone(enabled);
  } catch (error) {
    console.warn('[AUDIO_DIAGNOSTICS] Failed to test native speaker:', error);
    return null;
  }
}

/**
 * Formats and prints a comprehensive runtime audio diagnostic block.
 */
export async function logAudioDiagnostics(
  tag: string,
  agoraSnapshot?: AgoraDiagnosticsSnapshot,
): Promise<void> {
  const diag = await getAndroidAudioDiagnostics();
  const timestamp = new Date().toISOString().substring(11, 19);

  if (!diag) {
    console.log(
      `[AUDIO_DIAGNOSTICS][${tag}][${timestamp}] Platform: ${Platform.OS} | Native module not active | Agora: ${JSON.stringify(agoraSnapshot || {})}`
    );
    return;
  }

  const am = diag.audioManager;
  const bt = diag.bluetooth;
  const perm = diag.permissions;
  const outputs = diag.outputDevices || [];
  const commDev = am.communicationDevice;

  const lines: string[] = [
    `\n==================== [AUDIO_DIAGNOSTICS: ${tag}] ${timestamp} ====================`,
    `Hardware: ${diag.deviceInfo.manufacturer} ${diag.deviceInfo.model} (Android API ${diag.deviceInfo.sdkInt})`,
    `1. Android AudioManager:`,
    `   - Mode: ${am.modeName} (${am.mode})`,
    `   - isSpeakerphoneOn: ${am.isSpeakerphoneOn}`,
    `   - isBluetoothScoOn: ${am.isBluetoothScoOn}`,
    `   - isBluetoothA2dpOn: ${am.isBluetoothA2dpOn}`,
    `   - isMusicActive: ${am.isMusicActive}`,
    `   - CommunicationDevice (API 31+): ${commDev ? `ID ${commDev.id}: ${commDev.typeName} - ${commDev.productName}` : 'None'}`,
    `2. Connected Output Devices (${outputs.length}):`,
  ];

  outputs.forEach((dev, idx) => {
    lines.push(
      `   [${idx + 1}] ID: ${dev.id} | Type: ${dev.typeName} (${dev.type}) | Name: "${dev.productName}" | Address: "${dev.address || 'N/A'}"`
    );
  });

  lines.push(`3. Bluetooth Adapter / Profile State:`);
  lines.push(`   - Adapter Enabled: ${bt.isEnabled}`);
  lines.push(`   - Connect Permission: ${bt.hasConnectPermission}`);
  lines.push(`   - Headset (HFP) Connected: ${bt.headsetConnected ?? 'N/A'}`);
  lines.push(`   - A2DP Connected: ${bt.a2dpConnected ?? 'N/A'}`);
  if (bt.bondedDevices && bt.bondedDevices.length > 0) {
    lines.push(`   - Bonded Devices (${bt.bondedDevices.length}):`);
    bt.bondedDevices.forEach((bd) => {
      lines.push(`     * "${bd.name}" (${bd.address})`);
    });
  } else {
    lines.push(`   - Bonded Devices: None reported`);
  }
  if (bt.securityError) {
    lines.push(`   - Bluetooth Warning: ${bt.securityError}`);
  }

  lines.push(`4. Android Runtime Permissions:`);
  lines.push(`   - RECORD_AUDIO: ${perm.RECORD_AUDIO}`);
  lines.push(`   - MODIFY_AUDIO_SETTINGS: ${perm.MODIFY_AUDIO_SETTINGS}`);
  lines.push(`   - BLUETOOTH_CONNECT: ${perm.BLUETOOTH_CONNECT}`);
  lines.push(`   - BLUETOOTH (legacy): ${perm.BLUETOOTH}`);

  if (agoraSnapshot) {
    lines.push(`5. Agora RTC Engine State:`);
    lines.push(`   - currentRoute: ${agoraSnapshot.currentRoute}`);
    lines.push(`   - targetRoute: ${agoraSnapshot.targetRoute}`);
    lines.push(`   - confirmedRoute: ${agoraSnapshot.confirmedRoute}`);
    lines.push(`   - raw onAudioRoutingChanged: ${agoraSnapshot.rawRoutingCallback}`);
    lines.push(`   - isSpeakerphoneEnabled(): ${agoraSnapshot.isSpeakerphoneEnabled}`);
    if (agoraSnapshot.lastSetEnableSpeakerphoneCode !== undefined) {
      lines.push(`   - setEnableSpeakerphone() return code: ${agoraSnapshot.lastSetEnableSpeakerphoneCode}`);
    }
    if (agoraSnapshot.lastSetRouteInCommunicationModeCode !== undefined) {
      lines.push(`   - setRouteInCommunicationMode() return code: ${agoraSnapshot.lastSetRouteInCommunicationModeCode}`);
    }
    if (agoraSnapshot.lastSetDefaultRouteCode !== undefined) {
      lines.push(`   - setDefaultAudioRouteToSpeakerphone() return code: ${agoraSnapshot.lastSetDefaultRouteCode}`);
    }
  }

  lines.push(`========================================================================\n`);

  console.log(lines.join('\n'));
}
