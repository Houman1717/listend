import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useBackendUnhealthy } from '@/lib/backendHealth';

// Two distinct failures the user needs told apart:
//   • the phone has no connection           → "No internet connection"
//   • the phone is fine, our backend isn't  → "showing saved data"
// The second used to be invisible: during the 2026-08-28 Supabase outage the
// device had full signal, so every screen rendered 0s and empty lists with no
// explanation — which reads as "all my data is gone". Saying it out loud is
// most of the fix.
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const backendUnhealthy = useBackendUnhealthy();
  const { top } = useSafeAreaInsets();
  const BANNER_H = top + 36;
  const translateY = useRef(new Animated.Value(-BANNER_H)).current;

  const offline = !isOnline;
  const visible = offline || backendUnhealthy;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -BANNER_H,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible, BANNER_H]);

  return (
    <Animated.View style={[s.banner, { paddingTop: top, height: BANNER_H, transform: [{ translateY }] }]}>
      <FontAwesome name={offline ? 'wifi' : 'exclamation-triangle'} size={13} color="#fff" />
      <Text style={s.text} numberOfLines={1}>
        {offline ? 'No internet connection' : 'Trouble reaching Listend — showing saved data'}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
