import { StyleSheet, View, Text, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps, ReactNode } from 'react';

// A headline stat: icon, number with its unit, plain label. Used under the
// hero on My Stats and Month / Year in Review. Replaced rows of numbers over
// small-caps labels that read like a spreadsheet.

export function StatTile({
  icon, value, unit, label, onPress, extra, tint, textColor, subtextColor, bg, border,
}: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  value: string | number;
  unit?: string;
  label: string;
  onPress?: () => void;
  extra?: ReactNode;
  tint: string; textColor: string; subtextColor: string; bg: string; border: string;
}) {
  const known = value !== '—' && value !== '…';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [st.tile, { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={st.iconWrap}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.14, borderRadius: 14 }]} />
        <FontAwesome name={icon} size={13} color={tint} />
      </View>
      <Text style={[st.value, { color: textColor }]} numberOfLines={1}>
        {value}
        {known && unit ? <Text style={[st.unit, { color: subtextColor }]}>{unit}</Text> : null}
      </Text>
      {extra}
      <Text style={[st.label, { color: subtextColor }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  tile:     { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  value:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  unit:     { fontSize: 13, fontWeight: '600', letterSpacing: 0 },
  // Pinned to the bottom so labels line up across a row (the rating tile's
  // volume meter makes it taller than its neighbours).
  label:    { fontSize: 12, fontWeight: '500', marginTop: 'auto' },
});
