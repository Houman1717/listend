import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#111' : '#fff',
          borderTopColor: colorScheme === 'dark' ? '#222' : '#e5e5e5',
        },
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#111' : '#fff',
        },
        headerTintColor: colors.text,
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
          headerTitle: 'Find an Album',
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
          tabBarIcon: ({ color }) => <TabBarIcon name="headphones" color={color} />,
          headerTitle: 'My Listend',
          headerRight: () => (
            <Pressable onPress={() => router.push('/profile')} style={{ marginRight: 16 }}>
              <FontAwesome name="user-circle" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      {/* Hidden legacy screens */}
      <Tabs.Screen name="two" options={{ href: null }} />
      <Tabs.Screen name="lists" options={{ href: null }} />
    </Tabs>
  );
}
