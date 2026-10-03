import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useNotifications } from '@/context/NotificationsContext';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

// Listend tab icon with a gold dot when anything is unread (bell or DMs) —
// the profile header's own dots then say which.
function ListendTabIcon({ color, hasUnread, background }: { color: string; hasUnread: boolean; background: string }) {
  return (
    <View>
      <TabBarIcon name="headphones" color={color} />
      {hasUnread && (
        <View style={{
          position: 'absolute',
          top: -2, right: -5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: '#D4A017',
          borderWidth: 1.5, borderColor: background,
        }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { unreadCount, unreadDMCount } = useNotifications();
  const hasUnread = unreadCount + unreadDMCount > 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShown: useClientOnlyValue(false, true),
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerTitle: 'Listend',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <TabBarIcon name="compass" color={color} />,
          headerTitle: 'Discover',
        }}
      />
      <Tabs.Screen
        name="listend"
        options={{
          title: 'Listend',
          tabBarIcon: ({ color }) => <ListendTabIcon color={color} hasUnread={hasUnread} background={colors.background} />,
          headerTitle: 'Listend',
          // headerRight is injected dynamically from listend.tsx via useNavigation().setOptions
        }}
      />

      {/* Hidden legacy screens */}
      <Tabs.Screen name="two" options={{ href: null }} />
      <Tabs.Screen name="lists" options={{ href: null }} />
    </Tabs>
  );
}
