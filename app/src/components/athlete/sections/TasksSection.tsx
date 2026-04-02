import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../ui/GlassCard';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'completed' | 'unable';
  created_by: string;
  staff_name: string;
}

function formatDue(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: 'No deadline', overdue: false };
  const due  = new Date(iso);
  const now  = new Date();
  const diff = Math.ceil((due.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diff < 0)  return { label: 'Overdue',   overdue: true };
  if (diff === 0) return { label: 'Today',     overdue: false };
  if (diff === 1) return { label: 'Tomorrow',  overdue: false };
  if (diff < 7)  return { label: `In ${diff} days`, overdue: false };
  return {
    label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    overdue: false,
  };
}

export default function TasksSection({ isActive }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('tasks')
      .select(`
        id, title, description, due_date, status, created_by,
        staff:profiles!tasks_created_by_fkey(full_name)
      `)
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false });

    if (data) {
      setTasks(data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        due_date: row.due_date,
        status: row.status,
        created_by: row.created_by,
        staff_name: row.staff?.full_name ?? 'Staff',
      })));
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when this tab becomes the active page
  useEffect(() => {
    if (isActive) load();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const markComplete = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    }
  };

  const markPending = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'pending', completed_at: null })
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="rgba(255,255,255,0.4)" />
      </View>
    );
  }

  if (tasks.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle-outline" size={36} color="rgba(255,255,255,0.12)" />
        <Text style={styles.emptyTitle}>No tasks assigned</Text>
        <Text style={styles.emptySub}>When your coach assigns you tasks, they'll show up here.</Text>
      </View>
    );
  }

  const pending   = tasks.filter(t => t.status === 'pending');
  const completed = tasks.filter(t => t.status !== 'pending');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />
      }
    >
      <Text style={styles.sectionLabel}>Assigned Tasks</Text>
      {pending.map(t => (
        <TaskCard key={t.id} task={t} onComplete={markComplete} onUndo={markPending} />
      ))}

      {completed.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Completed</Text>
          {completed.map(t => (
            <TaskCard key={t.id} task={t} onComplete={markComplete} onUndo={markPending} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TaskCard({
  task,
  onComplete,
  onUndo,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const done = task.status !== 'pending';
  const { label, overdue } = formatDue(task.due_date);

  return (
    <GlassCard
      radius={14}
      padding={14}
      intensity={done ? 45 : 62}
      style={done ? styles.cardDone : undefined}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.checkbox, done && styles.checkboxDone]}
          onPress={() => done ? onUndo(task.id) : onComplete(task.id)}
          activeOpacity={0.7}
        >
          {done && <Ionicons name="checkmark" size={13} color="#fff" />}
        </TouchableOpacity>

        <View style={styles.body}>
          <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
          {task.description && (
            <Text style={styles.taskDetail}>{task.description}</Text>
          )}
          <View style={styles.meta}>
            <View style={[styles.duePill, overdue && styles.duePillOverdue]}>
              <Text style={[styles.dueText, overdue && styles.dueTextOverdue]}>{label}</Text>
            </View>
            <Text style={styles.assignedBy}>from {task.staff_name}</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, gap: 8, paddingBottom: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
  emptySub:   { fontSize: 13, color: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 2,
  },

  cardDone: { opacity: 0.45 },

  row:      { flexDirection: 'row', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxDone: { backgroundColor: '#1D4ED8', borderColor: '#3B82F6' },

  body:          { flex: 1 },
  taskTitle:     { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 4, lineHeight: 20 },
  taskTitleDone: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.3)' },
  taskDetail:    { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18, marginBottom: 10 },

  meta:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duePill:    { backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  duePillOverdue: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' },
  dueText:    { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  dueTextOverdue: { color: '#FCA5A5' },
  assignedBy: { fontSize: 11, color: 'rgba(255,255,255,0.22)' },
});
