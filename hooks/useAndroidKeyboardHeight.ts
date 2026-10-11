import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// With edgeToEdgeEnabled, Android never resizes the window for the keyboard —
// and RN 0.81 makes every <Modal> window edge-to-edge too, so a
// KeyboardAvoidingView without a behavior just lets the keys cover the input.
// Pad the bottom by this instead (0 on iOS, and 0 once the keyboard closes).
//
// The height is measured from the top of the navigation bar, so a layout that
// doesn't already sit above insets.bottom needs that added on top.
export function useAndroidKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onShow = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const onHide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  return keyboardHeight;
}
