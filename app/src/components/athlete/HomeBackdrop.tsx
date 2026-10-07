/**
 * HomeBackdrop — the light behind Home.
 *
 * **It hangs from the top** (2026-09-20, after a reference Magne liked) rather
 * than rising from the floor, and reaches only about half way down, so the
 * screen has turned back to the page colour by the time the boxes start. The
 * headline sits in the colour; the boxes sit in the dark.
 *
 * **It lives in `AthleteFrame`, not in the section**, so it covers the header
 * as well. Drawn inside the section it began under the wordmark, which put a
 * hard horizontal seam across the top of the screen.
 *
 * **Matchday** adds a denser layer over the everyday one — more saturated, a
 * brighter core, and a slow breath — so the two can never disagree about where
 * the light sits.
 *
 * Gradients, not blur, so nothing ends in a hard edge, and drawn in a 100×100
 * viewBox stretched to the frame (`preserveAspectRatio="none"`): the pools are
 * fractions of the width across and the height down either way, so the shapes
 * are identical and nothing waits for a measured size.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { hsla } from '../../utils/theme';

/**
 * The light's default hue. A fixture overrides it with **the opposing side's
 * colour** when the club has recorded one, so the room Home sits in takes the
 * colour of whoever is next — see `matches.opponent_color`.
 */
const HUE = 200;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export default function HomeBackdrop({ matchday, hue = HUE }: { matchday: boolean; hue?: number }) {
  const boost = useSharedValue(matchday ? 1 : 0);
  const breath = useSharedValue(1);

  useEffect(() => {
    boost.value = withTiming(matchday ? 1 : 0, { duration: 700, easing: EASE });
    if (matchday) {
      breath.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(1, { duration: 400 });
    }
  }, [matchday]); // eslint-disable-line react-hooks/exhaustive-deps

  const boostStyle = useAnimatedStyle(() => ({ opacity: boost.value * breath.value }));

  const a = hsla(hue, 95, 58);
  const b = hsla(hue + 18, 95, 64);
  const c = hsla(hue, 100, 62);
  const core = hsla(hue - 12, 100, 72);

  return (
    <>
      <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="hangA" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={a} stopOpacity={0.8} />
              <Stop offset={0.55} stopColor={a} stopOpacity={0.34} />
              <Stop offset={1} stopColor={a} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="hangB" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={b} stopOpacity={0.55} />
              <Stop offset={0.5} stopColor={b} stopOpacity={0.2} />
              <Stop offset={1} stopColor={b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Centres sit on the ceiling, so the pools hang from it, and reach
              a little past half way down — the boxes sit in the dark below. */}
          <Ellipse cx={46} cy={0} rx={96} ry={60} fill="url(#hangA)" />
          <Ellipse cx={88} cy={0} rx={62} ry={42} fill="url(#hangB)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, boostStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="boostWide" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={c} stopOpacity={0.85} />
              <Stop offset={0.5} stopColor={c} stopOpacity={0.4} />
              <Stop offset={0.9} stopColor={c} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="boostCore" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={core} stopOpacity={0.7} />
              <Stop offset={0.4} stopColor={core} stopOpacity={0.35} />
              <Stop offset={1} stopColor={core} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={50} cy={0} rx={112} ry={66} fill="url(#boostWide)" />
          <Ellipse cx={52} cy={0} rx={64} ry={36} fill="url(#boostCore)" />
        </Svg>
      </Animated.View>
    </>
  );
}
