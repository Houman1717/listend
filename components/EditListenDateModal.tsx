import { StyleSheet, View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoggedAlbum, useAlbums } from '@/context/AlbumsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Which specific listen is being retargeted — null means the original
// user_albums row, otherwise the exact re_listens.listened_at being moved.
type ListenOption = { targetListenedAt: string | null; label: string; currentDate: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function EditListenDateModal({
  album,
  isDark,
  colors,
  onClose,
}: {
  album: LoggedAlbum;
  isDark: boolean;
  colors: any;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { updateListenedDate } = useAlbums();
  const insets = useSafeAreaInsets();
  const border = isDark ? '#2a1e14' : '#e5e5e5';

  const [loadingOptions, setLoadingOptions] = useState(album.isRelistened ?? false);
  const [options, setOptions] = useState<ListenOption[]>([]);
  const [chosen, setChosen] = useState<ListenOption | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!album.isRelistened || !user) {
      // Single listen — nothing to pick, go straight to the date step.
      const only: ListenOption = { targetListenedAt: null, label: 'Listened on', currentDate: album.dateLogged };
      setChosen(only);
      setDate(new Date(album.dateLogged));
      return;
    }

    supabase
      .from('re_listens')
      .select('listened_at')
      .eq('user_id', user.id)
      .eq('spotify_id', album.id)
      .order('listened_at', { ascending: false })
      .then(({ data }) => {
        const reListenOpts: ListenOption[] = (data ?? []).map((r, i) => ({
          targetListenedAt: r.listened_at,
          label: i === 0 ? 'Latest re-listen' : `Re-listen`,
          currentDate: r.listened_at,
        }));
        setOptions([
          { targetListenedAt: null, label: 'Original listen', currentDate: album.dateLogged },
          ...reListenOpts,
        ]);
        setLoadingOptions(false);
      });
  }, [album.id, album.isRelistened, album.dateLogged, user?.id]);

  function selectOption(opt: ListenOption) {
    setChosen(opt);
    setDate(new Date(opt.currentDate));
  }

  async function handleSave() {
    if (!chosen || !date) return;
    setSaving(true);
    const ok = await updateListenedDate(album.id, chosen.targetListenedAt, date);
    setSaving(false);
    if (ok) onClose();
  }

  const showPicker = chosen !== null;
  const showOptionList = !showPicker && !loadingOptions && options.length > 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[s.header, { borderBottomColor: border }]}>
            <Pressable onPress={chosen && options.length > 0 ? () => setChosen(null) : onClose} hitSlop={12}>
              <FontAwesome
                name={chosen && options.length > 0 ? 'chevron-left' : 'close'}
                size={16}
                color={isDark ? '#A08060' : '#6B4C35'}
              />
            </Pressable>
            <Text style={[s.headerTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>Edit Listen Date</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={[s.albumTitle, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]} numberOfLines={1}>
              {album.title}
            </Text>
            <Text style={[s.albumArtist, { color: isDark ? '#A08060' : '#6B4C35' }]} numberOfLines={1}>
              {album.artist}
            </Text>

            {loadingOptions && (
              <ActivityIndicator style={{ marginTop: 24 }} color="#D4A017" />
            )}

            {showOptionList && (
              <View style={{ marginTop: 20, gap: 10 }}>
                <Text style={[s.sectionLabel, { color: colors.subtext }]}>
                  This album has been re-listened to. Which listen do you want to edit?
                </Text>
                {options.map(opt => (
                  <Pressable
                    key={opt.targetListenedAt ?? 'original'}
                    onPress={() => selectOption(opt)}
                    style={({ pressed }) => [
                      s.optionRow,
                      { borderColor: border, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <View>
                      <Text style={[s.optionLabel, { color: isDark ? '#f5e6c8' : '#1A0F0A' }]}>{opt.label}</Text>
                      <Text style={[s.optionDate, { color: colors.subtext }]}>{formatDate(opt.currentDate)}</Text>
                    </View>
                    <FontAwesome name="chevron-right" size={13} color={colors.subtext} />
                  </Pressable>
                ))}
              </View>
            )}

            {chosen && date && (
              <View style={{ marginTop: 20, alignItems: 'center' }}>
                {options.length > 0 && (
                  <Text style={[s.sectionLabel, { color: colors.subtext, alignSelf: 'flex-start' }]}>
                    {chosen.label}
                  </Text>
                )}
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="inline"
                  maximumDate={new Date()}
                  onChange={(_, d) => d && setDate(d)}
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor="#D4A017"
                  style={{ width: '100%' }}
                />

                <Pressable
                  style={[s.saveButton, { backgroundColor: '#D4A017', opacity: saving ? 0.6 : 1 }]}
                  onPress={handleSave}
                  disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.saveButtonText}>Save Date</Text>}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20 },
  albumTitle: { fontSize: 16, fontWeight: '700' },
  albumArtist: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 13, marginBottom: 4, lineHeight: 18 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 10,
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionDate: { fontSize: 12, marginTop: 2 },
  saveButton: {
    marginTop: 20, width: '100%', height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
