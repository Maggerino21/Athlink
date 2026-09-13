/**
 * FigmaBlob — the five tiles from the "blobs" sheet (Figma 4055:47), at any
 * card size, in any hue. Built for the Home testing ground; not yet a decision.
 *
 * `Blob.tsx` had to fake every soft shape with radial gradients, because RN's
 * `filter: blur` silently no-ops on iOS (see its docblock). This one draws the
 * soft shapes in `react-native-svg` instead, whose `FeGaussianBlur` is native
 * and bundled in Expo Go — so a blurred rect in Figma is a blurred rect here,
 * not an approximation of one.
 *
 * The lit edges stay RN inset `boxShadow`, which SVG has no equivalent for and
 * which iOS renders unconditionally. Layers are interleaved in Figma's order.
 *
 * ── Scaling ─────────────────────────────────────────────────────────────────
 * Every tile was drawn at 120x120. Positions and shape sizes scale with the
 * card on each axis, so a composition keeps its layout on a wide card. Blur
 * radii, inset shadows and overhangs scale by the SHORT side only: stretching
 * a rim by the long side makes the edges uneven, and stretching a blur makes
 * it mush.
 *
 * ── Recolouring ─────────────────────────────────────────────────────────────
 * Each tile is a hue *relationship* (lime with a violet core, cyan crossed
 * with pink). `hue` rotates every colour by the same amount, keeping each one's
 * own saturation and lightness, so the relationship survives and a navy target
 * still glows instead of disappearing into the ground.
 */
import React, { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs, Filter, FeGaussianBlur, RadialGradient, Stop, Rect, Ellipse, Path, G, ClipPath,
} from 'react-native-svg';

const BASE = 120;

interface Inset { blur: number; spread?: number; color: string }

type Layer =
  /** A rounded rect covering the card, overhanging by [l,t,r,b], with inset light. */
  | { kind: 'frame'; fill?: string; over: [number, number, number, number]; insets: Inset[] }
  /** A blurred rounded rect, centred at (cx, cy) in the 120 box. */
  | { kind: 'blurRect'; cx: number; cy: number; w: number; h: number; r: number; fill: string; blur: number }
  /** A blurred ellipse. */
  | { kind: 'blurEllipse'; cx: number; cy: number; rx: number; ry: number; fill: string; blur: number }
  /** A blurred path from an exported Figma vector, centred and rotated. */
  | { kind: 'blurPath'; cx: number; cy: number; rot: number; vbW: number; vbH: number; d: string; fill: string; blur: number; opacity?: number }
  /** A radial gradient over the whole card. cx/cy/r are fractions of the card. */
  | { kind: 'gradRect'; cx: number; cy: number; r: number; stops: [string, number][] }
  /** A colour→transparent gradient ellipse, rotated, clipped to a circle. */
  | { kind: 'gradEllipse'; clip: { cx: number; cy: number; r: number }; cx: number; cy: number; rx: number; ry: number; rot: number; color: string; blur: number };

export interface FigmaBlobDef {
  label: string;
  /** The hue the Figma tile was designed around; `hue` rotates away from this. */
  baseHue: number | null;
  layers: Layer[];
}

