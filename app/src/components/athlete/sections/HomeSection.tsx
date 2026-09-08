/**
 * HomeSection — the redesigned athlete home.
 *
 * Replaces ThisWeekSection, which is still in the tree but no longer rendered.
 *
 * The design rule, from the sketch: **big cards, big numbers, close together.**
 * Every card answers one question with a single figure large enough to read
 * without focusing, and the label under it is support, not content. That is
 * why there is no list, no strip of events, and no summary text — a card that
 * needs a sentence is a card that has not decided what it is for.
 *
 * Cards are `Blob variant="rim"`. The main one carries the club hue; the four
 * below are neutral, so the eye lands on the fixture first and the rest recede.
 * Making all five club-coloured turns the screen into a widget gallery where
 * nothing is emphasised.
 *
 * Data is unchanged from ThisWeekSection and every constraint it encoded still
 * applies: fixtures must filter `suppressed_at IS NULL`, and squad-wide events
 * can only be resolved by `visible_events_for_me` because an athlete cannot
 * distinguish "unassigned" from "assigned to someone else" under RLS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, Pressable, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import Blob, { blobPaletteFor } from '../../ui/Blob';

const { width: W } = Dimensions.get('window');

const PAD = 24;
const GAP = 12;
const CARD_W = W - PAD * 2;
const MAIN_H = Math.round(CARD_W * 0.52);
const SMALL_W = Math.round((CARD_W - GAP) / 2);

/**
 * The tab bar floats over content rather than reserving space, so the height
 * this section is given includes the strip underneath it. There is no public
 * height to read from `react-native-screens` Tabs, so: the bar itself is 49pt
 * on iOS and the home-indicator inset is the rest.
 */
const TAB_BAR = 49;
/** How close the bottom row sits to the bar. Small on purpose. */
const BOTTOM_GAP = 10;
const TOP_PAD = 4;
/** Only used for the first frame, before the real height has been measured. */
const SMALL_H_FALLBACK = Math.round(SMALL_W * 1.11);

/**
 * Negative tracking is applied after EVERY glyph including the last, so the
 * text box ends up `|letterSpacing|` narrower than the ink it contains — the
 * final digit gets clipped on the right, and centring lands off by half that.
 * Reserving the difference as padding fixes both at once.
 */
const HERO_TRACK = -4;

/** Tuned in BlobLab against the green Figma tile. */
const RIM = { intensity: 0.7, thickness: 0 };

/**
 * Candidates for the numerals only — the labels stay on Inter.
 *
 * That split is deliberate rather than laziness: a display face carries the
 * figure, a UI face carries the caption. Setting both to something characterful
 * is how a screen starts looking like a poster instead of an app.
 *
 * Live-switchable in __DEV__ because font is the one decision that has proved
 * impossible to make from a description, and cheap to make from a glance.
 */
/**
 * Stand-in numbers for design work, dev-only and never shipped.
 *
 * A test account with nothing assigned renders five zeros, which says nothing
 * about whether the layout holds. The counts deliberately differ in digit
 * length — a two-digit figure is where centring and tabular spacing actually
 * get tested.
 *
 * Real data always wins: these fill in only where the live value is absent or
 * zero, so this cannot mask an empty state that is genuinely broken.
 */
const USE_MOCK = __DEV__;
const MOCK = { opponent: 'Brann', isHome: false, daysUntil: 8, tasks: 3, feedback: 12, week: 5, nextIn: 2 };

const DISPLAY = ['Archivo', 'Inter', 'ChakraPetch', 'Rajdhani'] as const;
const WEIGHTS = ['300Light', '400Regular', '500Medium'] as const;
const RELIEFS = [0, 0.6, 1] as const;

interface NextMatch {
  opponent: string;
  match_date: string;
  is_home: boolean | null;
}

interface UpcomingEvent {
  id: string;
  type: string;
  title: string;
  event_date: string;
}

