import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * The platform's own share glyph (iOS square-and-arrow, Android three dots),
 * same as the share button next to DMs on your profile. Use this for every
 * share button so they all look alike.
 */
export function ShareIcon({ size = 20, color }: { size?: number; color: string }) {
  return <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={size} color={color} />;
}
