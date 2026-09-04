/**
 * Liquid Glass capability detection.
 *
 * Single source of truth — `LiquidGlassTabBar` and `SlideUpSheet` both read
 * from here so they can never disagree about whether glass is available.
 *
 * ── Why we do NOT gate on isGlassEffectAPIAvailable() ──
 *
 * That helper exists to guard a crash on some early iOS 26 builds, so ignoring
 * it deserves a reason. Its implementation is:
 *
 *     requireNativeModule('ExpoGlassEffect').isGlassEffectAPIAvailable   // → !!value
 *
 * On a real iOS 26.6 device, with `isLiquidGlassAvailable() === true` and Reduce
 * Transparency off, that call returned FALSE while `GlassView` rendered full
 * refracting Liquid Glass perfectly — verified across fifteen simultaneous
 * instances in GlassLab, no crash. The flag is a false negative on this build,
 * whether because the property is missing from the Expo Go binary or because it
 * is present and wrong.
 *
 * Gating on it silently dropped the entire app to the BlurView fallback, which
 * over a dark background is nearly indistinguishable from real glass — so the
 * failure was invisible and cost several rounds of misdiagnosis.
 *
 * We therefore trust `isLiquidGlassAvailable()` alone. The flag is still read
 * and reported in `glassDiagnostics` so a future crash report can be traced
 * back here, but it no longer vetoes anything.
 */
import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

/** Does the native module actually expose the API-availability flag at all? */
function apiFlagIsPresent(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const mod = requireNativeModule('ExpoGlassEffect') as Record<string, unknown>;
    return mod != null && 'isGlassEffectAPIAvailable' in mod;
  } catch {
    return false;
  }
}

/** The flag's value, only meaningful when `apiFlagIsPresent()` is true. */
function apiFlagValue(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const mod = requireNativeModule('ExpoGlassEffect') as Record<string, unknown>;
    return !!mod?.isGlassEffectAPIAvailable;
  } catch {
    return false;
  }
}

const FLAG_PRESENT = apiFlagIsPresent();
const FLAG_VALUE = apiFlagValue();
const DESIGN_AVAILABLE = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * True when we should render real Liquid Glass.
 *
 * Note this does NOT consider Reduce Transparency. iOS already degrades the
 * effect itself when that setting is on, and it does a better job of it than
 * swapping to our BlurView would.
 */
export const CAN_USE_GLASS = DESIGN_AVAILABLE;

/** Everything the decision was made from — for the Glass Lab readout. */
export const glassDiagnostics = {
  platform: `${Platform.OS} ${String(Platform.Version)}`,
  designAvailable: DESIGN_AVAILABLE,
  apiFlagPresent: FLAG_PRESENT,
  apiFlagValue: FLAG_VALUE,
  result: CAN_USE_GLASS,
  /** Plain-language account of why, so the lab never has to be interpreted. */
  reason: !DESIGN_AVAILABLE
    ? 'Device/OS does not offer the Liquid Glass design'
    : FLAG_PRESENT && !FLAG_VALUE
      ? 'API flag says false — ignoring it, glass verified working (see glass.ts)'
      : !FLAG_PRESENT
        ? 'API flag absent from this build — not required'
        : 'API flag present and true',
};

if (__DEV__) {
  console.log(
    `[glass] ${glassDiagnostics.platform} · design=${DESIGN_AVAILABLE} · ` +
    `flagPresent=${FLAG_PRESENT} flagValue=${FLAG_VALUE} → ` +
    `${CAN_USE_GLASS ? 'NATIVE GLASS' : 'BlurView fallback'} (${glassDiagnostics.reason})`
  );
}
