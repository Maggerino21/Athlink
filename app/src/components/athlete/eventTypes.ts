/**
 * Shared calendar-event vocabulary.
 *
 * Extracted from ScheduleSection when the detail view became a real navigation
 * route: the section and the sheet screen both need these, and duplicating the
 * colour map is exactly how the two ended up disagreeing about event types in
 * the first place.
 *
 * Keep in sync with `EVENT_ICONS` in ThisWeekSection, and with the types the
 * web app writes (see CLAUDE.md § Event types).
 */

export type EventType =
  | 'training' | 'home' | 'rehab' | 'exercise' | 'recovery'
  | 'meeting' | 'match' | 'vacation' | 'other';

export interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  /** Local wall-clock "HH:MM", or null for all-day / continuation days. */
  start_time: string | null;
  location: string | null;
  description: string | null;
  date: string; // YYYY-MM-DD, local
  source: 'event' | 'match';
  /** Multi-day blocks are expanded across days for display; 1-based. */
  spanDay?: number;
  spanTotal?: number;
  // Club-owned matchday detail.
  meet_time?: string | null;      // local "HH:MM"
  meet_location?: string | null;
  notes?: string | null;
  opponent_logo_url?: string | null;
  is_home?: boolean | null;
}

export const EVENT_META: Record<EventType, { icon: string; color: string }> = {
  training: { icon: 'fitness',          color: '#3B82F6' },
  home:     { icon: 'home',             color: '#34D399' },
  rehab:    { icon: 'medkit',           color: '#A78BFA' },
  exercise: { icon: 'barbell',          color: '#8B5CF6' },
  recovery: { icon: 'leaf',             color: '#22C55E' },
  meeting:  { icon: 'people',           color: '#EC4899' },
  match:    { icon: 'football',         color: '#F97316' },
  vacation: { icon: 'partly-sunny',     color: '#FBBF24' },
  other:    { icon: 'calendar-outline', color: '#6B7280' },
};
