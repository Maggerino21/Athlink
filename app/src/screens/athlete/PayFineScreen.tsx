/**
 * PayFineScreen — every fine you still owe, and the buttons to settle them.
 *
 * The cards are `GiveFineScreen`'s fine cards in their **picked** state: the
 * fine's own colour as the fill, the name in caps, the amount set large and
 * thin. A player sees the same object when a fine is handed out and when it is
 * paid, which is the point — it is the same fine.
 *
 * **Which fines are unpaid is derived, not stored.** `fine_payments` records
 * amounts, not settlements of particular fines, so payments cover the oldest
 * fines first and the rest are listed here — see `outstanding` in `useFineBox`.
 * The list therefore always adds up to "Du skylder".
 *
 * Vipps is not connected yet and the screen says so rather than pretending.
 * When it is, this screen barely changes: `fine_payments.source` already takes
 * `'vipps'` and `external_ref` holds the payment id.
 *
 * A page sheet (`presentation: 'modal'`) — it scrolls, and it has a close
 * button because page sheets have no grabber. See GiveFineScreen.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import { useFineBox, fineAccent, type UnpaidFine } from '../../components/athlete/useFineBox';
import { dayMonth } from '../../utils/format';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, THIN_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'PayFine'>;

const PAD = 8;

/** 6450 → "6 450". Norwegian grouping, which is a space. */
function kr(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function PayFineScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { box } = useFineBox();

  const unpaid = box.unpaid ?? [];
  // The botsjef owes fines like anyone else, and "pay yourself" is not a
  // sentence — they pay into the box.
  const to = box.isFineManager ? null : box.managerName;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('pay.title')}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {to ? t('pay.toPerson', { name: to }) : t('pay.toBox')}
          </Text>
        </View>
        <PressableScale style={styles.close} scaleTo={0.9} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={18} color={TEXT.secondary} />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {unpaid.length === 0 ? (
          <Text style={styles.empty}>{t('pay.nothing')}</Text>
        ) : (
          unpaid.map(fine => <FineCard key={fine.id} fine={fine} label={t('fines.payNow')} />)
        )}
      </ScrollView>

      {unpaid.length > 0 && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
          <PressableScale style={styles.payAll} scaleTo={0.97} haptic="none" onPress={() => haptics.soft()}>
            <Text style={styles.payAllText}>
              {t('pay.payAll')}  ·  {kr(box.owed)} {t('common.kr')}
            </Text>
          </PressableScale>
          <Text style={styles.note}>{t('pay.comingSoon')}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * One outstanding fine, wearing its own colour — the picked state of the card
 * the botsjef taps to give it.
 */
function FineCard({ fine, label }: { fine: UnpaidFine; label: string }) {
  const accent = fineAccent(fine.ruleId, fine.color);
  return (
    <View style={[styles.card, { backgroundColor: accent.fill }]}>
      <Text style={styles.name} numberOfLines={2}>{fine.name.toUpperCase()}</Text>
      <Text style={styles.when} numberOfLines={1}>
        {[dayMonth(fine.createdAt), fine.note].filter(Boolean).join('  ·  ')}
      </Text>

      <View style={styles.cardBottom}>
        <View style={styles.amountRow}>
          <Text style={styles.amount} allowFontScaling={false}>{kr(fine.amount)}</Text>
          <Text style={styles.unit} allowFontScaling={false}>kr</Text>
        </View>
        <PressableScale style={styles.payBtn} scaleTo={0.95} haptic="none" onPress={() => haptics.soft()}>
          <Text style={styles.payBtnText}>{label}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 24, paddingRight: 16, paddingTop: 22, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  subtitle: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },
  close: {
    width: 32, height: 32, borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.raised,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingHorizontal: PAD, paddingBottom: 16, gap: 8 },
  empty: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.secondary,
    textAlign: 'center', marginTop: 40,
  },

  card: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18,
  },
  name: {
    fontFamily: UI_FONT, fontSize: 13, letterSpacing: 1.3,
    color: TEXT.primary,
  },
  when: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary, marginTop: 3 },
  cardBottom: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: 12, marginTop: 12,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amount: {
    fontFamily: THIN_FONT, fontSize: 52, lineHeight: 56,
    color: TEXT.primary, letterSpacing: -2,
  },
  unit: { fontFamily: LIGHT_FONT, fontSize: 18, color: TEXT.primary },
  payBtn: {
    height: 40, paddingHorizontal: 20, marginBottom: 6,
    borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  payBtnText: { fontFamily: UI_FONT, fontSize: 15, color: SURFACE.base },

  bottom: { paddingHorizontal: PAD, paddingTop: 10, gap: 10, backgroundColor: SURFACE.base },
  payAll: {
    height: 54, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  payAllText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  note: {
    fontFamily: UI_FONT_REGULAR, fontSize: 13, lineHeight: 18,
    color: TEXT.tertiary, textAlign: 'center', paddingHorizontal: 20,
  },
});
