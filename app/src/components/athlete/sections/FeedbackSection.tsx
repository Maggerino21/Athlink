import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../ui/GlassCard';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface FeedbackItem {
  id: string;
  title: string | null;
  feedback_text: string;
  action_point: string | null;
  acknowledged: boolean;
  created_at: string;
  created_by: string;
  staff_name: string;
  staff_role: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function FeedbackSection({ isActive }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const [items, setItems]     = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('match_feedback')
      .select(`
        id, title, feedback_text, action_point, acknowledged, created_at, created_by,
        staff:profiles!match_feedback_created_by_fkey(full_name, role)
      `)
      .eq('athlete_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setItems(data.map((row: any) => ({
        id: row.id,
        title: row.title,
        feedback_text: row.feedback_text,
        action_point: row.action_point,
        acknowledged: row.acknowledged,
        created_at: row.created_at,
        created_by: row.created_by,
        staff_name: row.staff?.full_name ?? 'Staff',
        staff_role: row.staff?.role === 'staff' ? 'Coach / Staff' : 'Staff',
      })));
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when this tab becomes the active page
  useEffect(() => {
    if (isActive) load();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledge = async (id: string) => {
    const { error } = await supabase
      .from('match_feedback')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setItems(prev => prev.map(f => f.id === id ? { ...f, acknowledged: true } : f));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="rgba(255,255,255,0.4)" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="chatbubble-outline" size={36} color="rgba(255,255,255,0.12)" />
        <Text style={styles.emptyTitle}>No feedback yet</Text>
        <Text style={styles.emptySub}>Your coach and staff feedback will appear here.</Text>
      </View>
    );
  }

  const unread = items.filter(f => !f.acknowledged);
  const read   = items.filter(f => f.acknowledged);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />
      }
    >
      {unread.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Unread</Text>
          {unread.map(item => (
            <FeedbackCard key={item.id} item={item} onAcknowledge={acknowledge} />
          ))}
        </>
      )}

      {read.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, unread.length > 0 && { marginTop: 8 }]}>
            Earlier
          </Text>
          {read.map(item => (
            <FeedbackCard key={item.id} item={item} onAcknowledge={acknowledge} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function FeedbackCard({
  item,
  onAcknowledge,
}: {
  item: FeedbackItem;
  onAcknowledge: (id: string) => void;
}) {
  const initials = getInitials(item.staff_name);
  const unread   = !item.acknowledged;

  return (
    <GlassCard
      elevated={unread}
      intensity={unread ? 68 : 52}
      style={styles.card}
    >
      {unread && <View style={styles.unreadBar} />}

      <View style={styles.cardHeader}>
        <View style={styles.fromRow}>
          <View style={styles.fromAvatar}>
            <Text style={styles.fromAvatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.fromName}>{item.staff_name}</Text>
            <Text style={styles.fromRole}>{item.staff_role}</Text>
          </View>
        </View>
        <View style={styles.dateBadge}>
          {unread && <View style={styles.unreadDot} />}
          <Text style={styles.dateText}>{relativeTime(item.created_at)}</Text>
        </View>
      </View>

      {item.title && (
        <Text style={styles.feedbackTitle}>{item.title}</Text>
      )}
      <Text style={styles.feedbackBody}>{item.feedback_text}</Text>

      {item.action_point && (
        <View style={styles.actionBox}>
          <Text style={styles.actionLabel}>Action</Text>
          <Text style={styles.actionText}>{item.action_point}</Text>
        </View>
      )}

      {!item.acknowledged ? (
        <TouchableOpacity
          style={styles.ackBtn}
          onPress={() => onAcknowledge(item.id)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.ackBtnText}>I understand</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.ackDone}>
          <Ionicons name="checkmark-circle" size={13} color="#4ADE80" style={{ marginRight: 5 }} />
          <Text style={styles.ackDoneText}>Acknowledged</Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, gap: 12, paddingBottom: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
  emptySub:   { fontSize: 13, color: 'rgba(255,255,255,0.15)', textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 2,
  },

  card: {},

  unreadBar: {
    position: 'absolute', left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: 2,
    backgroundColor: '#3B82F6',
    zIndex: 10,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  fromRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fromAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  fromAvatarText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },
  fromName:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  fromRole:       { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  dateBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B82F6' },
  dateText:       { fontSize: 11, color: 'rgba(255,255,255,0.3)' },

  feedbackTitle: { fontSize: 15, fontWeight: '600', color: '#F1F5F9', marginBottom: 6 },
  feedbackBody:  { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginBottom: 12 },

  actionBox: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.18)',
    overflow: 'hidden',
  },
  actionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(147,197,253,0.8)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  actionText:  { fontSize: 13, color: 'rgba(147,197,253,0.85)', lineHeight: 18 },

  ackBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  ackBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  ackDone: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
  },
  ackDoneText: { color: 'rgba(74,222,128,0.7)', fontSize: 13, fontWeight: '500' },
});
