/**
 * WheelEditorScreen — make or change a wheel.
 *
 * Name, forfeit or reward, how many items (2–10), then the items themselves.
 * The preview at the top redraws as you type, with every item already on it
 * twice, so the botsjef sees the wheel the squad will get rather than a form.
 *
 * PROTOTYPE: saved to memory only — see `useWheels`.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import WheelGraphic from '../../components/athlete/WheelGraphic';
import {
  getWheel, saveWheel, deleteWheel, MIN_ITEMS, MAX_ITEMS, type WheelKind,
} from '../../components/athlete/useWheels';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, UI_FONT, UI_FONT_REGULAR } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'WheelEditor'>;

export default function WheelEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const existing = route.params?.wheelId ? getWheel(route.params.wheelId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<WheelKind>(existing?.kind ?? 'forfeit');
  const [items, setItems] = useState<string[]>(existing?.items ?? ['', '', '', '']);

  const setCount = (n: number) => {
    const next = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, n));
    if (next === items.length) return;
    haptics.selection();
    setItems(prev => (next > prev.length ? [...prev, ...Array(next - prev.length).fill('')] : prev.slice(0, next)));
  };

  const filled = items.map(s => s.trim());
  const ready = name.trim().length > 0 && filled.every(Boolean);
  // Empty slots still show on the preview, as numbered placeholders.
  const preview = filled.map((s, i) => s || `${i + 1}`);

  const save = () => {
    if (!ready) return;
    saveWheel({ id: existing?.id, name: name.trim(), kind, items: filled });
    haptics.success();
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('wheel.deleteTitle'), t('wheel.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('wheel.delete'), style: 'destructive', onPress: () => { deleteWheel(existing.id); navigation.goBack(); } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={styles.header}>
        <Text style={styles.title}>{existing ? t('wheel.editTitle') : t('wheel.newTitle')}</Text>
        <PressableScale style={styles.close} scaleTo={0.9} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={18} color={TEXT.secondary} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.preview}>
          <WheelGraphic items={preview} size={180} />
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('wheel.namePlaceholder')}
          placeholderTextColor={TEXT.faint}
          style={[styles.input, styles.nameInput]}
          maxLength={40}
        />

        <View style={styles.segment}>
          {(['forfeit', 'reward'] as const).map(k => (
            <PressableScale key={k} style={[styles.segmentBtn, kind === k && styles.segmentOn]} scaleTo={0.96}
              onPress={() => setKind(k)}>
              <Text style={[styles.segmentText, kind === k && styles.segmentTextOn]}>
                {k === 'reward' ? t('wheel.reward') : t('wheel.forfeit')}
              </Text>
            </PressableScale>
          ))}
        </View>

        <View style={styles.countRow}>
          <View>
            <Text style={styles.countLabel}>{t('wheel.howMany')}</Text>
            <Text style={styles.countHint}>{t('wheel.twiceHint')}</Text>
          </View>
          <View style={styles.stepper}>
            <PressableScale style={styles.stepBtn} scaleTo={0.9} haptic="none" onPress={() => setCount(items.length - 1)}>
              <Ionicons name="remove" size={18} color={items.length > MIN_ITEMS ? TEXT.primary : TEXT.faint} />
            </PressableScale>
            <Text style={styles.count}>{items.length}</Text>
            <PressableScale style={styles.stepBtn} scaleTo={0.9} haptic="none" onPress={() => setCount(items.length + 1)}>
              <Ionicons name="add" size={18} color={items.length < MAX_ITEMS ? TEXT.primary : TEXT.faint} />
            </PressableScale>
          </View>
        </View>

        {items.map((value, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemNo}>{i + 1}</Text>
            <TextInput
              value={value}
              onChangeText={v => setItems(prev => prev.map((x, j) => (j === i ? v : x)))}
              placeholder={kind === 'reward' ? t('wheel.rewardPlaceholder') : t('wheel.forfeitPlaceholder')}
              placeholderTextColor={TEXT.faint}
              style={[styles.input, styles.itemInput]}
              maxLength={40}
              returnKeyType="next"
            />
          </View>
        ))}

        {existing && (
          <PressableScale style={styles.deleteBtn} scaleTo={0.97} onPress={remove}>
            <Text style={styles.deleteText}>{t('wheel.delete')}</Text>
          </PressableScale>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <PressableScale style={[styles.primary, !ready && styles.disabled]} scaleTo={0.97} haptic="none" onPress={save}>
          <Text style={styles.primaryText}>{t('wheel.save')}</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 24, paddingRight: 16, paddingTop: 22, paddingBottom: 6,
  },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  close: {
    width: 32, height: 32, borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  preview: { alignItems: 'center', paddingVertical: 12 },

  input: {
    height: 50, borderRadius: RADIUS.md, backgroundColor: SURFACE.raised,
    paddingHorizontal: 16, fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.primary,
  },
  nameInput: { fontFamily: UI_FONT },

  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised },
  segmentBtn: { flex: 1, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: TEXT.primary },
  segmentText: { fontFamily: UI_FONT, fontSize: 14, color: TEXT.secondary },
  segmentTextOn: { color: SURFACE.base },

  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4,
  },
  countLabel: { fontFamily: UI_FONT, fontSize: 15, color: TEXT.primary },
  countHint: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised, padding: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  count: { width: 28, textAlign: 'center', fontFamily: UI_FONT, fontSize: 17, color: TEXT.primary },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemNo: { width: 20, textAlign: 'right', fontFamily: UI_FONT, fontSize: 14, color: TEXT.tertiary },
  itemInput: { flex: 1 },

  deleteBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 8 },
  // No danger colour in the tokens; the Alert carries the warning.
  deleteText: { fontFamily: UI_FONT, fontSize: 15, color: TEXT.secondary },

  footer: { paddingHorizontal: 8, paddingTop: 10, backgroundColor: SURFACE.base },
  primary: { height: 54, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  disabled: { opacity: 0.4 },
});
