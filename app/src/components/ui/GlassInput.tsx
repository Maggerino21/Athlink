import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface GlassInputProps extends TextInputProps {
  label: string;
  error?: string;
  secure?: boolean;
}

export default function GlassInput({ label, error, secure, ...props }: GlassInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, !!error && styles.inputWrapError]}>
        {/* Top specular */}
        <View style={styles.topSpec} />

        <TextInput
          style={styles.input}
          placeholderTextColor="rgba(255,255,255,0.25)"
          selectionColor="#3B82F6"
          secureTextEntry={secure && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapFocused: {
    borderColor: 'rgba(59,130,246,0.6)',
    backgroundColor: 'rgba(59,130,246,0.07)',
  },
  inputWrapError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  topSpec: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
