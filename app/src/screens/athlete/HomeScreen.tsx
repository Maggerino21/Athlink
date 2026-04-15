import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { clubGradientOrbs } from '../../utils/theme';
import ThisWeekSection from '../../components/athlete/sections/ThisWeekSection';
import FeedbackSection from '../../components/athlete/sections/FeedbackSection';
import ScheduleSection from '../../components/athlete/sections/ScheduleSection';
import TasksSection from '../../components/athlete/sections/TasksSection';
import ProgressSection from '../../components/athlete/sections/ProgressSection';
import LiquidGlassTabBar from '../../components/athlete/LiquidGlassTabBar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SECTIONS = [
  { id: 'this-week', Component: ThisWeekSection },
  { id: 'feedback',  Component: FeedbackSection },
  { id: 'schedule',  Component: ScheduleSection },
  { id: 'tasks',     Component: TasksSection    },
  { id: 'progress',  Component: ProgressSection },
];
const TAB_BAR_CLEARANCE = 110;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextMatchLabel, setNextMatchLabel] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const loadHeaderData = useCallback(async () => {
    if (!profile) return;

    // Unread feedback count → tab badge
    supabase
      .from('match_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', profile.id)
      .eq('acknowledged', false)
      .then(({ count }) => setUnreadCount(count ?? 0));

    // Next match → accent chip
    if (profile.club_id) {
      supabase
        .from('matches')
        .select('match_date')
        .eq('club_id', profile.club_id)
        .eq('status', 'upcoming')
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

  // Re-run whenever this screen comes into focus (e.g. coming back from background)
  useFocusEffect(useCallback(() => { loadHeaderData(); }, [loadHeaderData]));

  const handleTabPress = (index: number) => {
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveIndex(index);
  };

  const name      = profile?.full_name ?? '';
  const initials  = name ? getInitials(name) : '?';
  const clubName  = profile?.club_name ?? null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background */}
      {(() => {
        const orbs = clubGradientOrbs(profile?.club_color ?? '#3B82F6');
        return (
          <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0c0a0a' }]} />
            <LinearGradient colors={orbs.top}    style={styles.orbTopRight}   start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
            <LinearGradient colors={orbs.bottom} style={styles.orbBottomLeft} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} />
          </View>
        );
      })()}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.athleteName}>{name || '—'}</Text>
            </View>
            <TouchableOpacity style={styles.avatarWrap} onPress={signOut} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            {clubName && <GlassChip label={clubName} />}
            <GlassChip label={formatDate()} />
            {nextMatchLabel && <GlassChip label={nextMatchLabel} accent />}
          </View>
        </View>

        {/* Swipeable sections */}
        <ScrollView
          ref={scrollViewRef}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false} scrollEventThrottle={32}
          style={styles.contentScroll}
          onMomentumScrollEnd={(e) => {
            setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
          }}
        >
          {SECTIONS.map(({ id, Component }, i) => (
            <View key={id} style={[styles.sectionPage, { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}>
              <Component isActive={activeIndex === i} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>

      <LiquidGlassTabBar
        activeIndex={activeIndex}
        onTabPress={handleTabPress}
        badges={unreadCount > 0 ? { 1: unreadCount } : {}}
      />
    </View>
  );
}

function GlassChip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.chip, accent && styles.chipAccent]}>
      <View style={styles.chipSpec} />
      <Text style={[styles.chipText, accent && styles.chipTextAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  orbTopRight:   { position: 'absolute', top: -160, right: -160, width: SCREEN_WIDTH * 1.3, height: SCREEN_HEIGHT * 0.65, borderRadius: 9999 },
  orbBottomLeft: { position: 'absolute', bottom: -160, left: -120, width: SCREEN_WIDTH * 1.2, height: SCREEN_HEIGHT * 0.65, borderRadius: 9999 },
  header: { paddingTop: 6, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  athleteName: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  avatarWrap:  { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 12, elevation: 8 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  avatarText:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', gap: 8 },
  chip:        { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  chipAccent:  { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' },
  chipSpec:    { position: 'absolute', top: 0, left: 8, right: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  chipText:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  chipTextAccent: { color: '#60A5FA' },
  contentScroll: { flex: 1 },
  sectionPage:   { width: SCREEN_WIDTH, flex: 1 },
});
