/**
 * The wheel itself, drawn in SVG. Rotation is applied by the caller (an
 * Animated.View around this), so the drawing never re-renders mid-spin.
 *
 * Segments take their item's colour, so an item's two copies match and a
 * player can see at a glance that everything is on there twice. Colours are
 * the fine box's hues through `matteAccent` — the same clay family as the fine
 * cards, never the raw saturated hex.
 */
import React, { memo } from 'react';
import Svg, { Path, G, Text as SvgText, Circle } from 'react-native-svg';
import { matteAccent } from '../../utils/theme';
import { wheelSegments } from './useWheels';
import { SURFACE, TEXT } from '../../utils/tokens';
import { UI_FONT } from '../../utils/type';

/** Ten hues, one per possible item, spread round the wheel so neighbours differ. */
const HUES = ['#E5484D', '#0090FF', '#FFB224', '#6E56CF', '#46A758', '#F76B15', '#12A594', '#D6409F', '#8D6E63', '#3E63DD'];
export const itemColor = (i: number) => matteAccent(HUES[i % HUES.length]);

function polar(c: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: c + r * Math.sin(rad), y: c - r * Math.cos(rad) };
}

/** `labels={false}` for thumbnails — at 50pt there is no room for words. */
function WheelGraphic({ items, size, labels = true }: { items: string[]; size: number; labels?: boolean }) {
  const segs = wheelSegments(items);
  const n = segs.length;
  const seg = 360 / n;
  const c = size / 2;
  const r = c - 2;
  // Fewer, wider segments get bigger type; a 20-segment wheel has to whisper.
  const fontSize = Math.max(9, Math.min(15, size / (n * 1.9)));
  const maxChars = Math.max(8, Math.round(r / (fontSize * 0.62)) - 3);

  return (
    <Svg width={size} height={size}>
      {segs.map((s, i) => {
        const a0 = i * seg;
        const a1 = a0 + seg;
        const p0 = polar(c, r, a0);
        const p1 = polar(c, r, a1);
        const mid = a0 + seg / 2;
        const label = s.label.length > maxChars ? `${s.label.slice(0, maxChars - 1)}…` : s.label;
        return (
          <G key={i}>
            <Path
              d={`M ${c} ${c} L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`}
              fill={itemColor(s.itemIndex).fill}
              stroke={SURFACE.base}
              strokeWidth={2}
            />
            {/* Read from the hub outwards, like the spokes of a real wheel. */}
            {labels && <G transform={`rotate(${mid - 90} ${c} ${c})`}>
              <SvgText
                x={c + r * 0.2}
                y={c + fontSize * 0.35}
                fontFamily={UI_FONT}
                fontSize={fontSize}
                fill={TEXT.primary}
              >
                {label}
              </SvgText>
            </G>}
          </G>
        );
      })}
      <Circle cx={c} cy={c} r={size * 0.07} fill={SURFACE.base} />
      <Circle cx={c} cy={c} r={size * 0.03} fill={TEXT.primary} />
    </Svg>
  );
}

export default memo(WheelGraphic);