export const FIGMA_BLOBS = {
  /** 4055:72 — pink edge, violet body, dark core sitting low. */
  pink: {
    label: 'Pink',
    baseHue: 315,
    layers: [
      { kind: 'frame', fill: '#ed66cb', over: [5.7, 5.7, 5.7, 13.9], insets: [{ blur: 8, color: '#e25ce2' }, { blur: 20, color: '#ffe9ff' }] },
      { kind: 'blurRect', cx: 60, cy: 79.8, w: 87.4, h: 108.3, r: 30, fill: '#7430a6', blur: 9 },
      { kind: 'blurRect', cx: 60, cy: 76, w: 45.6, h: 60.8, r: 11.4, fill: '#170312', blur: 14.2 },
    ],
  },
  /** 4055:57 — lime ground lit yellow top-left, a violet flame rising from the bottom right. */
  lime: {
    label: 'Lime',
    baseHue: 75,
    layers: [
      { kind: 'gradRect', cx: 0.331, cy: 0.14, r: 0.97, stops: [['#fff824', 0], ['#bce612', 0.5], ['#9ade09', 0.75], ['#79d500', 1]] },
      { kind: 'frame', over: [5.7, 5.7, 5.7, 13.9], insets: [{ blur: 8, color: '#bbf60a' }, { blur: 20, color: '#9dd100' }] },
      {
        kind: 'blurPath', cx: 74.6, cy: 90, rot: -32.9, vbW: 145.8, vbH: 191.6, fill: '#3830A6', blur: 14.2,
        d: 'M72.4002 28.4983C91.8696 29.1943 106.814 72.9312 116.057 110.354C122.848 137.85 101.234 163.079 72.9111 163.079C44.8948 163.079 23.3551 138.369 29.5639 111.049C38.2385 72.8795 52.6791 27.7933 72.4002 28.4983Z',
      },
      {
        // Plus-lighter over the first flame in Figma. Their sum is #9F47FF, so
        // the second is drawn in that colour at normal blend instead.
        kind: 'blurPath', cx: 79.8, cy: 98.6, rot: -33.7, vbW: 72.4, vbH: 121.1, fill: '#9F47FF', blur: 9.5, opacity: 0.75,
        d: 'M35.4932 18.9972C42.2115 19.4506 49.3877 58.2988 53.2016 82.4192C54.7969 92.5085 47.2026 101.602 36.999 102.077C26.3127 102.575 17.7255 93.441 19.148 82.838C22.5027 57.8337 28.8397 18.5482 35.4932 18.9972Z',
      },
    ],
  },
  /** 4055:66 — two cyan discs from opposite corners, pink inside each, a dark band between. */
  cross: {
    label: 'Cross',
    baseHue: 193,
    layers: [
      { kind: 'frame', fill: '#031a05', over: [10.3, 10.3, 10.3, 10.3], insets: [{ blur: 8, color: '#a2eaff' }, { blur: 20, color: '#42d5ff' }] },
      { kind: 'blurEllipse', cx: 121.7, cy: 121.8, rx: 85.3, ry: 85.1, fill: '#5fcdec', blur: 6 },
      { kind: 'blurEllipse', cx: -2, cy: -1.9, rx: 85.3, ry: 85.1, fill: '#5fcdec', blur: 6 },
      { kind: 'gradEllipse', clip: { cx: 118, cy: 118.1, r: 71.2 }, cx: 65.5, cy: 65.6, rx: 83, ry: 46.7, rot: 45, color: '#ff5ad5', blur: 2 },
      { kind: 'gradEllipse', clip: { cx: 1, cy: 1.1, r: 71.5 }, cx: 53.8, cy: 53.9, rx: 83.5, ry: 50.2, rot: 45, color: '#ff5ad5', blur: 2 },
    ],
  },
  /** 4055:62 — dark green with a lit rim and a low glow rising from the bottom edge. */
  rim: {
    label: 'Rim',
    baseHue: 135,
    layers: [
      { kind: 'frame', fill: '#031a05', over: [10.3, 10.3, 10.3, 10.3], insets: [{ blur: 6, color: 'rgba(95,236,131,0.1)' }, { blur: 20, color: 'rgba(95,236,131,0.7)' }] },
      // Both carry Figma's inset light before their blur; a denser fill stands in for it.
      { kind: 'blurRect', cx: 60, cy: 113, w: 102.6, h: 106.4, r: 19, fill: 'rgba(95,236,131,0.12)', blur: 25.6 },
      { kind: 'blurRect', cx: 60, cy: 94, w: 49.4, h: 96.9, r: 9.5, fill: 'rgba(95,236,131,0.08)', blur: 9.5 },
    ],
  },
  /** 4055:77 — "Create your own": a neutral ground with a white ring of light. */
  ring: {
    label: 'Ring',
    baseHue: null,
    layers: [
      { kind: 'frame', fill: '#1b1b1b', over: [0, 0, 0, 0], insets: [{ blur: 4.7, spread: 1.9, color: '#ffffff' }, { blur: 19, color: '#ffffff' }] },
    ],
  },
} satisfies Record<string, FigmaBlobDef>;

