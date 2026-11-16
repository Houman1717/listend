import { useLocalSearchParams } from 'expo-router';
import { ChartListGrid } from '@/components/ChartListGrid';

// "Reggaeton" is the list key; the chip and the header say "Latin".
const GENRE_DISPLAY_NAMES: Record<string, string> = { 'Reggaeton': 'Latin' };

export default function GenreGridScreen() {
  const { genre } = useLocalSearchParams<{ genre: string }>();
  const label = genre ?? '';
  return <ChartListGrid kind="genre" label={label} title={GENRE_DISPLAY_NAMES[label] ?? (label || 'Genre')} />;
}
