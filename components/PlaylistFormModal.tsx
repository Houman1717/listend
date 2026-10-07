import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { ColorsShape } from '@/constants/Colors';

// Bottom sheet for a playlist's name + description — used to create one
// (My Playlists) and to edit one (playlist detail). Colours come in as a prop
// so the sheet follows the screen's pro theme.

export default function PlaylistFormModal({
  visible,
  title,
  submitLabel,
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
  colors,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
  colors: ColorsShape;
}) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);

  // Start from the current values each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDesc(initialDescription);
    }
  }, [visible]);

  const canSubmit = !!name.trim();
  const inputColors = {
    color: colors.text,
    backgroundColor: colors.isDark ? colors.background : colors.elevated,
    borderColor: colors.border,
  };

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(name.trim(), desc.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}>
        <Pressable style={[StyleSheet.absoluteFill, s.backdrop]} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>

          <Text style={[s.label, { color: colors.subtext }]}>Name</Text>
          <TextInput
            style={[s.input, inputColors]}
            placeholder="e.g. Summer Road Trip"
            placeholderTextColor={colors.subtext}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />

          <Text style={[s.label, { color: colors.subtext, marginTop: 16 }]}>
            Description <Text style={{ fontWeight: '400' }}>(optional)</Text>
          </Text>
          <TextInput
            style={[s.input, s.inputMulti, inputColors]}
            placeholder="What's this list about?"
            placeholderTextColor={colors.subtext}
            value={desc}
            onChangeText={setDesc}
            multiline
            textAlignVertical="top"
            maxLength={200}
          />

          <Pressable
            style={[s.submitBtn, { backgroundColor: canSubmit ? colors.tint : colors.border }]}
            onPress={handleSubmit}
            disabled={!canSubmit}>
            <Text style={[s.submitText, { color: canSubmit ? '#fff' : colors.subtext }]}>
              {submitLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  submitBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '600' },
});
