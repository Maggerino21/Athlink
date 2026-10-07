'use client';

import { useState, useEffect } from 'react';
import { matteAccent } from '@/lib/clubTheme';

/**
 * Opponent badge with an initials fallback.
 *
 * Manually entered matches have no crest, and the provider's CDN 404s cleanly for teams
 * that don't have one, so the fallback is a normal state rather than an error path.
 */
export default function OpponentCrest({ url, name, size = 34, color }: {
  url?: string | null;
  name: string;
  size?: number;
  /** The opponent's colour (`matches.opponent_color`). With no crest, the
   *  initials sit on it — clay-mixed, so a raw club hex never lands on screen. */
  color?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);

  if (!url || failed) {
    const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)
      .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
    return (
      <div
        aria-hidden
        style={{
          width: size, height: size, borderRadius: 'var(--radius-full)', flexShrink: 0,
          background: color ? matteAccent(color).fill : 'var(--surface-hover)',
          border: color ? 'none' : '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.32, fontWeight: 700,
          color: color ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
