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
import Ionicons from '@expo/vector-icons/Ionicons';

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
          style={[styles.input, style]}
          placeholderTextColor="rgba(255,255,255,0.28)"
          selectionColor="#3B82F6"
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
              color="rgba(255,255,255,0.35)"
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    // Explicit dark background — prevents iOS autofill yellow from making
    // the field unreadable. rgba(0,0,0,x) on dark bg = barely visible but
    // opaque enough that iOS respects it as the base layer.
    backgroundColor: 'rgba(15,18,40,0.85)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapFocused: {
    borderColor: 'rgba(59,130,246,0.5)',
    backgroundColor: 'rgba(10,25,60,0.88)',
  },
  inputWrapError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // Explicit background on the TextInput node itself — must match wrapper.
    // iOS autofill yellow is applied as a system overlay; having an explicit
    // opaque background here means it blends to dark amber instead of bright
    // yellow, keeping white text readable.
    backgroundColor: 'rgba(15,18,40,0.85)',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#FCA5A5',
    marginTop: 2,
  },
});
