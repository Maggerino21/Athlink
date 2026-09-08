/**
 * Blob — the rim-lit squircle from the Figma "blobs" sheet (node 4055:52).
 *
 * Not an image and not a mesh gradient. It is four stacked rounded rects whose
 * glow comes entirely from *inset* box-shadows fired inward from each layer's
 * own edge, with a blurred near-black disc on top to keep the centre dark
 * enough to put text on. That is why it reads as lit from the rim rather than
 * painted.
 *
 * Because it is built from primitives rather than baked into a PNG, recolouring
 * is free — see PALETTES. A neutral variant is the same four layers with the
 * pinks and reds swapped for white alphas.
 *
 * **Do not reach for `filter: [{ blur }]` here.** It is typed in RN 0.86 and it
 * bundles, but on iOS `FilterType::Blur` is applied only when the SwiftUI
 * container exists (`RCTViewComponentView.mm`), and that is gated behind the
 * `enableSwiftUIBasedFilters` feature flag, which defaults to false
 * (`ReactNativeFeatureFlagsDefaults.h`). It is a *native* flag, so Expo Go
 * cannot turn it on. Blur silently no-ops and layers 3 and 4 render as hard
 * rectangles — a flat wash and a black slab, which is what "I can't see the
 * blobs" looks like. Only `brightness` and `opacity` survive that gate.
 *
 * So the two soft layers are `experimental_backgroundImage` radial gradients
 * instead, which iOS renders unconditionally. That is arguably the more honest
 * model anyway: a Gaussian-blurred disc *is* a radial falloff, and layer 3
 * blurred is really an annulus — the Figma layer carries inset rings brighter
 * than its own fill, so the glow peaks off-centre. A gradient says that
 * directly rather than approximating it.
 *
 * `boxShadow` with `inset: true` is NOT gated, and carries layers 1 and 2.
 *
 * Geometry below is the Figma measurement at a 120x120 box, scaled from there.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { hexToHsl, hsla, scaleAlpha } from '../../utils/theme';

/** The box the Figma design was measured in. All geometry is a ratio of this. */
const BASE = 120;

export interface BlobPalette {
  /** Ground of the base layer — the dark the rim light sits on. */
  base: string;
  /** Rim lights, brightest and tightest first. */
  rim: readonly [string, string, string];
  /** The two wide secondary insets every layer shares. */
  wash: readonly [string, string];
  /** Mid layer fill — this layer overflows the clip box on purpose. */
  midFill: string;
  /** The large blurred halo behind everything, pushed above centre. */
  haloFill: string;
  /** The blurred dark core that keeps the middle readable. */
  core: string;
}

export const PALETTES = {
  /** Exactly as designed in Figma. Named "red" there; the rim is actually pink. */
  red: {
    base: '#000000',
    rim: ['#ff9de7', '#ed66cb', 'rgba(237,102,203,0.5)'],
    wash: ['rgba(246,43,10,0.4)', 'rgba(246,43,10,0.4)'],
    midFill: 'rgba(255,154,68,0.15)',
    haloFill: 'rgba(246,43,10,0.15)',
    core: '#170312',
  },
  /** The same blob with the colour taken out — for cards that must recede. */
  neutral: {
    base: '#000000',
    rim: ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.12)'],
    wash: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.07)'],
    midFill: 'rgba(255,255,255,0.045)',
    haloFill: 'rgba(255,255,255,0.045)',
    core: '#0A0A0C',
  },
} as const satisfies Record<string, BlobPalette>;

export type BlobPaletteName = keyof typeof PALETTES;

/**
 * Derives a blob palette from a club colour.
 *
 * The design is not "a red blob" — it is a *hue relationship*: a saturated core
 * hue with the rim light rotated ~55 degrees toward magenta, and a mid fill
 * nudged the other way. That relationship is what makes it look lit rather than
 * tinted, and it is what has to survive being moved to another hue.
 *
 * So this takes the club's HUE ONLY and forces the design's own saturation and
 * lightness. Using the club colour literally would break the effect: a navy
 * club's #4A6CB3 is too dark to glow at all against a near-black ground, and a
 * yellow club's is too light to sit under white text. Normalising means every
 * club gets the same drama at a different hue.
 *
 * Rotating toward magenta rather than by a fixed signed offset is what keeps it
 * reading right in every quadrant — red gets a pink rim, blue gets violet,
 * green gets cyan, yellow gets rose. A fixed offset gives blue a green rim.
 *
 * A club colour with almost no saturation (Silver) has no hue worth honouring,
 * so it falls back to the neutral palette rather than inventing one.
 */
export function blobPaletteFor(clubColor: string): BlobPalette {
  const { h, s } = hexToHsl(clubColor);
  if (s < 25) return PALETTES.neutral;

  const rimH = rotateToward(h, 300, 55);
  const midH = h + 18;

  return {
    base: '#000000',
    rim: [hsla(rimH, 100, 81), hsla(rimH, 78, 66), hsla(rimH, 78, 66, 0.5)],
    wash: [hsla(h, 92, 50, 0.4), hsla(h, 92, 50, 0.4)],
    midFill: hsla(midH, 100, 63, 0.15),
    haloFill: hsla(h, 92, 50, 0.15),
    core: hsla(h, 70, 5.5),
  };
}

