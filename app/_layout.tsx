import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AlbumsProvider } from '@/context/AlbumsContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AlbumsProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-album" options={{ presentation: 'modal', title: 'Log Album' }} />
          <Stack.Screen name="album-detail" options={{ presentation: 'modal', title: 'Album' }} />
          <Stack.Screen name="pick-item" options={{ presentation: 'modal', title: 'Search' }} />
          <Stack.Screen name="discover-results" options={{ headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-new-releases" options={{ title: 'New Releases', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-coming-soon" options={{ title: 'Coming Soon', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-top-rated" options={{ title: 'Top Rated Albums', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-most-popular" options={{ title: 'Most Popular Albums', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-all-time-classics" options={{ title: 'All-Time Classics', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-recommended" options={{ title: 'Based on Your Taste', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-top-artists" options={{ title: 'Top Artists', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-top-songs" options={{ title: 'Top Songs', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-genres" options={{ title: 'Genres', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-decades" options={{ title: 'By Decade', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-decade-grid" options={{ headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="discover-genre-grid" options={{ headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="my-listend" options={{ title: 'My Listend', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="want-to-listen" options={{ title: 'Want to Listen', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="recent-listens" options={{ title: 'Recent Listens', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="my-reviews" options={{ title: 'My Reviews', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile', headerStyle: { backgroundColor: '#0d0d0d' }, headerTintColor: '#f0f0f0' }} />
        </Stack>
      </ThemeProvider>
    </AlbumsProvider>
    </GestureHandlerRootView>
  );
}