export default function HomeSection({ isActive }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  // Measured rather than derived: the header's height depends on the greeting
  // wrapping, which depends on the name, so computing it here would drift.
  const [areaH, setAreaH] = useState<number | null>(null);
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(null);
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Archivo Medium is the default rather than a chosen answer — see the note on
  // DISPLAY. Something competent has to sit here until the brand exists.
  const [family, setFamily] = useState<(typeof DISPLAY)[number]>('Archivo');
  const [weight, setWeight] = useState<(typeof WEIGHTS)[number]>('500Medium');
  const numberFont = `${family}_${weight}`;
  const [relief, setRelief] = useState<number>(1);

  const clubColor = profile?.club_color ?? '#3B82F6';

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [matchRes, feedbackRes, tasksRes, eventsRes] = await Promise.all([
      profile.club_id
        ? supabase
            .from('matches')
            .select('opponent, match_date, is_home')
            .eq('club_id', profile.club_id)
            .eq('status', 'upcoming')
            // Fixtures a coach removed are hidden, not deleted — a real DELETE
            // would be undone by the next provider sync. Every read must filter.
            .is('suppressed_at', null)
            .gte('match_date', new Date().toISOString())
            .order('match_date', { ascending: true })
            .limit(1)
            .single()
        : Promise.resolve({ data: null }),

      supabase
        .from('match_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', profile.id)
        .eq('acknowledged', false),

      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'pending'),

      // Squad-wide events have NO event_assignments rows, and RLS only lets an
      // athlete read their own — so filtering client-side by assignment hides
      // every event meant for the whole squad. Resolved server-side instead.
      (async () => {
        const from = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 21);
        const { data } = await supabase.rpc('visible_events_for_me', {
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        });
        return { data };
      })(),
    ]);

    if (matchRes.data) {
      const m = matchRes.data as NextMatch;
      setNextMatch(m);
      setDaysUntil(Math.ceil((new Date(m.match_date).getTime() - Date.now()) / 86400000));
    } else {
      setNextMatch(null);
      setDaysUntil(null);
    }

    setUnreadCount((feedbackRes as { count?: number }).count ?? 0);
    setPendingCount((tasksRes as { count?: number }).count ?? 0);
    setEvents((eventsRes.data as UpcomingEvent[]) ?? []);
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (isActive) fetchData(); }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const weekEnd = Date.now() + 7 * 86400000;
  const thisWeek = events.filter(e => new Date(e.event_date).getTime() <= weekEnd).length;
  const nextEvent = events[0];
  const nextEventDays = nextEvent
    ? Math.max(0, Math.ceil((new Date(nextEvent.event_date).getTime() - Date.now()) / 86400000))
    : null;

  // Never slice a timestamptz string — the wire format is UTC and a 20:00 Oslo
  // kick-off renders as 18:00. Format through Date so the device zone applies.
  const formatKickoff = (iso: string) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} · ${time}`;
  };

  const mockKickoff = () => {
    const d = new Date(Date.now() + MOCK.daysUntil * 86400000);
    d.setHours(15, 0, 0, 0);
    return d.toISOString();
  };

  const fixture = nextMatch
    ? { opponent: nextMatch.opponent, isHome: nextMatch.is_home, iso: nextMatch.match_date, days: daysUntil }
    : USE_MOCK
      ? { opponent: MOCK.opponent, isHome: MOCK.isHome, iso: mockKickoff(), days: MOCK.daysUntil }
      : null;

  const venue = fixture?.isHome === false ? '(a)' : fixture?.isHome ? '(h)' : '';
  const kickoff = fixture ? formatKickoff(fixture.iso) : null;

  const fill = (real: number, mock: number) => (real > 0 || !USE_MOCK ? real : mock);

  // Fill the screen: whatever is left after the fixture card and the gaps is
  // split between the two rows, so the bottom edge lands just above the bar.
  const usable = areaH === null ? null : areaH - (insets.bottom + TAB_BAR) - BOTTOM_GAP - TOP_PAD;
  const smallH = usable === null
    ? SMALL_H_FALLBACK
    : Math.max(SMALL_H_FALLBACK, Math.round((usable - MAIN_H - GAP * 2) / 2));

  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setAreaH(prev => (prev === h ? prev : h));
  };

  return (
    <>
    <ScrollView
      onLayout={onLayout}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />
      }
    >
      {/* The fixture. The only card carrying the club hue. */}
      <Blob
        width={CARD_W}
        height={MAIN_H}
        radius={30}
        variant="rim"
        palette={blobPaletteFor(clubColor)}
        relief={relief}
        {...RIM}
      >
        <View style={styles.mainInner}>
          <Text style={styles.kickoff}>{kickoff ?? 'Nothing scheduled'}</Text>
          <View style={styles.mainRow}>
            <View>
              <Text style={[styles.hero, { fontFamily: numberFont }]} allowFontScaling={false} numberOfLines={1}>
                {fixture?.days ?? '—'}
              </Text>
              <Text style={styles.heroUnit}>{fixture?.days === 1 ? 'Day' : 'Days'}</Text>
            </View>
            <Text style={[styles.opponent, { fontFamily: numberFont }]} numberOfLines={2}>
              {fixture ? `${fixture.opponent} ${venue}` : 'No fixture yet'}
            </Text>
          </View>
        </View>
      </Blob>

      <View style={styles.grid}>
        <StatCard height={smallH} font={numberFont} relief={relief} value={fill(pendingCount, MOCK.tasks)} label="Tasks" />
        <StatCard height={smallH} font={numberFont} relief={relief} value={fill(unreadCount, MOCK.feedback)} label="Feedback" />
      </View>
      <View style={styles.grid}>
        <StatCard height={smallH} font={numberFont} relief={relief} value={fill(thisWeek, MOCK.week)} label="This week" />
        <StatCard height={smallH} font={numberFont} relief={relief} value={fill(nextEventDays ?? 0, MOCK.nextIn)} label={nextEvent || USE_MOCK ? 'Days to next' : 'Nothing on'} />
      </View>

    </ScrollView>

      {__DEV__ && (
        <View style={[styles.fontBar, { bottom: insets.bottom + TAB_BAR + 8 }]}>
          <View style={styles.fontRow}>
            {DISPLAY.map(f => (
              <Pressable key={f} onPress={() => setFamily(f)} style={[styles.fontChip, family === f && styles.fontChipOn]}>
                <Text style={[styles.fontChipTxt, family === f && styles.fontChipTxtOn]}>{f.replace('Petch', '')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.fontRow}>
            {RELIEFS.map(r => (
              <Pressable key={r} onPress={() => setRelief(r)} style={[styles.fontChip, relief === r && styles.fontChipOn]}>
                <Text style={[styles.fontChipTxt, relief === r && styles.fontChipTxtOn]}>
                  {r === 0 ? 'flat' : r === 1 ? 'relief' : 'soft'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.fontRow}>
            {WEIGHTS.map(w => (
              <Pressable key={w} onPress={() => setWeight(w)} style={[styles.fontChip, weight === w && styles.fontChipOn]}>
                <Text style={[styles.fontChipTxt, weight === w && styles.fontChipTxtOn]}>{w.replace(/^\d+/, '')}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function StatCard({ value, label, height, font, relief }: { value: number | null; label: string; height: number; font: string; relief: number }) {
  return (
    <Blob width={SMALL_W} height={height} radius={26} variant="rim" palette="neutral" relief={relief} {...RIM}>
      <View style={styles.smallInner}>
        <Text
          style={[styles.stat, { fontFamily: font }]}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {value ?? '—'}
        </Text>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </Blob>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: PAD, paddingTop: TOP_PAD, gap: GAP },

  mainInner: { flex: 1, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 14 },
  mainRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  // Was an all-caps "NEXT GAME IN" eyebrow. A label that names the card tells
  // the athlete something they can already see; the kick-off is information
  // they actually came for, in the same space.
  kickoff: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  hero: {
    fontFamily: 'Inter_700Bold', fontSize: 96, lineHeight: 98,
    color: '#FFFFFF', letterSpacing: HERO_TRACK,
    // Reclaims the trailing tracking so the last digit is not clipped.
    paddingRight: -HERO_TRACK,
    // Tabular figures so the number does not jump sideways when 9 becomes 10.
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontFamily: 'Inter_500Medium', fontSize: 15,
    color: 'rgba(255,255,255,0.55)', marginTop: 2,
  },
  opponent: {
    fontSize: 26, lineHeight: 30,
    color: '#FFFFFF', letterSpacing: -0.8, textAlign: 'right',
    flexShrink: 1, marginLeft: 16, marginBottom: 12,
  },

  grid: { flexDirection: 'row', gap: GAP },
  // Centred, not pinned to the corners: the number is the content, so it sits
  // in the middle of the card and the label hangs off it.
  smallInner: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stat: {
    fontFamily: 'Inter_700Bold', fontSize: 92, lineHeight: 94,
    color: '#FFFFFF', letterSpacing: HERO_TRACK, textAlign: 'center',
    // Without this the box is 4pt narrower than the digits, so a centred number
    // sits 2pt right of centre and its last glyph clips. Both symptoms, one cause.
    paddingRight: -HERO_TRACK,
    fontVariant: ['tabular-nums'],
  },
  fontBar: { position: 'absolute', left: PAD, right: PAD, gap: 6 },
  fontRow: { flexDirection: 'row', gap: 6 },
  fontChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  fontChipOn: { backgroundColor: 'rgba(255,255,255,0.30)' },
  fontChipTxt: { fontFamily: 'Inter_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  fontChipTxtOn: { color: '#fff' },

  statLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 17,
    color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 4,
  },
});
