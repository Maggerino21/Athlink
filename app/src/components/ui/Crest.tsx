/**
 * Crest — a club badge with an initials fallback. The mobile twin of the web's
 * `OpponentCrest`.
 *
 * A missing crest is a normal state, not an error: manually entered matches
 * have none, clubs not on the provider plan have none, and the provider's CDN
 * 404s cleanly for teams without one. The fallback is a circle — in the club
 * colour when there is one (CLAUDE.md: "missing crest → a circle in the club
 * colour"), otherwise a plain grey disc. Never store the image itself.
 */
import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { UI_FONT } from '../../utils/type';

export default function Crest({ url, name, size = 44, color }: {
  url?: string | null;
  name: string;
  size?: number;
  /** Fill for the fallback disc; grey when absent. */
  color?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);

  if (!url || failed) {
    const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)
      .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    return (
      <View
        style={{
          width: size, height: size, borderRadius: RADIUS.pill,
          backgroundColor: color ?? SURFACE.active,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ fontFamily: UI_FONT, fontSize: size * 0.34, color: color ? labelOn(color) : TEXT.secondary }}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      onError={() => setFailed(true)}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Dark or light initials for a club-colour disc. White on a yellow club reads
 * at under 2:1 — the web hit exactly that (see accentTokens in web/lib/clubTheme).
 */
function labelOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return TEXT.primary;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? SURFACE.base : TEXT.primary;
}
