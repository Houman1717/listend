import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type CreditSong = { title: string; artist: string; artworkUrl?: string } | null | undefined;

const THUMB = 24;

// Catalog noise that only lengthens a title: "(Original)", "(Remastered 2011)",
// "- 2009 Remaster", "- Single Version"… Featured artists, remixes and live tags are kept.
const NOISE =
  '(?:original(?: version| mix)?|(?:\\d{4} )?remaster(?:ed)?(?: \\d{4})?(?: version)?|single(?: version)?|album version|explicit|clean|bonus track|deluxe(?: edition)?|mono|stereo)';
const BRACKETED_NOISE = new RegExp(`\\s*[(\\[]${NOISE}[)\\]]`, 'gi');
const DASHED_NOISE = new RegExp(`\\s+-\\s+${NOISE}$`, 'i');

export function cleanSongTitle(title: string): string {
  const cleaned = title.replace(BRACKETED_NOISE, '').replace(DASHED_NOISE, '').trim();
  return cleaned || title;
}

// Top 5 Songs as a tracklist: one pressable row per song, in slot order.
// Long names wrap instead of truncating so every title and artist survives a screenshot.
export default function TopSongsCredits({
  songs,
  colors,
  onSongPress,
  onAddPress,
}: {
  songs: CreditSong[];
  colors: { text: string; textMuted: string; border: string; tint: string; card?: string; surface?: string };
  onSongPress?: (index: number) => void;
  // Own profile only: with no songs picked, show an invite row instead of nothing.
  onAddPress?: () => void;
}) {
  const filled = songs
    .map((song, i) => (song ? { song, i } : null))
    .filter((x): x is { song: NonNullable<CreditSong>; i: number } => !!x);

  if (filled.length === 0) {
    if (!onAddPress) return null;
    return (
      <Pressable onPress={onAddPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
        <View style={[s.thumb, s.addThumb, { borderColor: colors.border }]}>
          <FontAwesome name="plus" size={10} color={colors.tint} />
        </View>
        <Text style={[s.line, { color: colors.textMuted }]}>Add your top 5 songs</Text>
      </Pressable>
    );
  }

  return (
    <View>
      {filled.map(({ song, i }, n) => (
        <Pressable
          key={i}
          onPress={onSongPress ? () => onSongPress(i) : undefined}
          style={({ pressed }) => [
            s.row,
            n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            pressed && { opacity: 0.6 },
          ]}>
          {song.artworkUrl ? (
            <ExpoImage source={{ uri: song.artworkUrl }} style={s.thumb} contentFit="cover" cachePolicy="disk" />
          ) : (
            <View style={[s.thumb, { backgroundColor: colors.card ?? colors.surface ?? colors.border }]} />
          )}
          <Text style={s.line}>
            <Text style={{ color: colors.text }}>{cleanSongTitle(song.title)}</Text>
            {!!song.artist && <Text style={{ color: colors.textMuted }}>{' – '}{song.artist}</Text>}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, paddingVertical: 6 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 2 },
  addThumb: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  line:  { flex: 1, fontSize: 13, lineHeight: 18 },
});
