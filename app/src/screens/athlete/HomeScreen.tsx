/**
 * HomeScreen — the athlete's five tabs.
 *
 * ── Why this uses a native tab bar ──
 *
 * `BottomTabs` from react-native-screens wraps a real `UITabBarController`. On
 * iOS 26 that means Apple's own Liquid Glass tab bar, with the selection lens
 * that magnifies and displaces content behind it, chromatic edge fringing, the
 * lens merging into the bar as it travels, and scroll-edge/minimize behaviour.
 *
 * None of that is available from `expo-glass-effect` alone. `GlassView` gives
 * the *material* (`UIGlassEffect`); the tab bar is a *control* Apple built on
 * top of it, and the control contributes every one of those behaviours. The
 * previous hand-built pill applied the material and reimplemented the control,
 * which is why it kept reading as a copy no matter how it was tuned.
 *
 * `tabBarTintColor` is not merely a text colour — from iOS 26 it drives the
 * glow of the Liquid Glass selection view, so the club colour flows into the
 * real effect.
 *
 * Consequences worth knowing:
 *  - The bar is Apple's, so it is edge-to-edge and bottom-anchored. The custom
 *    floating pill is gone; `LiquidGlassTabBar` is retained only for GlassLab.
 *  - `UITabBarController` owns full-screen children, so each tab draws its own
 *    background and header via `AthleteFrame` rather than sharing one above a
 *    pager.
 *  - Tabs are tapped, not swiped. That is how iOS tab bars work.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, InteractionManager, Modal, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BottomTabs, BottomTabsScreen } from 'react-native-screens';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import haptics from '../../utils/haptics';
import AthleteFrame from '../../components/athlete/AthleteFrame';
import ThisWeekSection from '../../components/athlete/sections/ThisWeekSection';
import FeedbackSection from '../../components/athlete/sections/FeedbackSection';
import ScheduleSection from '../../components/athlete/sections/ScheduleSection';
import TasksSection from '../../components/athlete/sections/TasksSection';
import ProgressSection from '../../components/athlete/sections/ProgressSection';
import GlassLab from '../dev/GlassLab';

/**
 * SF Symbols rather than Ionicons — the native tab bar renders these itself, at
 * the exact weight and optical size iOS uses for its own bars, and they inherit
 * the Liquid Glass treatment. A bitmap icon would not.
 */
const SECTIONS = [
  { id: 'this-week', label: 'Home',     sf: 'house',                      sfActive: 'house.fill',            Component: ThisWeekSection },
  { id: 'feedback',  label: 'Feedback', sf: 'bubble.left',                sfActive: 'bubble.left.fill',      Component: FeedbackSection },
  { id: 'schedule',  label: 'Schedule', sf: 'calendar',                   sfActive: 'calendar',              Component: ScheduleSection },
  { id: 'tasks',     label: 'Tasks',    sf: 'checkmark.circle',           sfActive: 'checkmark.circle.fill', Component: TasksSection    },
  { id: 'progress',  label: 'Progress', sf: 'chart.line.uptrend.xyaxis',  sfActive: 'chart.line.uptrend.xyaxis', Component: ProgressSection },
] as const;

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const [activeKey, setActiveKey] = useState<string>(SECTIONS[0].id);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextMatchLabel, setNextMatchLabel] = useState<string | null>(null);
  const [glassLabOpen, setGlassLabOpen] = useState(false);

  // Tabs mount on first visit and stay mounted. Previously all five mounted at
  // launch and each fired its own query batch, saturating JS exactly as the app
  // became visible.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([SECTIONS[0].id]));

  const clubColor = profile?.club_color ?? '#3B82F6';

  const loadHeaderData = useCallback(async () => {
    if (!profile) return;

    supabase
      .from('match_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', profile.id)
      .eq('acknowledged', false)
      .then(({ count }) => setUnreadCount(count ?? 0));

    if (profile.club_id) {
      supabase
        .from('matches')
        .select('match_date')
        .eq('club_id', profile.club_id)
        .eq('status', 'upcoming')
        // Removed fixtures are suppressed, not deleted — see CLAUDE.md.
        .is('suppressed_at', null)
        .gte('match_date', new Date().toISOString())
        .order('match_date', { ascending: true })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const days = Math.ceil(
            (new Date(data.match_date).getTime() - Date.now()) / 86400000
          );
          setNextMatchLabel(days === 0 ? 'Match today' : `Match in ${days}d`);
        });
    }
  }, [profile]);

  useFocusEffect(useCallback(() => { loadHeaderData(); }, [loadHeaderData]));

  // Once the first paint is done, quietly mount the rest so switching tabs
  // never pays a mount cost in front of the user.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setVisited(new Set(SECTIONS.map(s => s.id)));
    });
    return () => task.cancel();
  }, []);

  const onFocusChange = useCallback((key: string) => {
    setActiveKey(key);
    setVisited(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
    haptics.selection();
  }, []);

  // Tapping your own avatar used to sign you out outright, with no confirmation
  // and nothing else on screen doing anything similar. Until there is a real
  // account screen to put this behind, at least ask.
  const confirmSignOut = useCallback(() => {
    haptics.selection();
    Alert.alert(
      'Sign out?',
      'You will need your email and password to get back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  }, [signOut]);

  const name     = profile?.full_name ?? '';
  const initials = name ? getInitials(name) : '?';

  const frameProps = {
    clubColor,
    greeting: getGreeting(),
    name,
    initials,
    clubName: profile?.club_name ?? null,
    dateLabel: formatDate(),
    nextMatchLabel,
    onAvatarPress: confirmSignOut,
    onAvatarLongPress: __DEV__
      ? () => { haptics.medium(); setGlassLabOpen(true); }
      : undefined,
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <BottomTabs
        // From iOS 26 this also drives the glow of the Liquid Glass selection
        // lens, so the club colour lands inside Apple's own effect.
        tabBarTintColor={clubColor}
        // iOS 26 behaviour: the bar shrinks out of the way as content scrolls.
        tabBarMinimizeBehavior="onScrollDown"
        onNativeFocusChange={({ nativeEvent }) => onFocusChange(nativeEvent.tabKey)}
      >
        {SECTIONS.map(({ id, label, sf, sfActive, Component }) => (
          <BottomTabsScreen
            key={id}
            tabKey={id}
            isFocused={activeKey === id}
            title={label}
            icon={{ sfSymbolName: sf }}
            selectedIcon={{ sfSymbolName: sfActive }}
            badgeValue={id === 'feedback' && unreadCount > 0 ? String(unreadCount) : undefined}
            // Deliberately no `freezeContents`. Freezing was only ever needed
            // because each tab drew its own full-screen backdrop; now there is
            // one backdrop behind the whole tab controller, a hidden tab costs
            // little and freezing it bought a flash instead of speed.
          >
            <AthleteFrame {...frameProps}>
              {visited.has(id) ? <Component isActive={activeKey === id} /> : null}
            </AthleteFrame>
          </BottomTabsScreen>
        ))}
      </BottomTabs>

      {__DEV__ && glassLabOpen && (
        <Modal visible animationType="slide" onRequestClose={() => setGlassLabOpen(false)}>
          <GlassLab onClose={() => setGlassLabOpen(false)} clubColor={clubColor} />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0a0a' },
});
