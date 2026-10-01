import { Platform, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Stands in for the native header back button on iOS 26+.
 *
 * react-native-screens 4.16.0 — the version Expo SDK 54 pins — stops
 * delivering taps to the native back button on iOS 26: it highlights when
 * pressed but never pops (software-mansion/react-native-screens#3294, fixed
 * in 4.17). Our root Stack hides the header on `(tabs)`, which is the
 * trigger, so every screen pushed from a tab is exposed. Reported 2026-09-30
 * from Discover → Top Rated → See More: the back chevron was dead and only a
 * swipe-back got out.
 *
 * Only the native button is deaf — the stack itself is healthy — so a JS
 * button calling goBack() sidesteps it, and ships by OTA with no native
 * change. Older iOS keeps the real native button. Remove this once
 * react-native-screens is >= 4.17 (needs a new native build).
 */
export const needsJsBackButton =
  Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

// The iOS 26 glass back button drew our cream header tint as pure white —
// match it so the swap is invisible. Light headers keep their own dark tint.
const DARK_HEADER_TINT = '#f5e6c8';

export function HeaderBackButton({ onPress, tintColor }: { onPress: () => void; tintColor?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => ({ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      {/* Sized and nudged left to sit where the native chevron did. */}
      <Ionicons
        name="chevron-back"
        size={29}
        color={tintColor?.toLowerCase() === DARK_HEADER_TINT ? '#fff' : tintColor}
        style={{ marginLeft: -3 }}
      />
    </Pressable>
  );
}
