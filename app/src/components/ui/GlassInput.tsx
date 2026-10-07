import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SURFACE, TEXT, LINE, RADIUS } from '../../utils/tokens';
import { UI_FONT, UI_FONT_REGULAR } from '../../utils/type';

/** Matches the landing screen's error red. The only red on these screens. */
const ERROR = '#E5484D';

interface GlassInputProps extends TextInputProps {
  label: string;
  error?: string;
  secure?: boolean;
}

export default function GlassInput({ label, error, secure, style, ...props }: GlassInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={[
        styles.inputWrap,
        focused && styles.inputWrapFocused,
        !!error && styles.inputWrapError,
      ]}>
        <TextInput
          style={[styles.input, focused && styles.inputFocused, style]}
          placeholderTextColor={TEXT.faint}
          selectionColor={TEXT.secondary}
          secureTextEntry={secure && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance="dark"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // iOS autofill turns the field yellow — setting an explicit
          // backgroundColor on the TextInput itself overrides it.
          // Must match the wrapper bg so it's invisible normally.
          {...props}
        />

        {secure && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setVisible(v => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={TEXT.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  label: {
    fontFamily: UI_FONT, fontSize: 11, color: TEXT.tertiary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  inputWrap: {
    borderRadius: RADIUS.md,
    // Opaque, and stated twice — see the TextInput's own background below.
    backgroundColor: SURFACE.raised,
    // Carried unfocused as well, transparent: a border that only appears on
    // focus resizes the box and nudges the text by a pixel as you tap in.
    borderWidth: 1, borderColor: 'transparent',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Focus is brightness and an edge, not a colour. */
  inputWrapFocused: {
    backgroundColor: SURFACE.active,
    borderWidth: 1, borderColor: LINE.active,
  },
  inputWrapError: { borderWidth: 1, borderColor: ERROR },
  input: {
    flex: 1,
    fontFamily: UI_FONT_REGULAR, fontSize: 16,
    color: TEXT.primary,
    paddingHorizontal: 16, paddingVertical: 15,
    // Explicit background on the TextInput node itself — must match the
    // wrapper. iOS autofill yellow is a system overlay; an opaque background
    // here blends it to dark amber instead of bright yellow, so white text
    // stays readable.
    backgroundColor: SURFACE.raised,
  },
  /**
   * The focused fill has to be repeated here. The wrapper brightens, but the
   * TextInput carries its own opaque background for the autofill trick above,
   * and leaving that one behind drew a visible seam against the eye button.
   */
  inputFocused: { backgroundColor: SURFACE.active },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  errorText: { fontFamily: UI_FONT_REGULAR, fontSize: 12, color: ERROR, marginTop: 2 },
});
