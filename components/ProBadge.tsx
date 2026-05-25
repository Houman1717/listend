import { View, Text, StyleSheet } from 'react-native';

export function ProBadge({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const isXs = size === 'xs';
  return (
    <View style={[styles.badge, isXs && styles.badgeXs]}>
      <Text style={[styles.text, isXs && styles.textXs]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#D4A017',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  badgeXs: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  text: {
    color: '#0F0A07',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  textXs: {
    fontSize: 8,
    letterSpacing: 0.4,
  },
});
