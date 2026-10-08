import React from 'react';
import { StyleSheet, Text } from 'react-native';

type CreditSong = { title: string; artist: string } | null | undefined;

// One wrapping line under the Top 5 Songs covers: "1 Title Artist · 2 Title Artist …".
// Wraps instead of truncating so every title and artist survives a screenshot.
// Ranks follow slot position, so a gap in the row keeps the numbers matching the covers.
export default function TopSongsCredits({
  songs,
  colors,
  onSongPress,
}: {
  songs: CreditSong[];
  colors: { text: string; subtext: string; textMuted: string; tint: string };
  onSongPress?: (index: number) => void;
}) {
  const filled = songs
    .map((song, i) => (song ? { song, i } : null))
    .filter((x): x is { song: NonNullable<CreditSong>; i: number } => !!x);

  if (filled.length === 0) return null;

  return (
    <Text style={s.line}>
      {filled.map(({ song, i }, n) => (
        <React.Fragment key={i}>
          {n > 0 && <Text style={{ color: colors.textMuted }}>{'  ·  '}</Text>}
          <Text onPress={onSongPress ? () => onSongPress(i) : undefined}>
            <Text style={[s.rank, { color: colors.tint }]}>{i + 1}</Text>
            <Text style={{ color: colors.text }}>{' '}{song.title}</Text>
            {!!song.artist && <Text style={{ color: colors.subtext }}>{'  '}{song.artist}</Text>}
          </Text>
        </React.Fragment>
      ))}
    </Text>
  );
}

const s = StyleSheet.create({
  line: { fontSize: 12, lineHeight: 19, marginTop: 10 },
  rank: { fontWeight: '700' },
});
