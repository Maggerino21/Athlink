import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../components/ui/GlassCard';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { clubGradientOrbs } from '../../utils/theme';
import { StaffStackParamList } from '../../navigation/RootNavigator';

type RouteProps = RouteProp<StaffStackParamList, 'StaffAthleteDetail'>;
type NavProps   = NativeStackNavigationProp<StaffStackParamList, 'StaffAthleteDetail'>;

const { width: W, height: H } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
interface FeedbackItem {
  id: string;
  title: string | null;
  feedback_text: string;
  processed_text: string | null;
  action_point: string | null;
  is_ai_processed: boolean;
  acknowledged: boolean;
  reaction: string | null;
  athlete_reply: string | null;
  acknowledged_at: string | null;
  created_at: string;
  staff_name: string;
}

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'completed' | 'unable';
  completed_at: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dueDateLabel(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: 'No due date', overdue: false };
  const d     = new Date(iso);
  const days  = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const overdue = days < 0;
  if (days === 0) return { label: 'Due today', overdue: false };
  if (days === 1) return { label: 'Due tomorrow', overdue: false };
  if (overdue)   return { label: `${Math.abs(days)}d overdue`, overdue: true };
  return {
    label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    overdue: false,
  };
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function StaffAthleteDetailScreen() {
  const { profile } = useAuth();
  const navigation  = useNavigation<NavProps>();
  const route       = useRoute<RouteProps>();
  const { athleteId, athleteName } = route.params;
  const insets = useSafeAreaInsets();

  const [feedback, setFeedback]       = useState<FeedbackItem[]>([]);
  const [tasks, setTasks]             = useState<TaskItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [taskModal, setTaskModal]         = useState(false);

  const initials = getInitials(athleteName);

  const load = useCallback(async () => {
    const [fbRes, taskRes] = await Promise.all([
      supabase
        .from('match_feedback')
        .select(`
          id, title, feedback_text, processed_text, action_point,
          is_ai_processed, acknowledged, reaction, athlete_reply,
          acknowledged_at, created_at,
          staff:profiles!match_feedback_created_by_fkey(full_name)
        `)
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('tasks')
        .select('id, title, description, due_date, status, completed_at, created_at')
        .eq('assigned_to', athleteId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (fbRes.data) {
      setFeedback(fbRes.data.map((r: any) => ({
        id: r.id,
        title: r.title,
        feedback_text: r.feedback_text,
        processed_text: r.processed_text,
        action_point: r.action_point,
        is_ai_processed: r.is_ai_processed ?? false,
        acknowledged: r.acknowledged,
        reaction: r.reaction,
        athlete_reply: r.athlete_reply,
        acknowledged_at: r.acknowledged_at,
        created_at: r.created_at,
        staff_name: r.staff?.full_name ?? 'Staff',
      })));
    }

    if (taskRes.data) {
      setTasks(taskRes.data as TaskItem[]);
    }

    setLoading(false);
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unreadCount  = feedback.filter(f => !f.acknowledged).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background */}
      {(() => {
        const orbs = clubGradientOrbs(profile?.club_color ?? '#3B82F6');
        return (
          <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080C1E' }]} />
            <LinearGradient colors={orbs.top}    style={styles.orbTop}    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
            <LinearGradient colors={orbs.bottom} style={styles.orbBottom} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} />
          </View>
        );
      })()}

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Athlete Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />
          }
        >
          {/* ── Athlete card ── */}
          <GlassCard elevated intensity={72} style={styles.athleteCard}>
            <View style={styles.athleteHeader}>
              <View style={styles.bigAvatar}>
                <Text style={styles.bigAvatarText}>{initials}</Text>
              </View>
              <View style={styles.athleteInfo}>
                <Text style={styles.athleteNameText}>{athleteName}</Text>
                <Text style={styles.athleteRoleText}>Athlete</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatPill
                icon="chatbubble-ellipses"
                value={unreadCount}
                label="Unread"
                color="#3B82F6"
              />
              <View style={styles.statDivider} />
              <StatPill
                icon="checkmark-circle"
                value={pendingCount}
                label="Pending tasks"
                color="#22C55E"
              />
              <View style={styles.statDivider} />
              <StatPill
                icon="document-text"
                value={feedback.length}
                label="Total feedback"
                color="#A78BFA"
              />
            </View>
          </GlassCard>

          {/* ── Feedback section ── */}
          <Text style={styles.sectionLabel}>Feedback</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="rgba(255,255,255,0.4)" />
            </View>
          ) : feedback.length === 0 ? (
            <EmptyState
              icon="chatbubble-outline"
              text="No feedback given yet"
            />
          ) : (
            feedback.map(item => (
              <FeedbackCard key={item.id} item={item} />
            ))
          )}

          {/* ── Tasks section ── */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Tasks</Text>

          {loading ? null : tasks.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              text="No tasks assigned yet"
            />
          ) : (
            tasks.map(item => (
              <TaskCard key={item.id} item={item} />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Bottom action bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <BlurView
          intensity={72}
          tint="systemUltraThinMaterialDark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,26,0.55)' }]} />
        <View style={styles.actionBarInner}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnBlue]}
            onPress={() => setFeedbackModal(true)}
            activeOpacity={0.82}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Give Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGreen]}
            onPress={() => setTaskModal(true)}
            activeOpacity={0.82}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Assign Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <QuickFeedbackModal
        visible={feedbackModal}
        athleteId={athleteId}
        staffId={profile?.id ?? ''}
        onClose={() => { setFeedbackModal(false); load(); }}
      />
      <QuickTaskModal
        visible={taskModal}
        athleteId={athleteId}
        staffId={profile?.id ?? ''}
        clubId={profile?.club_id ?? ''}
        onClose={() => { setTaskModal(false); load(); }}
      />
    </View>
  );
}

