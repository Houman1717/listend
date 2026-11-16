import { useLocalSearchParams } from 'expo-router';
import { ChartListGrid } from '@/components/ChartListGrid';

export default function DecadeGridScreen() {
  const { decade } = useLocalSearchParams<{ decade: string }>();
  return <ChartListGrid kind="decade" label={decade ?? ''} title={decade || 'Decade'} />;
}
