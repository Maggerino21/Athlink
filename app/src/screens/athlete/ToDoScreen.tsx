/**
 * ToDoScreen — what the staff sent you, and the one tap it wants.
 *
 * Two ways in:
 * - **Home's "To do" tile** — everything still open. Ticking one off sends it
 *   away; ticking off the last closes the sheet, because the chore is done.
 * - **Schedule** — one item, passed as a param (`item`), open or done. It stays
 *   on screen after the tap and shows its new state.
 *
 * One action per item and nothing else: "Done" for a task, "Got it" for
 * feedback. No replies — Athlink is not a chat (CLAUDE.md), and a player who
 * wants to talk to their coach already has WhatsApp.
 *
 * A page sheet (`presentation: 'modal'`) rather than a formSheet, because
 * feedback can be long and a formSheet cannot scroll. Page sheets have no
 * grabber, hence the × — same as GiveFineScreen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import {
  useToDo, setTaskDone, acknowledgeFeedback,
  type ToDoItem, type TaskItem, type FeedbackItem,
} from '../../components/athlete/useToDo';
import { eventAccent, eventMeta } from '../../components/athlete/eventTypes';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'ToDo'>;

const PAD = 8;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Long enough to see the last card leave, short enough not to be waited on. */
const CLOSE_AFTER_LAST_MS = 650;

export default function ToDoScreen({ navigation, route }: Props) {
  const single = route.params?.item;
  // Stable, so OpenList's close-after-the-last timer is not reset by a render.
  const close = useCallback(() => navigation.goBack(), [navigation]);
  return single
    ? <SingleItem initial={single} onClose={close} />
    : <OpenList onClose={close} />;
}

// ── Everything open (from Home) ──────────────────────────────────────────────