export type FigmaBlobName = keyof typeof FIGMA_BLOBS;

export interface FigmaBlobProps {
  width: number;
  height: number;
  radius: number;
  name: FigmaBlobName;
  /** Target hue in degrees. Omit for the Figma original colours. */
  hue?: number | null;
  /** Multiplies every colour's saturation — 1 as designed, near 0 for greyscale. */
  sat?: number;
  /** How lit the card is, 0–1. The effect fades over `ground` rather than dimming to black. */
  glow?: number;
  /** What shows through where the effect has faded. */
  ground: string;
  /**
   * Pushes the colour to the edges: a soft rounded core, `core` points in from
   * every side, is painted over the tile in `coreColor`. 0 is the tile as
   * designed. The inset is in points, not a fraction, so the lit band is the
   * same width along the long and short edges of a wide card.
   */
  core?: number;
  /** Must be opaque — it has to hide the tile, not tint it. */
  coreColor?: string;
  children?: React.ReactNode;
}

export default function FigmaBlob({
  width, height, radius, name, hue = null, sat = 1, glow = 1, ground, core = 0, coreColor = '#000', children,
}: FigmaBlobProps) {
  const def: FigmaBlobDef = FIGMA_BLOBS[name];
  const sx = width / BASE;
  const sy = height / BASE;
  const g = Math.min(sx, sy);
  // `useId` gives ":r1:", and a colon breaks `url(#…)`.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  const paint = (c: string) => recolour(c, def.baseHue, hue, sat, name === 'ring');

  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: ground }}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glow }]}>
        {def.layers.map((layer, i) => {
          const id = `${uid}_${i}`;

          if (layer.kind === 'frame') {
            const [l, t, r, b] = layer.over.map(o => o * g);
            return (
              <View
                key={i}
                style={{
                  position: 'absolute', left: -l, top: -t, right: -r, bottom: -b,
                  borderRadius: radius + Math.max(l, t, r, b),
                  backgroundColor: layer.fill ? paint(layer.fill) : 'transparent',
                  boxShadow: layer.insets.map(s => ({
                    offsetX: 0, offsetY: 0, blurRadius: s.blur * g, spreadDistance: (s.spread ?? 0) * g,
                    color: paint(s.color), inset: true,
                  })),
                }}
              />
            );
          }

          // Every soft shape gets its own canvas over the whole card. The filter
          // region is far larger than the shape so the blur is never cropped
          // square; the card's own clip is what cuts it off.
          const filter = (std: number) => (
            <Filter id={`f${id}`} x={-width} y={-height} width={width * 3} height={height * 3} filterUnits="userSpaceOnUse">
              <FeGaussianBlur stdDeviation={std * g} />
            </Filter>
          );

          if (layer.kind === 'blurRect') {
            const w = layer.w * sx, h = layer.h * sy;
            return (
              <Svg key={i} width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>{filter(layer.blur)}</Defs>
                <Rect
                  x={layer.cx * sx - w / 2} y={layer.cy * sy - h / 2} width={w} height={h}
                  rx={layer.r * g} fill={paint(layer.fill)} filter={`url(#f${id})`}
                />
              </Svg>
            );
          }

          if (layer.kind === 'blurEllipse') {
            return (
              <Svg key={i} width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>{filter(layer.blur)}</Defs>
                <Ellipse
                  cx={layer.cx * sx} cy={layer.cy * sy} rx={layer.rx * sx} ry={layer.ry * sy}
                  fill={paint(layer.fill)} filter={`url(#f${id})`}
                />
              </Svg>
            );
          }

          if (layer.kind === 'blurPath') {
            return (
              <Svg key={i} width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>{filter(layer.blur)}</Defs>
                {/* Filter on an untransformed group, so the blur radius is in
                    card points rather than stretched with the shape. */}
                <G filter={`url(#f${id})`} opacity={layer.opacity ?? 1}>
                  <G transform={`translate(${layer.cx * sx} ${layer.cy * sy}) scale(${sx} ${sy}) rotate(${layer.rot}) translate(${-layer.vbW / 2} ${-layer.vbH / 2})`}>
                    <Path d={layer.d} fill={paint(layer.fill)} />
                  </G>
                </G>
              </Svg>
            );
          }

          if (layer.kind === 'gradRect') {
            return (
              <Svg key={i} width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>
                  {/* objectBoundingBox, so the circle stretches into an ellipse
                      with the card exactly as the tile's composition does. */}
                  <RadialGradient id={`g${id}`} cx={layer.cx} cy={layer.cy} r={layer.r} fx={layer.cx} fy={layer.cy}>
                    {layer.stops.map(([c, o]) => <Stop key={o} offset={o} stopColor={paint(c)} />)}
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} fill={`url(#g${id})`} />
              </Svg>
            );
          }

          // gradEllipse
          const ex = layer.cx * sx, ey = layer.cy * sy;
          return (
            <Svg key={i} width={width} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                {filter(layer.blur)}
                <RadialGradient id={`g${id}`} cx="50%" cy="50%" r="50%">
                  <Stop offset={0} stopColor={paint(layer.color)} stopOpacity={1} />
                  <Stop offset={1} stopColor={paint(layer.color)} stopOpacity={0} />
                </RadialGradient>
                <ClipPath id={`c${id}`}>
                  <Ellipse cx={layer.clip.cx * sx} cy={layer.clip.cy * sy} rx={layer.clip.r * sx} ry={layer.clip.r * sy} />
                </ClipPath>
              </Defs>
              <G filter={`url(#f${id})`}>
                <G clipPath={`url(#c${id})`}>
                  <Ellipse
                    cx={ex} cy={ey} rx={layer.rx * sx} ry={layer.ry * sy}
                    transform={`rotate(${layer.rot} ${ex} ${ey})`}
                    fill={`url(#g${id})`}
                  />
                </G>
              </G>
            </Svg>
          );
        })}
        {core > 0 && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              <Filter id={`core${uid}`} x={-width} y={-height} width={width * 3} height={height * 3} filterUnits="userSpaceOnUse">
                <FeGaussianBlur stdDeviation={core * 0.75} />
              </Filter>
            </Defs>
            <Rect
              x={core} y={core} width={width - core * 2} height={height - core * 2}
              rx={Math.max(0, radius - core * 0.3)} fill={coreColor} filter={`url(#core${uid})`}
            />
          </Svg>
        )}
      </View>
      {children}
    </View>
  );
}