/** Rotates `h` toward `target` by `by` degrees, along the shorter arc. */
function rotateToward(h: number, target: number, by: number): number {
  const delta = (((target - h) % 360) + 540) % 360 - 180;
  return h + Math.sign(delta) * Math.min(by, Math.abs(delta));
}

export interface BlobProps {
  width: number;
  height: number;
  /** Corner radius of the clip box and the base layer. Figma uses 32 at 120px. */
  radius?: number;
  palette?: BlobPaletteName | BlobPalette;
  /**
   * How far the rim light reaches inward, as a multiple of the Figma radii.
   *
   * Deliberately NOT tied to the box size. At 120x120 the 47px glow reaching
   * 40% inward is what makes the blob; on a 345x253 card the same proportion
   * would have both edges meet in the middle and wash out the content. Default
   * is the size ratio capped at 1.6 — past that the centre stops being dark
   * enough to hold text.
   */
  glow?: number;
  /**
   * `rim` is layers 1 and 2 stripped back to a single lit edge: no halo, no
   * dark core, nothing inside the card at all.
   *
   * The distinction that matters is whether the card has a *subject*. `full`
   * puts shapes inside it — a halo and a core — which is right for a tile that
   * is itself the content, and wrong for a card whose job is to hold text,
   * because the shapes compete with what sits on top. `rim` has nothing to
   * compete: it is only an edge catching light.
   */
  variant?: 'full' | 'rim';
  /** rim only — radius of the bright ring. Defaults to 17% of the short side. */
  reach?: number;
  /**
   * rim only — how far the lit layer sits OUTSIDE the visible edge.
   *
   * This is the whole trick, and it is why the green tile in Figma reads as a
   * ring set inside the border while a naive inset shadow reads as a stroke.
   * An inset shadow is brightest exactly at its own edge; push that edge out
   * past the clip box and the hot line is cut away, leaving only the soft
   * falloff inside. Zero puts the hot line back on the border.
   */
  overhang?: number;
  /** rim only — grows or shrinks the lit band before it falls off. Negative is thinner. */
  thickness?: number;
  /**
   * Soft-UI relief: 0 off, 1 the tuned amount.
   *
   * Classic neumorphism pairs a white and a dark shadow on a mid-grey ground so
   * a shape looks pressed out of the surface. That recipe does nothing here —
   * on a near-black ground a black drop shadow is invisible, because there is
   * no luminance below the background to fall to.
   *
   * What carries it instead is the pair of hairlines: light along the top edge
   * where a light above the screen would catch, dark along the bottom where the
   * card's own body shades itself. The drop shadow still earns its place, but
   * by darkening the ground immediately around the card rather than by being
   * seen. Kept deliberately quiet — the rim is already lighting these edges,
   * and two lighting models arguing is what makes soft UI look cheap.
   */
  relief?: number;
  /**
   * How bright the light is, independent of how far it reaches.
   *
   * Separate from `glow` on purpose: reach and brightness are the two things
   * "too loud" can mean, and tuning them through one number means every change
   * to one disturbs the other. 1 is the Figma design at full strength; the
   * default is below that because at full strength the rim reads as a sticker
   * edge rather than light. The dark core is deliberately NOT scaled — dimming
   * it would brighten the middle, which is the opposite of subtle and is also
   * where the text goes.
   */
  intensity?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export default function Blob({
  width, height, radius = 32, palette = 'red', variant = 'full',
  reach, overhang, thickness = 0, glow, intensity = 0.7, relief = 1, style, children,
}: BlobProps) {
  const raw: BlobPalette = typeof palette === 'string' ? PALETTES[palette] : palette;
  const dim = (c: string) => scaleAlpha(c, intensity);
  const p: BlobPalette = intensity === 1 ? raw : {
    base: raw.base,
    rim: [dim(raw.rim[0]), dim(raw.rim[1]), dim(raw.rim[2])],
    wash: [dim(raw.wash[0]), dim(raw.wash[1])],
    midFill: dim(raw.midFill),
    haloFill: dim(raw.haloFill),
    core: raw.core,
  };

  // Outer: separates the card from the ground. Inner: the two hairlines that
  // actually do the work. Both are cheap to switch off via `relief`.
  const reliefOuter = relief <= 0 ? [] : [
    { offsetX: 0, offsetY: 12, blurRadius: 28, spreadDistance: -6, color: `rgba(0,0,0,${0.6 * relief})` },
    { offsetX: -1, offsetY: -1, blurRadius: 3, color: `rgba(255,255,255,${0.05 * relief})` },
  ];
  const reliefInner = relief <= 0 ? null : (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          boxShadow: [
            { offsetX: 0, offsetY: 1.5, blurRadius: 2, color: `rgba(255,255,255,${0.1 * relief})`, inset: true },
            { offsetX: 0, offsetY: -2, blurRadius: 4, color: `rgba(0,0,0,${0.45 * relief})`, inset: true },
          ],
        },
      ]}
    />
  );

  if (variant === 'rim') {
    // Modelled on the green tile (Figma 4055:62), not the red one. Two insets,
    // and the counter-intuitive part is that the STRONG one is the wide one:
    // a tight bright inset plus a wide dim one gives a stroked border, which is
    // what this looked like before. Wide-and-strong under faint-and-tight gives
    // a band of light instead.
    const short = Math.min(width, height);
    const r = reach ?? short * 0.17;
    const over = overhang ?? short * 0.086;

    return (
      <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', boxShadow: reliefOuter }, style]}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -over, top: -over,
            width: width + over * 2, height: height + over * 2,
            borderRadius: radius + over,
            // A dark tint of the hue rather than black — the green tile sits on
            // #031a05, and that is a good part of why it looks rich instead of
            // like a glow drawn on nothing.
            backgroundColor: p.core,
            boxShadow: [
              { offsetX: 0, offsetY: 0, blurRadius: r * 0.3, spreadDistance: thickness, color: scaleAlpha(p.rim[1], 0.14), inset: true },
              { offsetX: 0, offsetY: 0, blurRadius: r, spreadDistance: thickness, color: p.rim[1], inset: true },
            ],
          }}
        />
        {reliefInner}
        {children}
      </View>
    );
  }

  const sx = width / BASE;
  const sy = height / BASE;
  const g = glow ?? Math.min(sx, sy, 1.6);

  /** An inset shadow, with its radii scaled by the glow dial rather than the box. */
  const ins = (color: string, blurRadius: number, spreadDistance = 0) =>
    ({ offsetX: 0, offsetY: 0, blurRadius: blurRadius * g, spreadDistance: spreadDistance * g, color, inset: true });

  const wash = [ins(p.wash[0], 8.031), ins(p.wash[1], 20.077)];

  // Layer sizes and centre offsets, measured in Figma at 120x120.
  const midW = 131.055 * sx, midH = 139.602 * sy, midDy = 4.1 * sy;
  const haloW = 195.632 * sx, haloH = 166.192 * sy, haloDy = -50.03 * sy;
  const coreW = 89.269 * sx, coreH = 79.772 * sy, coreDy = -57.15 * sy;

  // A Gaussian blur spreads a shape roughly its own radius beyond the edge, so
  // the gradient box is the Figma layer grown by the blur it used to carry.
  const haloFeather = 18.519 * g;
  const coreFeather = 14.245 * g;
  // Where the core stops being solid — the un-blurred shape as a share of the
  // grown box, which is what the blur's flat centre corresponds to.
  const corePlateau = Math.round((coreW / (coreW + coreFeather * 2)) * 100 * 0.8);

  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', boxShadow: reliefOuter }, style]}>
      {/* 1 — the rim light. Fills the box, so its insets hug the card edge. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: p.base,
            boxShadow: [
              ins(p.rim[0], 4.748, 1.899),
              ins(p.rim[1], 18.993),
              ins(p.rim[2], 47.484, 4.748),
              ...wash,
            ],
          },
        ]}
      />

      {/* 2 — overflows the clip box, so its own rim softens the edge rather than
          drawing a second visible one. */}
      <Centred w={midW} h={midH} dy={midDy} boxW={width} boxH={height}
        style={{ borderRadius: radius, backgroundColor: p.midFill, boxShadow: wash }} />

      {/* 3 — the wide halo, sitting high. Peaks off-centre: in Figma this layer
          carries inset rings brighter than its own fill, so blurring it yields
          an annulus rather than a filled disc. */}
      <Centred w={haloW + haloFeather * 2} h={haloH + haloFeather * 2} dy={haloDy} boxW={width} boxH={height}
        style={{
          experimental_backgroundImage: [{
            type: 'radial-gradient',
            shape: 'ellipse',
            size: 'farthest-side',
            position: { top: '50%', left: '50%' },
            colorStops: [
              { color: p.haloFill, positions: ['0%'] },
              { color: p.wash[0],  positions: ['58%'] },
              { color: 'transparent', positions: ['100%'] },
            ],
          }],
        }} />

      {/* 4 — the dark core, on top. This is what makes the middle usable. */}
      <Centred w={coreW + coreFeather * 2} h={coreH + coreFeather * 2} dy={coreDy} boxW={width} boxH={height}
        style={{
          experimental_backgroundImage: [{
            type: 'radial-gradient',
            shape: 'ellipse',
            size: 'farthest-side',
            position: { top: '50%', left: '50%' },
            colorStops: [
              { color: p.core, positions: ['0%'] },
              { color: p.core, positions: [`${corePlateau}%`] },
              { color: 'transparent', positions: ['100%'] },
            ],
          }],
        }} />

      {reliefInner}
      {children}
    </View>
  );
}

/** Figma positions these from their centre; RN positions from the top-left. */
function Centred({
  w, h, dy, boxW, boxH, style,
}: { w: number; h: number; dy: number; boxW: number; boxH: number; style: ViewStyle }) {
  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: w, height: h, left: (boxW - w) / 2, top: (boxH - h) / 2 + dy },
        style,
      ]}
    />
  );
}
