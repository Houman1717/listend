import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { top } = useSafeAreaInsets();
  const BANNER_H = top + 36;
  const translateY = useRef(new Animated.Value(-BANNER_H)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOnline ? -BANNER_H : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [isOnline, BANNER_H]);

  return (
    <Animated.View style={[s.banner, { paddingTop: top, height: BANNER_H, transform: [{ translateY }] }]}>
      <FontAwesome name="wifi" size={13} color="#fff" />
      <Text style={s.text}>No internet connection</Text>
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
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