// ── Colour ──────────────────────────────────────────────────────────────────

function recolour(c: string, baseHue: number | null, hue: number | null, sat: number, tintNeutral: boolean): string {
  if (hue === null && sat === 1) return c;
  const rgba = parse(c);
  if (!rgba) return c;
  let [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2]);

  if (hue !== null) {
    if (baseHue === null) {
      // A neutral tile has no hue to rotate. Its white light takes the target
      // hue as a pale tint instead, so the ring still says which competition.
      if (tintNeutral && l > 0.5) { h = hue; s = 0.85; l = 0.72; }
    } else if (s > 0.05) {
      h = (h + (hue - baseHue) + 360) % 360;
    }
  }
  s = Math.max(0, Math.min(1, s * sat));

  const [r, g, b] = hslToRgb(h, s, l);
  return `rgba(${r},${g},${b},${rgba[3]})`;
}

function parse(c: string): [number, number, number, number] | null {
  if (c.startsWith('#')) {
    const x = c.slice(1);
    const full = x.length === 3 ? x.split('').map(ch => ch + ch).join('') : x;
    const n = [0, 2, 4].map(i => parseInt(full.substring(i, i + 2), 16));
    if (n.some(Number.isNaN)) return null;
    return [n[0], n[1], n[2], 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map(v => parseFloat(v));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
