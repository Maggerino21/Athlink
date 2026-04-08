import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions, FlatList, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StaffStackParamList } from '../../navigation/RootNavigator';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../components/ui/GlassCard';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const { width: W, height: H } = Dimensions.get('window');

interface Athlete {
  id: string;
  full_name: string;
  pending_tasks: number;
  unread_feedback: number;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function StaffHomeScreen() {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<StaffStackParamList>>();
  const [athletes, setAthletes]             = useState<Athlete[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [feedbackModal, setFeedbackModal]   = useState(false);
  const [taskModal, setTaskModal]           = useState(false);
  const [matchModal, setMatchModal]         = useState(false);
  const [preselectedAthlete, setPreselected] = useState<Athlete | null>(null);

  const load = useCallback(async () => {
    if (!profile?.club_id) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('club_id', profile.club_id)
      .eq('role', 'athlete')
      .order('full_name');

    if (!data) { setLoading(false); return; }

    // Fetch counts for each athlete in parallel
    const enriched = await Promise.all(
      data.map(async (a) => {
        const [taskRes, fbRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', a.id)
            .eq('status', 'pending'),
          supabase
            .from('match_feedback')
            .select('id', { count: 'exact', head: true })
            .eq('athlete_id', a.id)
            .eq('acknowledged', false),
        ]);
        return {
          id: a.id,
          full_name: a.full_name,
          pending_tasks: (taskRes as any).count ?? 0,
          unread_feedback: (fbRes as any).count ?? 0,
        };
      })
    );
    setAthletes(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openFeedback = (athlete?: Athlete) => {
    setPreselected(athlete ?? null);
    setFeedbackModal(true);
  };

  const openTask = (athlete?: Athlete) => {
    setPreselected(athlete ?? null);
    setTaskModal(true);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080C1E' }]} />
        <LinearGradient
          colors={['rgba(56,100,220,0.38)', 'rgba(56,100,220,0)']}
          style={styles.orbTop}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={['rgba(100,60,200,0.28)', 'rgba(100,60,200,0)']}
          style={styles.orbBottom}
          start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
        />
      </View>

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Staff dashboard</Text>
            <Text style={styles.headerName}>{profile?.full_name ?? 'Coach'}</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <QuickAction
            icon="chatbubble-ellipses"
            label="Feedback"
            color="#3B82F6"
            onPress={() => openFeedback()}
          />
          <QuickAction
            icon="checkmark-circle"
            label="Task"
            color="#22C55E"
            onPress={() => openTask()}
          />
          <QuickAction
            icon="football"
            label="Match"
            color="#F59E0B"
            onPress={() => setMatchModal(true)}
          />
        </View>

        {/* Athlete list */}
        <Text style={styles.sectionLabel}>Your Athletes</Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="rgba(255,255,255,0.4)" />
          </View>
        ) : athletes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No athletes in your club yet.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />
            }
          >
            {athletes.map(athlete => (
              <AthleteRow
                key={athlete.id}
                athlete={athlete}
                onPress={() => navigation.navigate('StaffAthleteDetail', {
                  athleteId: athlete.id,
                  athleteName: athlete.full_name,
                })}
                onFeedback={() => openFeedback(athlete)}
                onTask={() => openTask(athlete)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Modals */}
      <FeedbackModal
        visible={feedbackModal}
        athletes={athletes}
        preselected={preselectedAthlete}
        staffId={profile?.id ?? ''}
        clubId={profile?.club_id ?? ''}
        onClose={() => { setFeedbackModal(false); load(); }}
      />
      <TaskModal
        visible={taskModal}
        athletes={athletes}
        preselected={preselectedAthlete}
        staffId={profile?.id ?? ''}
        clubId={profile?.club_id ?? ''}
        onClose={() => { setTaskModal(false); load(); }}
      />
      <MatchModal
        visible={matchModal}
        staffId={profile?.id ?? ''}
        clubId={profile?.club_id ?? ''}
        onClose={() => setMatchModal(false)}
      />
    </View>
  );
}

// ─── Athlete row ──────────────────────────────────────────────────────────────
function AthleteRow({
  athlete, onPress, onFeedback, onTask,
}: {
  athlete: Athlete;
  onPress: () => void;
  onFeedback: () => void;
  onTask: () => void;
}) {
  const initials = getInitials(athlete.full_name);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
      <GlassCard radius={14} padding={14} intensity={58}>
        <View style={rowStyles.row}>
          <View style={rowStyles.avatar}>
            <Text style={rowStyles.avatarText}>{initials}</Text>
          </View>
          <View style={rowStyles.info}>
            <Text style={rowStyles.name}>{athlete.full_name}</Text>
            <View style={rowStyles.badges}>
              {athlete.unread_feedback > 0 && (
                <View style={[rowStyles.badge, rowStyles.badgeBlue]}>
                  <Text style={rowStyles.badgeText}>{athlete.unread_feedback} unread</Text>
                </View>
              )}
              {athlete.pending_tasks > 0 && (
                <View style={[rowStyles.badge, rowStyles.badgeGreen]}>
                  <Text style={rowStyles.badgeText}>{athlete.pending_tasks} tasks</Text>
                </View>
              )}
              {athlete.unread_feedback === 0 && athlete.pending_tasks === 0 && (
                <View style={rowStyles.badge}>
                  <Text style={rowStyles.badgeText}>All clear</Text>
                </View>
              )}
            </View>
          </View>
          <View style={rowStyles.actions}>
            <TouchableOpacity style={rowStyles.iconBtn} onPress={onFeedback} activeOpacity={0.7}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#60A5FA" />
            </TouchableOpacity>
            <TouchableOpacity style={rowStyles.iconBtn} onPress={onTask} activeOpacity={0.7}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { color: '#60A5FA', fontSize: 13, fontWeight: '700' },
  info:   { flex: 1 },
  name:   { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 5 },
  badges: { flexDirection: 'row', gap: 6 },
  badge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeBlue:  { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.25)' },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.1)',   borderColor: 'rgba(34,197,94,0.22)' },
  badgeText:  { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
});

// ─── Quick action button ──────────────────────────────────────────────────────
function QuickAction({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={{ flex: 1 }} onPress={onPress} activeOpacity={0.82}>
      <GlassCard radius={18} padding={14} intensity={80} style={{ flex: 1 }}>
        <View style={qaStyles.inner}>
          <View style={[qaStyles.iconWrap, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon as any} size={18} color={color} />
          </View>
          <Text style={qaStyles.label}>{label}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
});

// ─── Feedback Modal ───────────────────────────────────────────────────────────
function FeedbackModal({
  visible, athletes, preselected, staffId, clubId, onClose,
}: {
  visible: boolean;
  athletes: Athlete[];
  preselected: Athlete | null;
  staffId: string;
  clubId: string;
  onClose: () => void;
}) {
  const [selectedAthlete, setSelected] = useState<Athlete | null>(preselected);
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [actionPoint, setActionPoint]   = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (visible) {
      setSelected(preselected);
      setTitle('');
      setBody('');
      setActionPoint('');
      setError('');
    }
  }, [visible, preselected]);

  const submit = async () => {
    if (!selectedAthlete) { setError('Select an athlete.'); return; }
    if (!body.trim())     { setError('Feedback text is required.'); return; }
    setError('');
    setSubmitting(true);

    const { error: err } = await supabase.from('match_feedback').insert({
      athlete_id: selectedAthlete.id,
      created_by: staffId,
      title: title.trim() || null,
      feedback_text: body.trim(),
      action_point: actionPoint.trim() || null,
    });

    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onClose();
  };

  return (
    <ModalShell visible={visible} title="Give Feedback" onClose={onClose}>
      <Text style={modalStyles.fieldLabel}>Athlete</Text>
      <AthletePicker athletes={athletes} selected={selectedAthlete} onSelect={setSelected} />

      <Text style={modalStyles.fieldLabel}>Title (optional)</Text>
      <ModalInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Press triggers in transition"
      />

      <Text style={modalStyles.fieldLabel}>Feedback</Text>
      <ModalInput
        value={body}
        onChangeText={setBody}
        placeholder="What did you observe? What should they focus on?"
        multiline
        numberOfLines={4}
      />

      <Text style={modalStyles.fieldLabel}>Action point (optional)</Text>
      <ModalInput
        value={actionPoint}
        onChangeText={setActionPoint}
        placeholder="Specific action for the athlete"
      />

      {error ? <Text style={modalStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[modalStyles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={modalStyles.submitText}>Send Feedback</Text>
        }
      </TouchableOpacity>
    </ModalShell>
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({
  visible, athletes, preselected, staffId, clubId, onClose,
}: {
  visible: boolean;
  athletes: Athlete[];
  preselected: Athlete | null;
  staffId: string;
  clubId: string;
  onClose: () => void;
}) {
  const [selectedAthlete, setSelected] = useState<Athlete | null>(preselected);
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [dueDate, setDueDate]           = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    if (visible) {
      setSelected(preselected);
      setTitle('');
      setDescription('');
      setDueDate('');
      setError('');
    }
  }, [visible, preselected]);

  const submit = async () => {
    if (!selectedAthlete) { setError('Select an athlete.'); return; }
    if (!title.trim())    { setError('Task title is required.'); return; }
    setError('');
    setSubmitting(true);

    // Parse due date — expect DD/MM/YYYY or YYYY-MM-DD
    let dueDateISO: string | null = null;
    if (dueDate.trim()) {
      const parts = dueDate.trim().split(/[-/]/);
      let d: Date | null = null;
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD/MM/YYYY
          d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T23:59:00`);
        } else {
          // YYYY-MM-DD
          d = new Date(`${dueDate.trim()}T23:59:00`);
        }
      }
      if (d && !isNaN(d.getTime())) dueDateISO = d.toISOString();
      else { setError('Due date format: DD/MM/YYYY'); setSubmitting(false); return; }
    }

    const { error: err } = await supabase.from('tasks').insert({
      assigned_to: selectedAthlete.id,
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
      <Text style={modalStyles.fieldLabel}>Athlete</Text>
      <AthletePicker athletes={athletes} selected={selectedAthlete} onSelect={setSelected} />

      <Text style={modalStyles.fieldLabel}>Task title</Text>
      <ModalInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Recovery program — lower body"
      />

      <Text style={modalStyles.fieldLabel}>Description (optional)</Text>
      <ModalInput
        value={description}
        onChangeText={setDescription}
        placeholder="More detail about what needs to be done"
        multiline
        numberOfLines={3}
      />

      <Text style={modalStyles.fieldLabel}>Due date (optional)</Text>
      <ModalInput
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="DD/MM/YYYY"
        keyboardType="numbers-and-punctuation"
      />

      {error ? <Text style={modalStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[modalStyles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={modalStyles.submitText}>Assign Task</Text>
        }
      </TouchableOpacity>
    </ModalShell>
  );
}

// ─── Match Modal ──────────────────────────────────────────────────────────────
function MatchModal({
  visible, staffId, clubId, onClose,
}: {
  visible: boolean;
  staffId: string;
  clubId: string;
  onClose: () => void;
}) {
  const [opponent, setOpponent]   = useState('');
  const [date, setDate]           = useState('');
  const [time, setTime]           = useState('');
  const [location, setLocation]   = useState('');
  const [isHome, setIsHome]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (visible) {
      setOpponent(''); setDate(''); setTime('');
      setLocation(''); setIsHome(true); setError('');
    }
  }, [visible]);

  const submit = async () => {
    if (!opponent.trim()) { setError('Opponent name is required.'); return; }
    if (!date.trim())     { setError('Date is required. Format: DD/MM/YYYY'); return; }
    setError('');
    setSubmitting(true);

    // Parse DD/MM/YYYY + HH:MM
    const parts = date.trim().split(/[-/]/);
    let matchDate: Date | null = null;
    if (parts.length === 3 && parts[2].length === 4) {
      const [hh, mm] = (time.trim() || '12:00').split(':');
      matchDate = new Date(
        `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${(hh ?? '12').padStart(2, '0')}:${(mm ?? '00').padStart(2, '0')}:00`
      );
    }
    if (!matchDate || isNaN(matchDate.getTime())) {
      setError('Invalid date. Use DD/MM/YYYY');
      setSubmitting(false);
      return;
    }

    const { error: err } = await supabase.from('matches').insert({
      club_id: clubId,
      created_by: staffId,
      opponent: opponent.trim(),
      match_date: matchDate.toISOString(),
      location: location.trim() || null,
      is_home: isHome,
      status: 'upcoming',
    });

    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onClose();
  };

  return (
    <ModalShell visible={visible} title="Schedule Match" onClose={onClose}>
      <Text style={modalStyles.fieldLabel}>Opponent</Text>
      <ModalInput value={opponent} onChangeText={setOpponent} placeholder="e.g. City FC" />

      <Text style={modalStyles.fieldLabel}>Date</Text>
      <ModalInput value={date} onChangeText={setDate} placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />

      <Text style={modalStyles.fieldLabel}>Kick-off time</Text>
      <ModalInput value={time} onChangeText={setTime} placeholder="HH:MM  (e.g. 15:00)" keyboardType="numbers-and-punctuation" />

      <Text style={modalStyles.fieldLabel}>Location (optional)</Text>
      <ModalInput value={location} onChangeText={setLocation} placeholder="e.g. Home Park" />

      <Text style={modalStyles.fieldLabel}>Venue</Text>
      <View style={venueStyles.row}>
        <TouchableOpacity
          style={[venueStyles.btn, isHome && venueStyles.btnActive]}
          onPress={() => setIsHome(true)}
          activeOpacity={0.8}
        >
          <Text style={[venueStyles.btnText, isHome && venueStyles.btnTextActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[venueStyles.btn, !isHome && venueStyles.btnActive]}
          onPress={() => setIsHome(false)}
          activeOpacity={0.8}
        >
          <Text style={[venueStyles.btnText, !isHome && venueStyles.btnTextActive]}>Away</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={modalStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[modalStyles.submitBtn, submitting && { opacity: 0.6 }, { backgroundColor: '#B45309', borderColor: 'rgba(245,158,11,0.4)' }]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={modalStyles.submitText}>Add Match</Text>
        }
      </TouchableOpacity>
    </ModalShell>
  );
}

const venueStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnActive: { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.4)' },
  btnText:       { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  btnTextActive: { color: '#FCD34D' },
});

// ─── Shared modal shell ───────────────────────────────────────────────────────
function ModalShell({
  visible, title, onClose, children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
      </TouchableOpacity>

      {/* KAV positions sheet at bottom and lifts it when keyboard appears */}
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}>
          <BlurView intensity={72} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,14,26,0.65)' }]} />
          <View style={styles.sheetHandle} />
          <ScrollView
            style={{ zIndex: 1 }}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
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

// ─── Athlete picker ───────────────────────────────────────────────────────────
function AthletePicker({
  athletes, selected, onSelect,
}: {
  athletes: Athlete[];
  selected: Athlete | null;
  onSelect: (a: Athlete) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={pickerStyles.scroll}
      contentContainerStyle={pickerStyles.content}
    >
      {athletes.map(a => {
        const active = selected?.id === a.id;
        return (
          <TouchableOpacity
            key={a.id}
            style={[pickerStyles.chip, active && pickerStyles.chipActive]}
            onPress={() => onSelect(a)}
            activeOpacity={0.8}
          >
            <Text style={[pickerStyles.chipText, active && pickerStyles.chipTextActive]}>
              {a.full_name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const pickerStyles = StyleSheet.create({
  scroll:  { marginBottom: 16 },
  content: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: 'rgba(29,78,216,0.4)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
});

// ─── Modal input ──────────────────────────────────────────────────────────────
function ModalInput({
  value, onChangeText, placeholder, multiline, numberOfLines, keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  numberOfLines?: number;
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
        modalStyles.input,
        multiline && { height: (numberOfLines ?? 3) * 22 + 24, textAlignVertical: 'top' },
      ]}
    />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  orbTop: {
    position: 'absolute', top: -160, right: -160,
    width: W * 1.3, height: H * 0.65, borderRadius: 9999,
  },
  orbBottom: {
    position: 'absolute', bottom: -160, left: -120,
    width: W * 1.2, height: H * 0.65, borderRadius: 9999,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18,
  },
  headerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500', marginBottom: 3 },
  headerName:  { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  signOutBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    justifyContent: 'center', alignItems: 'center',
  },

  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1,
    paddingHorizontal: 20, marginBottom: 10,
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:   { fontSize: 14, color: 'rgba(255,255,255,0.25)' },

  listContent: { paddingHorizontal: 20, gap: 10 },

  // Modal
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: H * 0.88,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12,
    zIndex: 2,
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40, zIndex: 1 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 18,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});

const modalStyles = StyleSheet.create({
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
  error: {
    fontSize: 13, color: '#FCA5A5',
    marginBottom: 12, textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
