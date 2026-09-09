import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useNotificationsStore } from '../stores/notifications-store';

export type TabRoute = 'home' | 'explore' | 'center' | 'chat' | 'profile';

interface BottomTabBarProps {
  activeTab?: TabRoute;
  onPressCenter?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab = 'home',
  onPressCenter,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const insets = useSafeAreaInsets();

  // Dynamic bottom offset ensures the bar floats above Android 3-button nav, gesture bars, and iOS home indicators
  const bottomOffset = Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? 8 : 10);

  const getEffectiveActiveTab = (): TabRoute => {
    if (activeTab) return activeTab;
    if (pathname.includes('/explore')) return 'explore';
    if (pathname.includes('/conversations') || pathname.includes('/chat') || pathname.includes('/matches')) return 'chat';
    if (pathname.includes('/profile') || pathname.includes('/premium')) return 'profile';
    return 'home';
  };

  const currentTab = getEffectiveActiveTab();

  const handleNavigate = (tab: TabRoute) => {
    switch (tab) {
      case 'home':
        router.push('/discovery' as any);
        break;
      case 'explore':
        router.push('/explore' as any);
        break;
      case 'center':
        if (onPressCenter) {
          onPressCenter();
        } else {
          router.push('/discovery' as any);
        }
        break;
      case 'chat':
        router.push('/conversations' as any);
        break;
      case 'profile':
        router.push('/profile' as any);
        break;
    }
  };

  return (
    <View style={[styles.wrapper, { bottom: bottomOffset }]}>
      <View style={styles.container}>
        {/* Tab 1: Home */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavigate('home')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={currentTab === 'home' ? Colors.dark : Colors.textMuted}
          />
        </TouchableOpacity>

        {/* Tab 2: Explore / Compass */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavigate('explore')}
          activeOpacity={0.7}
        >
          <Feather
            name="compass"
            size={22}
            color={currentTab === 'explore' ? Colors.primary : Colors.textMuted}
          />
        </TouchableOpacity>

        {/* Center Floating Action Button (+) */}
        <View style={styles.centerFabContainer}>
          <TouchableOpacity
            style={styles.centerFab}
            onPress={() => handleNavigate('center')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Tab 4: Messages / Chat */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavigate('chat')}
          activeOpacity={0.7}
        >
          <View style={styles.iconWithBadge}>
            <Ionicons
              name={currentTab === 'chat' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={22}
              color={currentTab === 'chat' ? Colors.primary : Colors.textMuted}
            />
            {unreadCount > 0 && <View style={styles.badgeDot} />}
          </View>
        </TouchableOpacity>

        {/* Tab 5: Profile */}
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleNavigate('profile')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={currentTab === 'profile' ? Colors.primary : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 90,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  centerFabContainer: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  centerFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  iconWithBadge: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
});
