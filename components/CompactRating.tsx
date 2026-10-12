import { View, Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Rating for lists of songs: just the speaker and the number. The full Volume
// bars are kept for single-song views, so long tracklists stay calm.
// Whole numbers for one person's rating, one decimal for an average.
export function CompactRating({ value, average = false, color = '#D4A017', size = 12 }: {
  value: number;
  average?: boolean;
  color?: string;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <FontAwesome name="volume-up" size={size - 1} color={color} />
      <Text style={{ color, fontSize: size, fontWeight: '700' }}>{average ? value.toFixed(1) : value}</Text>
    </View>
  );
}