// ── Stat Pill ──────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color }: {
  icon: string; value: number; label: string; color: string;
}) {
  return (
    <View style={pillStyles.wrap}>
      <Ionicons name={icon as any} size={14} color={color} style={{ marginBottom: 6 }} />
      <Text style={pillStyles.value}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 2 },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '500', textAlign: 'center' },
});

// ── Feedback Card (staff view) ─────────────────────────────────────────────────
function FeedbackCard({ item }: { item: FeedbackItem }) {
  const unread = !item.acknowledged;
  return (
    <GlassCard
      elevated={unread}
      intensity={unread ? 65 : 50}
      style={fbStyles.card}
    >
      {unread && <View style={fbStyles.unreadBar} />}

      <View style={fbStyles.headerRow}>
        <View style={fbStyles.fromRow}>
          <View style={fbStyles.smallAvatar}>
            <Text style={fbStyles.smallAvatarText}>
              {getInitials(item.staff_name)}
            </Text>
          </View>
          <View>
            <Text style={fbStyles.fromName}>{item.staff_name}</Text>
            <Text style={fbStyles.timestamp}>{relativeTime(item.created_at)}</Text>
          </View>
        </View>
        {item.acknowledged ? (
          <View style={fbStyles.ackBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#4ADE80" style={{ marginRight: 4 }} />
            <Text style={fbStyles.ackBadgeText}>Read</Text>
          </View>
        ) : (
          <View style={[fbStyles.ackBadge, fbStyles.ackBadgePending]}>
            <View style={fbStyles.unreadDot} />
            <Text style={[fbStyles.ackBadgeText, { color: '#93C5FD' }]}>Unread</Text>
          </View>
        )}
      </View>

      {item.title && <Text style={fbStyles.title}>{item.title}</Text>}
      {item.is_ai_processed && (
        <View style={fbStyles.aiBadge}>
          <Ionicons name="sparkles" size={10} color="#93C5FD" style={{ marginRight: 3 }} />
          <Text style={fbStyles.aiBadgeText}>Translated by AI</Text>
        </View>
      )}
      <Text style={fbStyles.body}>{item.processed_text ?? item.feedback_text}</Text>

      {item.action_point && (
        <View style={fbStyles.actionBox}>
          <Text style={fbStyles.actionLabel}>Action</Text>
          <Text style={fbStyles.actionText}>{item.action_point}</Text>
        </View>
      )}

      {item.acknowledged && (
        <View style={fbStyles.ackRow}>
          {item.reaction
            ? <Text style={fbStyles.reactionText}>{item.reaction}</Text>
            : <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
          }
          <Text style={fbStyles.ackRowText}>Acknowledged</Text>
        </View>
      )}

      {item.athlete_reply && (
        <View style={fbStyles.replyBox}>
          <Text style={fbStyles.replyLabel}>Athlete reply</Text>
          <Text style={fbStyles.replyText}>{item.athlete_reply}</Text>
        </View>
      )}
    </GlassCard>
  );
}

const fbStyles = StyleSheet.create({
  card: { marginBottom: 0 },
  unreadBar: {
    position: 'absolute', left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: 2, backgroundColor: '#3B82F6', zIndex: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fromRow:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  smallAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.28)',
    justifyContent: 'center', alignItems: 'center',
  },
  smallAvatarText: { color: '#60A5FA', fontSize: 11, fontWeight: '700' },
  fromName:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  timestamp: { fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1 },
  ackBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.18)',
  },
  ackBadgePending: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  ackBadgeText: { fontSize: 11, color: 'rgba(74,222,128,0.8)', fontWeight: '600' },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 5 },
  title:  { fontSize: 14, fontWeight: '600', color: '#F1F5F9', marginBottom: 5 },
  body:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19, marginBottom: 10 },
  actionBox: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.16)',
  },
  actionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(147,197,253,0.7)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  actionText:  { fontSize: 12, color: 'rgba(147,197,253,0.8)', lineHeight: 17 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  aiBadgeText: { fontSize: 10, color: 'rgba(147,197,253,0.5)', fontWeight: '500' },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ackRowText: { fontSize: 12, color: 'rgba(74,222,128,0.6)', fontWeight: '500' },
  reactionText: { fontSize: 14 },
  replyBox: {
    marginTop: 8, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  replyLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  replyText:  { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
});

// ── Task Card (staff view) ─────────────────────────────────────────────────────
function TaskCard({ item }: { item: TaskItem }) {
  const { label: dueLabel, overdue } = dueDateLabel(item.due_date);
  const done = item.status === 'completed';

  return (
    <GlassCard intensity={50} style={tkStyles.card}>
      <View style={tkStyles.row}>
        <View style={[tkStyles.statusDot, done ? tkStyles.dotDone : overdue ? tkStyles.dotOverdue : tkStyles.dotPending]} />
        <View style={{ flex: 1 }}>
          <Text style={[tkStyles.title, done && tkStyles.titleDone]}>{item.title}</Text>
          {item.description ? (
            <Text style={tkStyles.desc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <View style={tkStyles.metaRow}>
            <Ionicons
              name="time-outline"
              size={11}
              color={overdue && !done ? '#FCA5A5' : 'rgba(255,255,255,0.25)'}
              style={{ marginRight: 4 }}
            />
            <Text style={[tkStyles.due, overdue && !done && tkStyles.dueOverdue]}>
              {dueLabel}
            </Text>
          </View>
        </View>
        <View style={[tkStyles.badge,
          done    ? tkStyles.badgeDone    :
          overdue ? tkStyles.badgeOverdue :
                    tkStyles.badgePending
        ]}>
          <Text style={[tkStyles.badgeText,
            done    ? tkStyles.badgeTextDone    :
            overdue ? tkStyles.badgeTextOverdue :
                      tkStyles.badgeTextPending
          ]}>
            {done ? 'Done' : overdue ? 'Overdue' : 'Pending'}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const tkStyles = StyleSheet.create({
  card: { marginBottom: 0 },
  row:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  dotPending: { backgroundColor: '#F59E0B' },
  dotDone:    { backgroundColor: '#22C55E' },
  dotOverdue: { backgroundColor: '#EF4444' },
  title:     { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginBottom: 3 },
  titleDone: { color: 'rgba(255,255,255,0.3)', textDecorationLine: 'line-through' },
  desc:  { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  due: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  dueOverdue: { color: '#FCA5A5' },
  badge: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, alignSelf: 'flex-start', flexShrink: 0,
  },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.1)',  borderColor: 'rgba(245,158,11,0.25)' },
  badgeDone:    { backgroundColor: 'rgba(34,197,94,0.1)',   borderColor: 'rgba(34,197,94,0.22)' },
  badgeOverdue: { backgroundColor: 'rgba(239,68,68,0.1)',   borderColor: 'rgba(239,68,68,0.22)' },
  badgeText:        { fontSize: 11, fontWeight: '600' },
  badgeTextPending: { color: '#FCD34D' },
  badgeTextDone:    { color: '#4ADE80' },
  badgeTextOverdue: { color: '#FCA5A5' },
});

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={emptyStyles.wrap}>
      <Ionicons name={icon as any} size={28} color="rgba(255,255,255,0.1)" />
      <Text style={emptyStyles.text}>{text}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  text: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },
});

// ── Quick Feedback Modal ───────────────────────────────────────────────────────
function QuickFeedbackModal({
  visible, athleteId, staffId, onClose,
}: {
  visible: boolean;
  athleteId: string;
  staffId: string;
  onClose: () => void;
}) {
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [actionPoint, setActionPoint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (visible) { setTitle(''); setBody(''); setActionPoint(''); setError(''); }
  }, [visible]);

  const submit = async () => {
    if (!body.trim()) { setError('Feedback text is required.'); return; }
    setError('');
    setSubmitting(true);
    const { error: err } = await supabase.from('match_feedback').insert({
      athlete_id: athleteId,
      created_by: staffId,
      title: title.trim() || null,
      feedback_text: body.trim(),
      action_point: actionPoint.trim() || null,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }

    // Send push notification (fire-and-forget)
    const { data: athleteProfile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', athleteId)
      .single();
    if (athleteProfile?.push_token) {
      supabase.functions.invoke('send-notification', {
        body: {
          tokens: [athleteProfile.push_token],
          title: 'New feedback',
          body: title.trim() || 'You have received new feedback from your coach.',
          data: { type: 'feedback' },
        },
      });
    }

    onClose();
  };

  return (
    <ModalShell visible={visible} title="Give Feedback" onClose={onClose}>
      <Text style={mStyles.fieldLabel}>Title (optional)</Text>
      <ModalInput value={title} onChangeText={setTitle} placeholder="e.g. Press triggers in transition" />

      <Text style={mStyles.fieldLabel}>Feedback</Text>
      <ModalInput value={body} onChangeText={setBody} placeholder="What did you observe?" multiline numberOfLines={4} />

      <Text style={mStyles.fieldLabel}>Action point (optional)</Text>
      <ModalInput value={actionPoint} onChangeText={setActionPoint} placeholder="Specific action for the athlete" />

      {error ? <Text style={mStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[mStyles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={mStyles.submitText}>Send Feedback</Text>
        }
      </TouchableOpacity>
    </ModalShell>
  );
}

// ── Quick Task Modal ───────────────────────────────────────────────────────────
function QuickTaskModal({
  visible, athleteId, staffId, clubId, onClose,
}: {
  visible: boolean;
  athleteId: string;
  staffId: string;
  clubId: string;
  onClose: () => void;
}) {
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (visible) { setTitle(''); setDescription(''); setDueDate(''); setError(''); }
  }, [visible]);

  const submit = async () => {
    if (!title.trim()) { setError('Task title is required.'); return; }
    setError('');
    setSubmitting(true);

    let dueDateISO: string | null = null;
    if (dueDate.trim()) {
      const parts = dueDate.trim().split(/[-/]/);
      let d: Date | null = null;
      if (parts.length === 3) {
        d = parts[2].length === 4
          ? new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T23:59:00`)
          : new Date(`${dueDate.trim()}T23:59:00`);
      }
      if (d && !isNaN(d.getTime())) dueDateISO = d.toISOString();
      else { setError('Due date format: DD/MM/YYYY'); setSubmitting(false); return; }
    }

    const { error: err } = await supabase.from('tasks').insert({
      assigned_to: athleteId,
      created_by: staffId,
      club_id: clubId,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDateISO,
    });

    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onClose();
  };

  return (
    <ModalShell visible={visible} title="Assign Task" onClose={onClose}>
      <Text style={mStyles.fieldLabel}>Task title</Text>
      <ModalInput value={title} onChangeText={setTitle} placeholder="e.g. Recovery program — lower body" />

      <Text style={mStyles.fieldLabel}>Description (optional)</Text>
      <ModalInput value={description} onChangeText={setDescription} placeholder="More detail about what needs to be done" multiline numberOfLines={3} />

      <Text style={mStyles.fieldLabel}>Due date (optional)</Text>
      <ModalInput value={dueDate} onChangeText={setDueDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />

      {error ? <Text style={mStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[mStyles.submitBtn, { backgroundColor: '#166534', borderColor: 'rgba(34,197,94,0.4)' }, submitting && { opacity: 0.6 }]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={mStyles.submitText}>Assign Task</Text>
        }
      </TouchableOpacity>
    </ModalShell>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      </TouchableOpacity>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <View style={[mStyles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
          <BlurView intensity={72} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,26,0.65)' }]} />
          <View style={mStyles.handle} />
          <ScrollView
            style={{ zIndex: 1 }}
            contentContainerStyle={mStyles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={mStyles.sheetHeader}>
              <Text style={mStyles.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Modal Input ───────────────────────────────────────────────────────────────
function ModalInput({
  value, onChangeText, placeholder, multiline, numberOfLines, keyboardType,
}: {
  value: string; onChangeText: (t: string) => void; placeholder: string;
  multiline?: boolean; numberOfLines?: number;
  keyboardType?: 'default' | 'numbers-and-punctuation';
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.2)"
      multiline={multiline}
      numberOfLines={numberOfLines}
      keyboardType={keyboardType ?? 'default'}
      style={[
        mStyles.input,
        multiline && { height: (numberOfLines ?? 3) * 22 + 24, textAlignVertical: 'top' },
      ]}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  orbTop: {
    position: 'absolute', top: -160, right: -160,
    width: W * 1.3, height: H * 0.6, borderRadius: 9999,
  },
  orbBottom: {
    position: 'absolute', bottom: -160, left: -120,
    width: W * 1.2, height: H * 0.6, borderRadius: 9999,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
  },
  headerSpacer: { width: 38 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },

  athleteCard: {},
  athleteHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  bigAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  bigAvatarText: { color: '#60A5FA', fontSize: 20, fontWeight: '700' },
  athleteInfo: {},
  athleteNameText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  athleteRoleText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)' },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1,
  },

  loadingWrap: { paddingVertical: 32, alignItems: 'center' },

  // Bottom action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    overflow: 'hidden',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  actionBarInner: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 14,
    zIndex: 1,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 16,
    borderWidth: 1,
  },
  actionBtnBlue:  { backgroundColor: '#1D4ED8', borderColor: 'rgba(59,130,246,0.5)', shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  actionBtnGreen: { backgroundColor: '#166534', borderColor: 'rgba(34,197,94,0.4)',  shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

const mStyles = StyleSheet.create({
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFFFFF', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  error: { fontSize: 13, color: '#FCA5A5', marginBottom: 12, textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#1D4ED8', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)',
    shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', maxHeight: H * 0.88,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12, zIndex: 2,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40, zIndex: 1 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 18,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
