import React from 'react';
import { View, Image, StyleSheet, Text, Platform, StyleProp, ViewStyle } from 'react-native';
import {
  RtcSurfaceView,
  VideoSourceType,
  RenderModeType,
} from 'react-native-agora';
import { Ionicons } from '@expo/vector-icons';

interface VideoSurfaceViewProps {
  uid: number;
  channelId?: string;
  isLocal?: boolean;
  avatarUrl?: string | null;
  isMuted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const VideoSurfaceView: React.FC<VideoSurfaceViewProps> = ({
  uid,
  isLocal = false,
  avatarUrl,
  isMuted = false,
  style,
}) => {
  const isWeb = Platform.OS === 'web';

  // Fallback rendering for muted video, web preview, or when camera feed is disabled
  if (isMuted || isWeb) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.fallbackAvatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={48} color="#94A3B8" />
          </View>
        )}
        {isMuted && (
          <View style={styles.mutedBadge}>
            <Ionicons name="videocam-off" size={16} color="#FFFFFF" />
            <Text style={styles.mutedBadgeText}>{isLocal ? 'Camera Off' : 'Partner Camera Off'}</Text>
          </View>
        )}
      </View>
    );
  }

  try {
    return (
      <View style={[styles.surfaceContainer, style]}>
        <RtcSurfaceView
          style={StyleSheet.absoluteFill}
          canvas={
            isLocal
              ? {
                  uid: 0,
                  sourceType: VideoSourceType.VideoSourceCamera,
                  renderMode: RenderModeType.RenderModeHidden,
                }
              : {
                  uid,
                  renderMode: RenderModeType.RenderModeHidden,
                }
          }
        />
      </View>
    );
  } catch (error) {
    console.warn('[VIDEO_SURFACE_ERROR] Fallback to avatar due to surface render error:', error);
    return (
      <View style={[styles.fallbackContainer, style]}>
        {avatarUrl && <Image source={{ uri: avatarUrl }} style={styles.fallbackAvatar} />}
      </View>
    );
  }
};

const styles = StyleSheet.create({
  surfaceContainer: {
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  fallbackContainer: {
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackAvatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mutedBadgeText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
