/**
 * SlideUpSheet — SUPERSEDED. No longer used by the app.
 *
 * Detail views are now presented as real iOS sheets via a native-stack screen
 * with `presentation: 'formSheet'` — see `RootNavigator`'s athlete sheet group,
 * and `EventDetailScreen` / `BriefingScreen`.
 *
 * The reason is the same one that moved the tab bar to `BottomTabs`:
 * `expo-glass-effect` gives you the *material*, while the platform gives you
 * the *control*. `UISheetPresentationController` brings detents, the grabber,
 * interactive dismissal with the system's own physics, scroll-to-expand and the
 * stacked-card recede behind — none of which a hand-built sheet reproduces, and
 * all of which are what make an iOS sheet feel like one.
 *
 * Kept for reference and as a possible non-iOS fallback. Prefer the route.
 *
 * ── Original notes ──
 *
 * SlideUpSheet — a reusable bottom sheet that slides up from the bottom.
 *
 * Everything that happens while your finger is down runs on the UI thread as a
 * Reanimated worklet. The JS thread can be busy parsing a Supabase response and
 * the drag still tracks at display rate — which is the whole difference between
 * this and the PanResponder version it replaces.
 *
 * Behaviour worth knowing:
 *  - Drag from anywhere on the sheet, not just the handle. The pan only engages
 *    once the inner scroll view is at the top, so scrolling content and pulling
 *    the sheet down never fight each other.
 *  - Pulling *up* past the top meets exponential resistance and springs back,
 *    the way an iOS sheet does.
 *  - Dismissal is velocity-aware: a short fast flick closes it, a long slow drag
 *    that stops short of the threshold snaps back.
 *  - The backdrop fades continuously with the drag, so the gesture feels
 *    connected to the whole screen rather than to one moving card.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import haptics from '../../utils/haptics';
import { CAN_USE_GLASS } from '../../utils/glass';

/** Capability detection lives in utils/glass.ts. */
const LIQUID = CAN_USE_GLASS;

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.62;

/** Drag this far and release → dismiss. */
const DRAG_CLOSE_THRESHOLD = SHEET_HEIGHT * 0.28;
/** …or flick faster than this, wherever you happen to be. */
const FLICK_VELOCITY = 900;
/** How far an upward overscroll can stretch before it stops moving at all. */
const OVERSCROLL_MAX = 90;

// Duration+dampingRatio springs rather than tension/friction — far easier to
// reason about, and these are tuned to sit just under iOS's own sheet timing.
const SPRING_IN     = { duration: 520, dampingRatio: 0.82 } as const;
const SPRING_SETTLE = { duration: 400, dampingRatio: 0.78 } as const;
const TIMING_OUT    = { duration: 260, easing: Easing.in(Easing.cubic) } as const;

/**
 * Exponential resistance for pulling the sheet above its resting position.
 * Approaches OVERSCROLL_MAX asymptotically, so it never runs away.
 */
function resist(dy: number): number {
  'worklet';
  return -OVERSCROLL_MAX * (1 - Math.exp(dy / OVERSCROLL_MAX));
}

interface SlideUpSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function SlideUpSheet({ visible, onClose, title, children }: SlideUpSheetProps) {
  const insets = useSafeAreaInsets();

  // Separate from the parent's `visible` — the Modal stays mounted through the
  // exit animation and only unmounts once it has fully slid away.
  const [modalMounted, setModalMounted] = useState(false);

  const translateY = useSharedValue(SHEET_HEIGHT);
  const scrollY    = useSharedValue(0);

  // Per-gesture bookkeeping. `engagedAt` is the translationY reading at the
  // moment the drag took over from the scroll view, so a user who scrolls to
  // the top and keeps pulling in one continuous motion doesn't see the sheet
  // jump by however far they had already scrolled.
  const engaged   = useSharedValue(false);
  const engagedAt = useSharedValue(0);

  // Plain ref, not useAnimatedRef — gesture-handler needs a component ref here
  // and nothing reads this from a worklet.
  const scrollRef = useRef<any>(null);

  const finishClose = useCallback(() => {
    setModalMounted(false);
  }, []);

