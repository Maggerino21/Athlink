import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// S-chain mark: ∩ + ∪ interlocked — two U shapes, one flipped.
// Path verified analytically from design file (viewBox 0 0 104 110).
const MARK_PATH = 'M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38';
const VB_RATIO  = 110 / 104;

interface Props {
  width?: number;
  // Top → bottom gradient stops on the mark stroke
  fromColor?: string;
  toColor?: string;
  // Optional club-color tint overlay (0% opacity top, tintOpacity bottom)
  tintColor?: string;
  tintOpacity?: number;
}

export default function AthlinkMark({
  width = 48,
  fromColor = '#F4F1ED',  // warm near-white
  toColor   = '#ECE9F5',  // barely-cool near-white (ghost of blue)
  tintColor,
  tintOpacity = 0.35,
}: Props) {
  const height  = Math.round(width * VB_RATIO);
  const sw      = Math.round((width / 104) * 16); // scale stroke proportionally

  const tc = tintColor ?? 'transparent';

  return (
    <Svg width={width} height={height} viewBox="0 0 104 110" fill="none">
      <Defs>
        <LinearGradient id="markGrad" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor={fromColor} />
          <Stop offset="100%" stopColor={toColor} />
        </LinearGradient>
        <LinearGradient id="tintGrad" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0%"   stopColor={tc} stopOpacity={0} />
          <Stop offset="100%" stopColor={tc} stopOpacity={tintColor ? tintOpacity : 0} />
        </LinearGradient>
      </Defs>

      <Path
        d={MARK_PATH}
        stroke="url(#markGrad)"
        strokeWidth={sw}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
      <Path
        d={MARK_PATH}
        stroke="url(#tintGrad)"
        strokeWidth={sw}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
