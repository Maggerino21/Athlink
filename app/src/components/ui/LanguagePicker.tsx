/**
 * LanguagePicker — pick a language from a list that will not stay short.
 *
 * Closed it is one row showing the current choice. Open it is a search box and
 * the matching languages, **in place**: the list expands inside whatever is
 * already on screen rather than opening a second sheet. That is deliberate —
 * iOS presents one modal at a time, and a picker that opens its own modal from
 * inside the signup sheet would be dropped silently (the sheet-switch links hit
 * exactly that bug).
 *
 * Reads `LANGUAGES`, so it is a two-language toggle today and a searchable list
 * of fifteen the moment the list grows, with no change here.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { languageFor, searchLanguages } from '../../i18n/languages';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { UI_FONT, UI_FONT_REGULAR } from '../../utils/type';

export default function LanguagePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Search field placeholder, e.g. "Search languages…". */
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const current = languageFor(value);
  const results = searchLanguages(query);

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.wrap}>
      <PressableScale
        style={styles.field}
        scaleTo={0.99}
        haptic="selection"
        onPress={() => { setOpen(o => !o); setQuery(''); }}
      >
        <Text style={styles.value}>{current.native}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={TEXT.tertiary}
        />
      </PressableScale>

      {open ? (
        <Animated.View
          style={styles.panel}
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
        >
          {/* Always here, however short the list is today: typing the first
              letters of your own language is faster than reading a list in an
              alphabet you are scanning past, and the list only grows. */}
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={TEXT.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            autoFocus
          />

          <ScrollView
            style={{ maxHeight: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.map(l => (
              <PressableScale
                key={l.code}
                style={[styles.row, l.code === value && styles.rowActive]}
                scaleTo={0.99}
                haptic="selection"
                onPress={() => pick(l.code)}
              >
                <Text style={styles.rowNative}>{l.native}</Text>
                {/* The English name only earns its place when it says something
                    the native name does not. */}
                {l.english !== l.native ? (
                  <Text style={styles.rowEnglish}>{l.english}</Text>
                ) : null}
                {l.code === value ? (
                  <Ionicons name="checkmark" size={16} color={TEXT.primary} style={{ marginLeft: 'auto' }} />
                ) : null}
              </PressableScale>
            ))}
            {results.length === 0 ? (
              <Text style={styles.empty}>—</Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15,
    borderRadius: RADIUS.md,
    backgroundColor: SURFACE.raised,
  },
  value: { fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.primary },

  panel: { borderRadius: RADIUS.md, backgroundColor: SURFACE.raised, overflow: 'hidden' },
  search: {
    fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.primary,
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: SURFACE.recessed,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rowActive: { backgroundColor: SURFACE.active },
  rowNative:  { fontFamily: UI_FONT, fontSize: 15, color: TEXT.primary },
  rowEnglish: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary },
  empty: {
    fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.tertiary,
    textAlign: 'center', paddingVertical: 18,
  },
});