  // Step 1 — mount (or begin the exit). Starting the entry animation here would
  // run its first frames before the Modal exists, so the sheet would appear
  // already part-way up.
  useEffect(() => {
    if (visible) {
      translateY.value = SHEET_HEIGHT;
      scrollY.value = 0;
      setModalMounted(true);
    } else if (modalMounted) {
      translateY.value = withTiming(SHEET_HEIGHT, TIMING_OUT, (done) => {
        if (done) runOnJS(finishClose)();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2 — the Modal is now rendered, so animate in.
  useEffect(() => {
    if (modalMounted && visible) {
      translateY.value = withSpring(0, SPRING_IN);
      haptics.soft();
    }
  }, [modalMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const requestClose = useCallback(() => {
    haptics.soft();
    onClose();
  }, [onClose]);

  const pan = Gesture.Pan()
    // Only take over once the movement is clearly vertical, so horizontal
    // swipes inside the content are left alone.
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    // Without this the pan activating would cancel the ScrollView's native
    // touch and the sheet's content would simply refuse to scroll. Declaring
    // them simultaneous lets both run; the `atTop` check below is what decides
    // which one actually moves anything.
    .simultaneousWithExternalGesture(scrollRef)
    .onBegin(() => {
      engaged.value = false;
      engagedAt.value = 0;
    })
    .onUpdate((e) => {
      const atTop = scrollY.value <= 0;

      if (!engaged.value) {
        // Take over from the scroll view the first time we're at the top and
        // still pulling downward.
        if (atTop && e.translationY > 0) {
          engaged.value = true;
          engagedAt.value = e.translationY;
        } else if (atTop && e.translationY < 0 && translateY.value < 0.5) {
          // Upward pull with nothing to scroll — that's an overscroll stretch.
          engaged.value = true;
          engagedAt.value = e.translationY;
        } else {
          return;
        }
      }

      const dy = e.translationY - engagedAt.value;
      translateY.value = dy >= 0 ? dy : resist(dy);
    })
    .onEnd((e) => {
      if (!engaged.value) return;

      const projected = translateY.value + e.velocityY * 0.15;
      const shouldClose =
        translateY.value > DRAG_CLOSE_THRESHOLD ||
        e.velocityY > FLICK_VELOCITY ||
        projected > SHEET_HEIGHT * 0.5;

      if (shouldClose) {
        // Hand the closing animation to the `visible` effect above by telling
        // the parent — but carry the finger's momentum into it so the sheet
        // doesn't visibly restart from rest.
        translateY.value = withTiming(SHEET_HEIGHT, TIMING_OUT);
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, SPRING_SETTLE);
      }
      engaged.value = false;
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, SHEET_HEIGHT],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Modal visible={modalMounted} transparent animationType="none" onRequestClose={requestClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            { height: SHEET_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
            sheetStyle,
          ]}
        >
          {/* The material. Whatever renders here must stay *translucent* — the
              previous version put an 85%-opaque fill directly on top of a
              BlurView, so the blur was invisible and paying for itself in GPU
              time for nothing. Whatever replaces it must keep that in mind. */}
          {LIQUID ? (
            <GlassView
              glassEffectStyle="regular"
              colorScheme="dark"
              style={[StyleSheet.absoluteFill, styles.sheetGlassRadius]}
            />
          ) : (
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <View style={[styles.sheetInner, LIQUID ? styles.sheetScrimGlass : styles.sheetScrimBlur]}>
            {/* Drag handle */}
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            {title && (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Pressable
                  onPress={requestClose}
                  style={styles.closeBtn}
                  hitSlop={12}
                >
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
                </Pressable>
              </View>
            )}

            {/* Content */}
            <Animated.ScrollView
              ref={scrollRef}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              // No rubber-banding at the top — that space belongs to the sheet
              // drag, and two elastic responses at once reads as a glitch.
              bounces={false}
            >
              {children}
            </Animated.ScrollView>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
  },
  sheetGlassRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  // Light enough that the glass reads through it, dark enough to keep body text
  // legible over a busy backdrop. If text ever looks washed out, raise this
  // rather than reaching for a heavier blur.
  sheetScrimGlass: {
    backgroundColor: 'rgba(10,14,30,0.28)',
  },
  // The fallback has no real refraction to show off, so it can afford to be
  // more opaque — but not so opaque that the BlurView beneath is pointless.
  sheetScrimBlur: {
    backgroundColor: 'rgba(10,14,30,0.62)',
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingTop: 16,
  },
});
