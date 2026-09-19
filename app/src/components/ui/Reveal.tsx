/**
 * Reveal — how an athlete tab waits for its data.
 *
 * One rule, learned from Schedule: **never draw a value you do not have yet.**
 * Home used to open on its dev stand-ins (or "No match scheduled" and zeros in
 * a release build), and Fines on "0 kr" and "Nobody has been fined yet this
 * season", then cut hard to the real thing ~400ms later. Every one of those
 * frames was a false claim, and the cut made the screen look unsure of itself.
 *
 * So until `ready`, nothing is drawn under the tab's title. When the data
 * lands, the content fades in as one piece — never field by field.
 *
 * - **Ready at mount** (the tab had a cached copy — see `utils/cache`): shown
 *   at once, no fade. It was never absent, so nothing arrives.
 * - **Slow** (past `SLOW_MS`): a quiet spinner fades in, so a bad connection
 *   reads as "working" rather than "broken". A normal load never shows it — a
 *   spinner that flashes for 200ms is worse than none.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn, FadeOut, Easing, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { TEXT } from '../../utils/tokens';

const FADE_MS = 220;
const SLOW_MS = 700;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export default function Reveal({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  const opacity = useSharedValue(ready ? 1 : 0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (ready) {
      opacity.value = withTiming(1, { duration: FADE_MS, easing: EASE });
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // The outer View stays put across the switch, so the spinner is removed from
  // a live parent and its exit fade actually plays over the content's entry.
  return (
    <View style={styles.fill}>
      {ready && <Animated.View style={[styles.fill, fade]}>{children}</Animated.View>}
      {!ready && slow && (
        <Animated.View
          entering={FadeIn.duration(FADE_MS)}
          exiting={FadeOut.duration(120)}
          pointerEvents="none"
          style={styles.wait}
        >
          <ActivityIndicator color={TEXT.tertiary} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wait: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
