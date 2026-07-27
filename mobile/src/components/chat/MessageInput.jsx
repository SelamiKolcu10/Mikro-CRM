import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';

/**
 * Mesaj yazma çubuğu — kilit düğmesi "dahili not" moduna geçirir (not müşteriye
 * gitmez). `onSendNote` verilmezse kilit düğmesi hiç render edilmez, böylece
 * ileride müşteri tarafı için de yeniden kullanılabilir (web'deki aynı desen).
 */
export default function MessageInput({ onSend, onSendNote, disabled }) {
  const [value, setValue] = useState('');
  const [noteMode, setNoteMode] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (noteMode && onSendNote) onSendNote(trimmed);
    else onSend(trimmed);
    setValue('');
  };

  return (
    <View style={[styles.bar, noteMode && styles.barNote]}>
      {!!onSendNote && (
        <TouchableOpacity
          style={[styles.noteToggle, noteMode && styles.noteToggleActive]}
          onPress={() => setNoteMode((v) => !v)}
          hitSlop={6}
        >
          <Ionicons
            name={noteMode ? 'lock-closed' : 'lock-open-outline'}
            size={18}
            color={noteMode ? '#B45309' : colors.textMuted}
          />
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={noteMode ? 'Dahili not (müşteri görmez)...' : 'Mesaj yazın...'}
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={2000}
        editable={!disabled}
      />

      <TouchableOpacity
        style={[styles.sendBtn, noteMode && styles.sendBtnNote, (!value.trim() || disabled) && styles.sendDisabled]}
        onPress={submit}
        disabled={!value.trim() || disabled}
        activeOpacity={0.85}
      >
        <Ionicons name={noteMode ? 'bookmark' : 'send'} size={17} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barNote: { backgroundColor: colors.warnSoft },

  noteToggle: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.bg,
  },
  noteToggleActive: { backgroundColor: '#F8E3BD' },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: font.md,
    color: colors.text,
  },

  sendBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  sendBtnNote: { backgroundColor: '#B45309' },
  sendDisabled: { opacity: 0.45 },
});
