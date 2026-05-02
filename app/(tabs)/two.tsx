import { StyleSheet, View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.avatar, { backgroundColor: '#D4A017' }]}>
        <Text style={styles.avatarInitial}>H</Text>
      </View>
      <Text style={[styles.username, { color: colors.text }]}>@houman</Text>
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>6</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Albums</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colorScheme === 'dark' ? '#3a2818' : '#ddd' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>4.5</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>Avg Rating</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  username: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
  },
  divider: {
    width: 1,
    height: 36,
  },
});
