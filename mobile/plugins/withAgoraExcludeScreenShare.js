const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to exclude Agora's unused `full-screen-sharing` module.
 *
 * GenZDate implements 1-on-1 audio and video calling with camera capture,
 * front/rear camera flipping, and Bluetooth/speaker audio routing.
 * It does not use Android MediaProjection or screen-sharing capabilities.
 *
 * This plugin excludes `io.agora.rtc:full-screen-sharing` at the Gradle level,
 * cleanly removing `FOREGROUND_SERVICE_MEDIA_PROJECTION` and `ScreenSharingService`
 * without affecting Agora's core WebRTC and audio/video engine (`full-sdk`).
 */
function withAgoraExcludeScreenShare(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      const marker = '// [Agora] Exclude unused full-screen-sharing module';
      if (!modConfig.modResults.contents.includes(marker)) {
        const exclusionBlock = `
${marker}
allprojects {
    configurations.configureEach {
        exclude group: "io.agora.rtc", module: "full-screen-sharing"
    }
}
`;
        modConfig.modResults.contents += exclusionBlock;
      }
    }
    return modConfig;
  });
}

module.exports = withAgoraExcludeScreenShare;
