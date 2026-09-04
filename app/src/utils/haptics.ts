/**
 * Thin wrapper over expo-haptics.
 *
 * Two reasons this exists rather than calling expo-haptics directly:
 *  1. Haptics are iOS-only in practice — Android support is patchy and the
 *     Web build has none at all. Every call here is fire-and-forget and can
 *     never throw into a render path or an animation callback.
 *  2. It keeps the vocabulary small. Six named intents, so the app stays
 *     consistent about what a given physical sensation *means*.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(run: () => Promise<void>) {
  if (!enabled) return;
  run().catch(() => {
    /* haptics are decorative — never let a failure surface */
  });
}

export const haptics = {
  /** Light tick — tab changes, selection moves, page snaps. */
  selection: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Softer, rounder tap — a sheet settling open or closed. */
  soft: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),

  /** Firmer tap — committing to something (opening a detail, submitting). */
  medium: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Task completed, feedback acknowledged — a small win. */
  success: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Something didn't go through. */
  error: () =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Passing a detent or crossing a threshold mid-gesture. */
  rigid: () =>
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
};

export default haptics;
