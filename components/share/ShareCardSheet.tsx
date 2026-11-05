import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator, useWindowDimensions, Alert } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { capture } from '@/lib/analytics';
import { CARD_W, CARD_H } from '@/components/share/ShareCards';

// Full-screen preview of a share card with one Share button. The card renders
// at its real size (CARD_W x CARD_H) inside a scaled wrapper, so the capture
// is always the same 1080x1920 image whatever the phone. iOS's share sheet
// covers Instagram, Messages, WhatsApp and "Save Image".
//
// No router in here (Modal): actions that navigate are callbacks from the parent.

const GOLD = '#D4A017';

let cachedHandle: { userId: string; handle: string } | null = null;

function useOwnHandle(): string {
  const { user } = useAuth();
  const [handle, setHandle] = useState(cachedHandle?.userId === user?.id ? cachedHandle!.handle : '');
  useEffect(() => {
    if (!user?.id || (cachedHandle?.userId === user.id && cachedHandle.handle)) return;
    let cancelled = false;
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle().then(({ data }) => {
      const h = (data as any)?.username ?? '';
      if (h) cachedHandle = { userId: user.id, handle: h };
      if (!cancelled) setHandle(h);
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  return handle;
}

export function ShareCardSheet({ visible, onClose, kind, images, renderCard, note, options, selected, onSelect }: {
  visible: boolean;
  onClose: () => void;
  /** Analytics name: 'year' | 'month' | 'review' | 'top5' | 'streak'. */
  kind: string;
  /** Image URLs on the card; Share waits until they're loaded. */
  images: string[];
  renderCard: (handle: string) => React.ReactNode;
  /** Optional line under the buttons, e.g. the Pro upsell on a free recap. */
  note?: { text: string; action: string; onPress: () => void };
  /** Optional picker above the card (Top 5: albums / artists / songs / all). */
  options?: { key: string; label: string }[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const handle = useOwnHandle();
  const { width, height } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load the covers before allowing a capture, or they come out blank.
  const imagesKey = images.join('|');
  useEffect(() => {
    if (!visible) return;
    setReady(false);
    let done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const giveUp = setTimeout(finish, 4000);
    (images.length ? ExpoImage.prefetch(images, 'memory-disk') : Promise.resolve(true))
      .catch(() => false)
      .then(() => setTimeout(finish, 250));   // a beat for the views to paint
    capture('share_card_opened', { kind });
    return () => { done = true; clearTimeout(giveUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, imagesKey]);

  const hasPicker = !!options && options.length > 1;
  const scale = Math.min((width - 48) / CARD_W, (height - (hasPicker ? 370 : 310)) / CARD_H, 1);

  async function share() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      // JPEG: a 1080x1920 PNG of album covers came out at 12 MB.
      const uri = await captureRef(cardRef, {
        format: 'jpg', quality: 0.92, width: 1080, height: 1920, result: 'tmpfile',
      });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing isn’t available on this device');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share' });
      capture('share_card_shared', { kind });
    } catch (e: any) {
      console.warn('[share-card]', e?.message ?? e);
      Alert.alert('Couldn’t create the image', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', paddingVertical: 50 }}>
        {hasPicker && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {options!.map(o => {
              const on = o.key === selected;
              return (
                <Pressable key={o.key} onPress={() => onSelect?.(o.key)} hitSlop={4}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
                    backgroundColor: on ? GOLD : 'rgba(255,255,255,0.12)', opacity: pressed ? 0.75 : 1,
                  })}>
                  <Text style={{ color: on ? '#0F0A07' : '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ width: CARD_W * scale, height: CARD_H * scale, borderRadius: 16, overflow: 'hidden' }}>
          <View style={{
            width: CARD_W, height: CARD_H,
            transform: [{ translateX: -(CARD_W * (1 - scale)) / 2 }, { translateY: -(CARD_H * (1 - scale)) / 2 }, { scale }],
          }}>
            <View ref={cardRef} collapsable={false} style={{ width: CARD_W, height: CARD_H }}>
              {renderCard(handle)}
            </View>
          </View>
        </View>

        <View style={{ width: CARD_W * scale, marginTop: 20, gap: 10 }}>
          <Pressable
            onPress={share}
            disabled={!ready || busy}
            style={({ pressed }) => ({
              backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
              opacity: !ready || busy ? 0.6 : pressed ? 0.85 : 1,
            })}>
            {(!ready || busy) && <ActivityIndicator size="small" color="#0F0A07" />}
            <Text style={{ color: '#0F0A07', fontSize: 16, fontWeight: '800' }}>
              {!ready ? 'Getting it ready…' : 'Share'}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={6} style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' }}>Close</Text>
          </Pressable>
          {note && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
              {note.text}{' '}
              <Text onPress={note.onPress} style={{ color: GOLD, fontWeight: '700' }}>{note.action}</Text>
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