function OpenList({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { items, loaded } = useToDo();
  /** Gone from the list the moment they are tapped, before the server answers. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const acted = useRef(false);

  const visible = items.filter(i => !hidden.has(i.id));

  useEffect(() => {
    if (!acted.current || visible.length > 0) return;
    const t = setTimeout(onClose, CLOSE_AFTER_LAST_MS);
    return () => clearTimeout(t);
  }, [visible.length, onClose]);

  const act = async (item: ToDoItem) => {
    acted.current = true;
    haptics.success();
    setHidden(prev => new Set(prev).add(item.id));
    const ok = item.kind === 'task' ? await setTaskDone(item.id, true) : await acknowledgeFeedback(item.id);
    if (!ok) {
      haptics.error();
      setHidden(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

  return (
    <View style={styles.root}>
      <Header title="To do" onClose={onClose} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      >
        {visible.map(item => (
          <Animated.View
            key={item.id}
            exiting={FadeOut.duration(180)}
            layout={LinearTransition.duration(260).easing(EASE)}
          >
            <ToDoCard item={item} onAct={() => act(item)} />
          </Animated.View>
        ))}
        {/* Waits for the last card's fade, or the two overlap for a few frames. */}
        {loaded && visible.length === 0 && (
          <Animated.Text entering={FadeIn.delay(160).duration(200)} style={styles.allDone}>
            All done.
          </Animated.Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── One item (from Schedule) ─────────────────────────────────────────────────

function SingleItem({ initial, onClose }: { initial: ToDoItem; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToDoItem>(initial);

  const act = async () => {
    const before = item;
    if (item.kind === 'feedback') {
      if (item.done) return;
      haptics.success();
      setItem({ ...item, done: true });
      if (!(await acknowledgeFeedback(item.id))) { haptics.error(); setItem(before); }
      return;
    }
    // A task toggles: a done task in the calendar can be reopened.
    const done = !item.done;
    if (done) haptics.success(); else haptics.soft();
    setItem({ ...item, done });
    if (!(await setTaskDone(item.id, done))) { haptics.error(); setItem(before); }
  };

  return (
    <View style={styles.root}>
      <Header title={item.kind === 'task' ? 'Task' : 'Feedback'} onClose={onClose} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      >
        <ToDoCard item={item} onAct={act} />
      </ScrollView>
    </View>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <PressableScale style={styles.close} scaleTo={0.9} onPress={onClose}>
        <Ionicons name="close" size={18} color={TEXT.secondary} />
      </PressableScale>
    </View>
  );
}

/**
 * One thing from the staff. Colour lives in the type — the kind label takes the
 * category ink, the card itself stays opaque grey like every other card.
 */
function ToDoCard({ item, onAct }: { item: ToDoItem; onAct: () => void }) {
  const accent = eventAccent(item.kind);
  const meta = eventMeta(item.kind);
  const when = item.kind === 'task' ? dueLabel(item.due) : sentLabel(item.sentAt);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.kindRow}>
          <Ionicons name={meta.icon as any} size={14} color={accent.ink} />
          <Text style={[styles.kind, { color: accent.ink }]}>
            {item.kind === 'task' ? 'Task' : 'Feedback'}
          </Text>
        </View>
        {when ? <Text style={styles.when}>{when}</Text> : null}
      </View>

      {item.kind === 'task' ? <TaskBody item={item} /> : <FeedbackBody item={item} />}

      <Text style={styles.from}>From {item.from}</Text>

      <ActionButton item={item} onPress={onAct} />
    </View>
  );
}

function TaskBody({ item }: { item: TaskItem }) {
  return (
    <>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
    </>
  );
}

function FeedbackBody({ item }: { item: FeedbackItem }) {
  const accent = eventAccent('feedback');
  return (
    <>
      <Text style={styles.cardTitle}>{item.title ?? 'Feedback'}</Text>
      {item.about ? <Text style={styles.about}>{item.about}</Text> : null}
      <Text style={styles.body}>{item.body}</Text>
      {item.actionPoint ? (
        <View style={styles.focus}>
          <Text style={[styles.focusLabel, { color: accent.ink }]}>Your focus</Text>
          <Text style={styles.focusText}>{item.actionPoint}</Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * White when it wants the tap, grey with a tick once it has had it. A done
 * task can be tapped again to reopen it; seen feedback cannot be unseen.
 */
function ActionButton({ item, onPress }: { item: ToDoItem; onPress: () => void }) {
  const done = item.done;
  const label = item.kind === 'task' ? 'Done' : done ? 'Seen' : 'Got it';
  const inert = done && item.kind === 'feedback';
  return (
    <PressableScale
      style={[styles.button, done && styles.buttonDone]}
      scaleTo={0.97}
      haptic="none"
      disabled={inert}
      onPress={inert ? undefined : onPress}
    >
      {done && <Ionicons name="checkmark" size={18} color={TEXT.secondary} />}
      <Text style={[styles.buttonText, done && styles.buttonTextDone]}>{label}</Text>
    </PressableScale>
  );
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** Calendar days from today, local time. Negative is in the past. */
function daysFromToday(iso: string): number {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((day - today) / 86400000);
}

function dueLabel(iso: string | null): string | null {
  if (!iso) return null;
  const days = daysFromToday(iso);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  const d = new Date(iso);
  if (days < 7) return `Due ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function sentLabel(iso: string): string {
  const days = daysFromToday(iso);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  const d = new Date(iso);
  if (days > -7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 24, paddingRight: 16, paddingTop: 22, paddingBottom: 14,
  },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  close: {
    width: 32, height: 32, borderRadius: RADIUS.pill,
    backgroundColor: SURFACE.raised,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingHorizontal: PAD, gap: 8 },
  allDone: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.secondary,
    textAlign: 'center', marginTop: 40,
  },

  card: {
    borderRadius: RADIUS.lg, backgroundColor: SURFACE.raised,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { fontFamily: UI_FONT, fontSize: 13 },
  when: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary },

  cardTitle: {
    fontFamily: LIGHT_FONT, fontSize: 24, lineHeight: 30,
    color: TEXT.primary, letterSpacing: -0.4, marginTop: 12,
  },
  about: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },
  body: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16, lineHeight: 23,
    color: TEXT.primary, marginTop: 12,
  },

  // Sits into the card rather than on it: the page colour, not another grey.
  focus: {
    marginTop: 14, padding: 14,
    borderRadius: RADIUS.md, backgroundColor: SURFACE.base,
  },
  focusLabel: { fontFamily: UI_FONT, fontSize: 13 },
  focusText: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16, lineHeight: 22,
    color: TEXT.primary, marginTop: 4,
  },

  from: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, marginTop: 14 },

  button: {
    height: 50, marginTop: 16, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  buttonDone: { backgroundColor: SURFACE.active },
  buttonText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  buttonTextDone: { color: TEXT.secondary },
});
