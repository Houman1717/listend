import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { OfflineBanner } from '@/components/OfflineBanner';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native';
import { posthog, identifyUser, resetAnalytics } from '@/lib/analytics';

import { useColorScheme } from '@/components/useColorScheme';
import { ThemeProvider } from '@/context/ThemeContext';
import { AlbumsProvider } from '@/context/AlbumsContext';
import { FlipProvider } from '@/context/FlipContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { LikedArtistsProvider } from '@/context/LikedArtistsContext';
import { LikedFeaturedPlaylistsProvider } from '@/context/LikedFeaturedPlaylistsContext';
import { FavoritesSyncer } from '@/components/FavoritesSyncer';
import { ProProvider } from '@/context/ProContext';
import { RevenueCatProvider } from '@/context/RevenueCatContext';
import { ProPaywallModal } from '@/components/ProPaywallModal';
import { configureGoogleSignIn } from '@/lib/auth/googleAuth';

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

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

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

// Watches auth state and redirects to login or app accordingly.
function AuthGate() {
  const { session, loading, needsOnboarding, clearNeedsOnboarding } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthScreen) {
      router.replace('/login');
    } else if (session && inAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  // Separate from the above: ensureProfile (AuthContext) resolves asynchronously
  // after SIGNED_IN, so needsOnboarding can flip true well after the effect above
  // has already navigated off the login/signup screen. Firing this independently
  // (not gated on segments) means it still reliably pushes edit-profile on top of
  // wherever the user currently is.
  useEffect(() => {
    if (needsOnboarding && session) {
      router.push('/edit-profile');
      clearNeedsOnboarding();
    }
  }, [needsOnboarding, session]);

  // Navigate to the right screen when user taps a push notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (!data?.type) return;
      if (data.type === 'message') {
        router.push({ pathname: '/dm-conversation', params: { userId: data.actorId } });
      } else if ((data.type === 'like_review' || data.type === 'comment' || data.type === 'comment_reply') && data.targetId) {
        const albumId = data.targetId.split('_')[1];
        router.push({ pathname: '/album-detail', params: { id: albumId } } as any);
      } else {
        router.push({ pathname: '/user-profile', params: { userId: data.actorId } });
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

// Ties PostHog events to the logged-in user; resets on logout.
function AnalyticsIdentity() {
  const { user } = useAuth();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, { email: user.email ?? undefined });
      prevId.current = user.id;
    } else if (prevId.current) {
      resetAnalytics();
      prevId.current = null;
    }
  }, [user?.id]);

  return null;
}

// Enables PostHog autocapture (screens, taps, sessions). No-ops if no key set.
function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthog) return <>{children}</>;
  return <PostHogProvider client={posthog} autocapture>{children}</PostHogProvider>;
}

function RootLayoutNav() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AnalyticsProvider>
    <AuthProvider>
    <RevenueCatProvider>
    <ProProvider>
    <NotificationsProvider>
    <AlbumsProvider>
    <LikedArtistsProvider>
    <LikedFeaturedPlaylistsProvider>
    <FlipProvider>
      <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <AnalyticsIdentity />
        <FavoritesSyncer />
        <OfflineBanner />
        <ProPaywallModal />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="log-album" options={{ presentation: 'modal', title: 'Log Album' }} />
          <Stack.Screen name="album-detail" options={{ presentation: 'modal', title: 'Album' }} />
          <Stack.Screen name="pick-item" options={{ presentation: 'modal', title: 'Search' }} />
          <Stack.Screen name="discover-results" options={{ headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-new-releases" options={{ title: 'New Releases', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-coming-soon" options={{ title: 'Coming Soon', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-top-rated" options={{ title: 'Top Rated Albums', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-most-popular" options={{ title: 'Most Popular Albums', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-all-time-classics" options={{ title: 'All-Time Classics', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-recommended" options={{ title: 'Based on Your Taste', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-top-artists" options={{ title: 'Top Artists', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-top-songs" options={{ title: 'Top Songs', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-genres" options={{ title: 'Genres', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-decades" options={{ title: 'By Decade', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-decade-grid" options={{ headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-genre-grid" options={{ headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="my-listend" options={{ title: 'My Listend', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="my-playlists" options={{ title: 'My Playlists', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="playlist-detail" options={{ title: 'Playlist', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="playlist-add-albums" options={{ title: 'Add Albums', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="my-stats" options={{ title: 'My Stats', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="want-to-listen" options={{ title: 'Want to Listen', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="recent-listens" options={{ title: 'Recent Listens', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="my-reviews" options={{ title: 'My Reviews', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="user-profile" options={{ title: 'Profile', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="followers-following" options={{ title: '', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="artist-detail" options={{ title: '', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="dms" options={{ title: 'Messages', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="dm-conversation" options={{ title: '', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="sessions" options={{ title: 'Sessions', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="recent-activity" options={{ title: 'Recent Activity', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="popular-reviews" options={{ title: 'Popular Reviews This Week', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="liked-artists" options={{ title: 'Liked Artists', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="discover-featured-playlist" options={{ headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="liked-featured-playlists" options={{ title: 'Liked Playlists', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="privacy-settings" options={{ title: 'Privacy', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="blocked-users" options={{ title: 'Blocked Users', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
          <Stack.Screen name="pro-settings" options={{ title: 'Listend Pro', headerStyle: { backgroundColor: '#1c1410' }, headerTintColor: '#f5e6c8' }} />
        </Stack>
      </NavThemeProvider>
    </FlipProvider>
    </LikedFeaturedPlaylistsProvider>
    </LikedArtistsProvider>
    </AlbumsProvider>
    </NotificationsProvider>
    </ProProvider>
    </RevenueCatProvider>
    </AuthProvider>
    </AnalyticsProvider>
    </GestureHandlerRootView>
  );
}
