import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type CreditSong = { title: string; artist: string } | null | undefined;

// Under the Top 5 Songs covers: one "Title – Artist" line per song, in cover order.
// Long names wrap instead of truncating so every title and artist survives a screenshot.
export default function TopSongsCredits({
  songs,
  colors,
  onSongPress,
}: {
  songs: CreditSong[];
  colors: { text: string; subtext: string };
  onSongPress?: (index: number) => void;
}) {
  if (!songs.some(Boolean)) return null;

  return (
    <View style={s.list}>
      {songs.map((song, i) => song && (
        <Text key={i} style={s.line} onPress={onSongPress ? () => onSongPress(i) : undefined}>
          <Text style={{ color: colors.text }}>{song.title}</Text>
          {!!song.artist && <Text style={{ color: colors.subtext }}>{' – '}{song.artist}</Text>}
        </Text>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { marginTop: 10 },
  line: { fontSize: 12, lineHeight: 19 },
});
