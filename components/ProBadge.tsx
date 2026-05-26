import Ionicons from '@expo/vector-icons/Ionicons';

export function ProBadge({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  return <Ionicons name="checkmark-circle" size={size === 'xs' ? 13 : 16} color="#D4A017" />;
}
