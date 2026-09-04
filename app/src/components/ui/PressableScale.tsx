/**
 * PressableScale — a tap target that compresses slightly under the finger.
 *
 * Uses a gesture-handler Tap rather than RN's Pressable so the press-down
 * visual is produced on the UI thread. With Pressable the highlight waits on a
 * JS round-trip, which is exactly the "half a beat late" feeling that makes an
 * app read as a web page in a shell. Here the scale starts on touch-down even
 * if JS is mid-render.
 *
 * `maxDistance` lets the gesture fail cleanly when the finger travels, so these
 * can be nested inside a ScrollView without stealing the scroll.
 */
import React, { useCallback } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import haptics from '../../utils/haptics';

type HapticKind = 'selection' | 'soft' | 'medium' | 'success' | 'none';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** How far to compress. 1 = no movement. Default 0.97. */
  scaleTo?: number;
  /** Dim slightly as well as compress. Default true. */
  dim?: boolean;
  haptic?: HapticKind;
  disabled?: boolean;
}

const PRESS_IN  = { duration: 90,  easing: Easing.out(Easing.quad) } as const;
const PRESS_OUT = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.97,
  dim = true,
  haptic = 'selection',
  disabled = false,
}: Props) {
  const pressed = useSharedValue(0);

  const fire = useCallback(() => {
    if (haptic !== 'none') haptics[haptic]();
    onPress?.();
  }, [haptic, onPress]);

  const fireLong = useCallback(() => {
    haptics.medium();
    onLongPress?.();
  }, [onLongPress]);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    // Generous duration so a slow, deliberate tap still counts; distance is what
    // decides whether this was a tap or the start of a scroll.
    .maxDuration(4000)
    .maxDistance(14)
    .onBegin(() => {
      pressed.value = withTiming(1, PRESS_IN);
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, PRESS_OUT);
    })
    .onEnd((_e, success) => {
      if (success) runOnJS(fire)();
    });

  const long = Gesture.LongPress()
    .enabled(!disabled && !!onLongPress)
    .minDuration(450)
    .onStart(() => {
      runOnJS(fireLong)();
    });

  const gesture = onLongPress ? Gesture.Exclusive(long, tap) : tap;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: dim ? 1 - pressed.value * 0.14 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
