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

import i18n from '../../i18n';
import { matteAccent, type MatteAccent } from '../../utils/theme';
import type { ToDoItem } from './useToDo';

export type EventType =
  | 'training' | 'home' | 'rehab' | 'exercise' | 'recovery'
  | 'travel' | 'meeting' | 'match' | 'vacation' | 'other'
  // Not events — things the staff sent this player, placed on their day. See useToDo.
  | 'task' | 'feedback';

export interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  /** Local wall-clock "HH:MM", or null for all-day / continuation days. */
  start_time: string | null;
  location: string | null;
  description: string | null;
  date: string; // YYYY-MM-DD, local
  source: 'event' | 'match' | 'task' | 'feedback';
  /** Multi-day blocks are expanded across days for display; 1-based. */
  spanDay?: number;
  spanTotal?: number;
  // Club-owned matchday detail.
  meet_time?: string | null;      // local "HH:MM"
  meet_location?: string | null;
  notes?: string | null;
  opponent_logo_url?: string | null;
  is_home?: boolean | null;
  /** The opposing club's colour, when the club has recorded one. */
  opponent_color?: string | null;
  /** Set on `task` / `feedback` rows: what the sheet shows when one is tapped. */
  note?: ToDoItem;
}

export const EVENT_META: Record<EventType, { icon: string; color: string }> = {
  training: { icon: 'fitness',          color: '#3B82F6' },
  home:     { icon: 'home',             color: '#34D399' },
  rehab:    { icon: 'medkit',           color: '#A78BFA' },
  exercise: { icon: 'barbell',          color: '#8B5CF6' },
  recovery: { icon: 'leaf',             color: '#22C55E' },
  travel:   { icon: 'airplane',         color: '#F59E0B' },
  meeting:  { icon: 'people',           color: '#EC4899' },
  match:    { icon: 'football',         color: '#F97316' },
  vacation: { icon: 'partly-sunny',     color: '#FBBF24' },
  other:    { icon: 'calendar-outline', color: '#6B7280' },
  // One colour for both: to a player they are the same kind of thing — from
  // your staff, addressed to you — and the type palette is already crowded.
  // Home's To do tile uses the same hue.
  task:     { icon: 'checkbox-outline', color: '#14B8A6' },
  feedback: { icon: 'chatbox-ellipses-outline', color: '#14B8A6' },
};

/**
 * Always use this rather than indexing EVENT_META directly.
 *
 * `type` arrives from the database, where it is a plain text column, so it is
 * not actually constrained to EventType however the TS says otherwise — the web
 * app can introduce a category the mobile build has never heard of. A raw
 * `EVENT_META[type].color` then throws on undefined, and because the lookup sits
 * inside a render it takes the entire tab down to a white screen rather than
 * spoiling one row. That is exactly how a single `travel` event blanked
 * Schedule. Degrade to `other` instead.
 */
export function eventMeta(type: string): { icon: string; color: string } {
  return EVENT_META[type as EventType] ?? EVENT_META.other;
}

/**
 * The type's name in the user's language.
 *
 * `type` is a plain text column, so a category the app has never heard of just
 * falls back to the raw value with a capital — the same degrade-don't-throw
 * rule as `eventMeta`.
 */
export function eventTypeLabel(type: string): string {
  const key = `eventType.${type}`;
  const label = i18n.t(key);
  return label === key ? type.charAt(0).toUpperCase() + type.slice(1) : label;
}

/**
 * The matte form of a type's colour — what the UI should actually draw.
 *
 * `EVENT_META.color` stays the source of truth for the hue, but nothing should
 * paint it raw any more: at full saturation it reads neon against the matte
 * surfaces. Ask for the accent, not the colour.
 */
/**
 * What a calendar item is actually drawn in.
 *
 * **A match wears the opposing side's colour** where the club has recorded one
 * — a fixture against Lillestrøm is yellow, against Tromsø red — because that
 * is how a squad thinks about its season. Everything else wears its type, and
 * a match with no colour stored falls back to the match clay, so a club that
 * never fills the field in sees exactly what it saw before.
 */
export function itemAccent(item: { type: string; opponent_color?: string | null }): MatteAccent {
  return item.type === 'match' && item.opponent_color
    ? matteAccent(item.opponent_color)
    : eventAccent(item.type);
}

export function eventAccent(type: string): MatteAccent {
  return matteAccent(eventMeta(type).color);
}
