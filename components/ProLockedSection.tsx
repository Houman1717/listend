import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePro } from '@/context/ProContext';
import type { LoggedAlbum } from '@/context/AlbumsContext';
import { CoverMosaic, mosaicCovers, MIN_MOSAIC_COVERS } from '@/components/CoverMosaic';

const ACCENT = '#D4A017';

/**
 * Wraps the part of a recap that only Pro users get. Free users see the real
 * content, clamped and faded behind a scrim, with an unlock CTA underneath —
 * a tease rather than a wall, so a push notification that opens the screen
 * still delivers something.
 *
 * Renders children untouched when `locked` is false, so Pro users pay nothing
 * for this being in the tree.
 */
export function ProLockedSection({
  locked,
  colors,
  title,
  sub,
  albums,
  children,
}: {
  locked: boolean;
  colors: { background: string; text: string; subtext: string };
  title: string;
  sub: string;
  /** The listener's albums: the unlock block sits on a mosaic of their covers. */
  albums?: LoggedAlbum[];
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;

  return (
    <View style={{ gap: 16 }}>
      {/* Clamped so the locked run doesn't become a mile of faded scroll */}
      <View style={{ maxHeight: 300, overflow: 'hidden' }}>
        {/* gap mirrors the parent ScrollView's, which children lose in here */}
        <View style={{ opacity: 0.26, gap: 16 }} pointerEvents="none">
          {children}
        </View>
        <LinearGradient
          colors={['transparent', colors.background]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 190 }}
          pointerEvents="none"
        />
      </View>

      <UnlockCard title={title} sub={sub} albums={albums} colors={colors} />
    </View>
  );
}

/**
 * The pitch under a locked preview: title, line, and "Unlock with Pro", on a
 * mosaic of the listener's own covers when they have enough. Shared by the
 * recaps and the My Stats free view.
 */
export function UnlockCard({
  title,
  sub,
  albums,
  colors,
}: {
  title: string;
  sub: string;
  albums?: LoggedAlbum[];
  colors: { text: string; subtext: string };
}) {
  const { showPaywall } = usePro();
  const covers = albums ? mosaicCovers(albums) : [];
  const mosaic = covers.length >= MIN_MOSAIC_COVERS;

  return (
    <View style={[
      { alignItems: 'center', gap: 6 },
      mosaic ? { borderRadius: 14, overflow: 'hidden', padding: 20, paddingTop: 26 } : { marginTop: -8 },
    ]}>
      {mosaic && <CoverMosaic covers={covers} dim={0.72} />}
      <Text style={{ color: mosaic ? '#FFFFFF' : colors.text, fontSize: mosaic ? 19 : 16, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 }}>
        {title}
      </Text>
      <Text style={{ color: mosaic ? 'rgba(255,255,255,0.85)' : colors.subtext, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8 }}>
        {sub}
      </Text>
      <Pressable
        onPress={showPaywall}
        style={({ pressed }) => ({ alignSelf: 'stretch', marginTop: 8, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
          <Text style={{ color: '#0F0A07', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 }}>
            Unlock with Pro
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
