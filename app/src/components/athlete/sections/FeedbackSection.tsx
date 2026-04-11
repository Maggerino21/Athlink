import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../../ui/GlassCard';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

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
  created_at: string;
  created_by: string;
  staff_name: string;
  staff_role: string;
}

const REACTIONS = [
  { emoji: '👍', label: 'Got it'    },
  { emoji: '💪', label: 'On it'     },
  { emoji: '🔥', label: "Let's go"  },
  { emoji: '🤔', label: 'Questions' },
];

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
        id, title, feedback_text, processed_text, action_point,
        is_ai_processed, acknowledged, reaction, athlete_reply,
        created_at, created_by,
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
        processed_text: row.processed_text,
        action_point: row.action_point,
        is_ai_processed: row.is_ai_processed ?? false,
        acknowledged: row.acknowledged,
        reaction: row.reaction,
        athlete_reply: row.athlete_reply,
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

  const react = async (id: string, emoji: string) => {
    const { error } = await supabase
      .from('match_feedback')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString(), reaction: emoji })
      .eq('id', id);
    if (!error) {
      setItems(prev => prev.map(f =>
        f.id === id ? { ...f, acknowledged: true, reaction: emoji } : f
      ));
    }
  };

  const submitReply = async (id: string, text: string) => {
    if (!text.trim()) return;
    const { error } = await supabase
      .from('match_feedback')
      .update({ athlete_reply: text.trim() })
      .eq('id', id);
    if (!error) {
      setItems(prev => prev.map(f =>
        f.id === id ? { ...f, athlete_reply: text.trim() } : f
      ));
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
            <FeedbackCard key={item.id} item={item} onReact={react} onReply={submitReply} />
          ))}
        </>
      )}

      {read.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, unread.length > 0 && { marginTop: 8 }]}>
            Earlier
          </Text>
          {read.map(item => (
            <FeedbackCard key={item.id} item={item} onReact={react} onReply={submitReply} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function FeedbackCard({
  item, onReact, onReply,
}: {
  item: FeedbackItem;
  onReact: (id: string, emoji: string) => void;
  onReply: (id: string, text: string) => void;
}) {
  const initials   = getInitials(item.staff_name);
  const unread     = !item.acknowledged;
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending]     = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    await onReply(item.id, replyText);
    setSending(false);
    setShowReply(false);
    setReplyText('');
  };

  return (
    <GlassCard elevated={unread} intensity={unread ? 68 : 52} style={styles.card}>
      {unread && <View style={styles.unreadBar} />}

      {/* Header */}
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

      {/* Content */}
      {item.title && <Text style={styles.feedbackTitle}>{item.title}</Text>}

      {item.is_ai_processed && (
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={11} color="#93C5FD" style={{ marginRight: 4 }} />
          <Text style={styles.aiBadgeText}>Translated by AI</Text>
        </View>
      )}

      <Text style={styles.feedbackBody}>{item.processed_text ?? item.feedback_text}</Text>

      {item.action_point && (
        <View style={styles.actionBox}>
          <Text style={styles.actionLabel}>Action</Text>
          <Text style={styles.actionText}>{item.action_point}</Text>
        </View>
      )}

      {/* Reactions / acknowledged state */}
      {!item.acknowledged ? (
        <>
          <Text style={styles.reactPrompt}>How did you receive this?</Text>
          <View style={styles.reactionRow}>
            {REACTIONS.map(r => (
              <TouchableOpacity
                key={r.emoji}
                style={styles.reactionBtn}
                onPress={() => onReact(item.id, r.emoji)}
                activeOpacity={0.75}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={styles.reactionLabel}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.ackDone}>
          {item.reaction
            ? <Text style={styles.reactionDone}>{item.reaction}  </Text>
            : <Ionicons name="checkmark-circle" size={13} color="#4ADE80" style={{ marginRight: 5 }} />
          }
          <Text style={styles.ackDoneText}>Acknowledged</Text>
        </View>
      )}

      {/* Athlete reply */}
      {item.athlete_reply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Your reply</Text>
          <Text style={styles.replyText}>{item.athlete_reply}</Text>
        </View>
      ) : item.acknowledged && !showReply ? (
        <TouchableOpacity onPress={() => setShowReply(true)} activeOpacity={0.7} style={styles.replyLink}>
          <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.25)" style={{ marginRight: 5 }} />
          <Text style={styles.replyLinkText}>Add a reply…</Text>
        </TouchableOpacity>
      ) : showReply ? (
        <View style={styles.replyInputWrap}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Write your reply…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={styles.replyInput}
            multiline
            autoFocus
          />
          <View style={styles.replyActions}>
            <TouchableOpacity onPress={() => setShowReply(false)} activeOpacity={0.7}>
              <Text style={styles.replyCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReply}
              disabled={sending}
              style={[styles.replySendBtn, sending && { opacity: 0.6 }]}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.replySendText}>Send</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
  aiBadge: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8,
  },
  aiBadgeText: { fontSize: 11, color: 'rgba(147,197,253,0.55)', fontWeight: '500' },

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

  reactPrompt: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textAlign: 'center' },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 4 },
  reactionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  reactionEmoji: { fontSize: 20, marginBottom: 3 },
  reactionLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '500', textAlign: 'center' },
  reactionDone:  { fontSize: 18 },

  replyBox: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  replyLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  replyText:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },

  replyLink: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 4 },
  replyLinkText: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },

  replyInputWrap: { marginTop: 10 },
  replyInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 10, color: '#fff', fontSize: 13, lineHeight: 19,
    minHeight: 72, textAlignVertical: 'top',
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 14, marginTop: 8 },
  replyCancelText: { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
  replySendBtn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  replySendText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
