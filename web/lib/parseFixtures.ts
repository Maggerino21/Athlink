/**
 * Turns a pasted fixture list into rows a coach can check and confirm.
 *
 * Coaches already have their season somewhere — fotball.no, a federation PDF, an email.
 * Retyping twenty matches into a form is the kind of friction that makes a product feel
 * like admin software, so this parses whatever they paste and shows it back for approval.
 *
 * Parsing is deliberately forgiving and deliberately NOT trusted: every row is editable
 * and flagged when something looked ambiguous. Nothing is saved without confirmation.
 */

export type ParsedFixture = {
  /** The original line, so a coach can see what a row came from. */
  raw: string;
  /** yyyy-mm-dd, or null when no date could be found. */
  date: string | null;
  /** HH:MM, or null when the line had no time. */
  time: string | null;
  opponent: string | null;
  isHome: boolean;
  location: string | null;
  /** Rows start included unless they're unusable. */
  include: boolean;
  /** Set when the coach should look twice at this row. */
  issue?: string;
};

/* ── Normalisation ──────────────────────────────────────────────────
 * Norwegian letters do not decompose under NFD — "ø" is its own letter, not o + stroke —
 * so they need mapping explicitly or "Bodø/Glimt" never matches "Bodo/Glimt".
 */
const CHAR_MAP: Record<string, string> = {
  'ø': 'o', 'æ': 'ae', 'å': 'a', 'ö': 'o', 'ä': 'a', 'ü': 'u', 'é': 'e', 'è': 'e', 'ß': 'ss',
};

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[øæåöäüéèß]/g, c => CHAR_MAP[c] ?? c)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Does a line's team name refer to this club? Tolerates "Glimt" vs "Bodø/Glimt II". */
function isOurClub(candidate: string, clubName: string): boolean {
  const a = normalise(candidate);
  const b = normalise(clubName);
  if (!a || !b) return false;
  if (a === b) return true;
  // Only allow containment when the shorter side is distinctive enough that "IL" or "FK"
  // doesn't match half the league.
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.includes(shorter);
}

/* ── Date and time ──────────────────────────────────────────────────── */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

/** Picks the year that puts a day/month closest to now, for lists that omit the year. */
function inferYear(day: number, month: number, today: Date): number {
  const candidates = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
  let best = today.getFullYear();
  let bestDist = Infinity;
  for (const y of candidates) {
    const d = new Date(Date.UTC(y, month - 1, day));
    // Bias forward: a fixture list is usually upcoming, so past dates are penalised.
    const diff = d.getTime() - today.getTime();
    const dist = diff >= 0 ? diff : -diff * 3;
    if (dist < bestDist) { bestDist = dist; best = y; }
  }
  return best;
}

const pad = (n: number) => String(n).padStart(2, '0');
const valid = (y: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100;

/** Extracts a date and returns it with the matched text removed from the line. */
function extractDate(line: string, today: Date): { date: string | null; rest: string } {
  // ISO first — unambiguous.
  let m = line.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    if (valid(+y, +mo, +d)) {
      return { date: `${y}-${mo}-${d}`, rest: line.replace(m[0], ' ') };
    }
  }

  // Day-first with separators: 15.08.2026, 15/8/26, 15-08-2026. European ordering —
  // these lists are Norwegian, so day always comes first.
  m = line.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (valid(y, mo, d)) {
      return { date: `${y}-${pad(mo)}-${pad(d)}`, rest: line.replace(m[0], ' ') };
    }
  }

  // Day and month only: 15.08. or 15/8
  m = line.match(/\b(\d{1,2})[./](\d{1,2})\.?(?!\d)/);
  if (m) {
    const d = +m[1], mo = +m[2];
    if (valid(2000, mo, d)) {
      const y = inferYear(d, mo, today);
      return { date: `${y}-${pad(mo)}-${pad(d)}`, rest: line.replace(m[0], ' ') };
    }
  }

  // Named month: "15. aug", "15 august 2026"
  m = line.match(/\b(\d{1,2})\.?\s+([a-zA-Zøæå]{3,9})\.?(?:\s+(\d{4}))?/);
  if (m) {
    const d = +m[1];
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo && valid(2000, mo, d)) {
      const y = m[3] ? +m[3] : inferYear(d, mo, today);
      return { date: `${y}-${pad(mo)}-${pad(d)}`, rest: line.replace(m[0], ' ') };
    }
  }

  return { date: null, rest: line };
}

function extractTime(line: string): { time: string | null; rest: string } {
  // Avoid eating a scoreline like "2-1" or a date fragment; require a colon or dot
  // between two plausible clock components.
  const m = line.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (!m) return { time: null, rest: line };
  return { time: `${pad(+m[1])}:${m[2]}`, rest: line.replace(m[0], ' ') };
}

/* ── Line parsing ───────────────────────────────────────────────────── */
const SEPARATORS = [
  /\s+[–—]\s+/,        // en/em dash, usually unambiguous
  /\s+-\s+/,           // hyphen with spaces
  /\s+vs\.?\s+/i,
  /\s+v\.?\s+/i,
  /\s+mot\s+/i,
];

function splitTeams(s: string): [string, string] | null {
  for (const sep of SEPARATORS) {
    const parts = s.split(sep);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return [parts[0].trim(), parts[1].trim()];
    }
  }
  return null;
}

/** Strips list noise: leading round numbers, bullets, trailing scores. */
function tidy(s: string): string {
  return s
    .replace(/^\s*(?:runde\s*)?\d{1,2}\s*[.):]\s*/i, ' ')  // "12." / "Runde 12:"
    .replace(/^[\s\-•*|]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parses pasted text into fixtures. `clubName` decides which side of each line is the
 * opponent and whether the match is home or away.
 */
export function parseFixtures(input: string, clubName: string, today = new Date()): ParsedFixture[] {
  return input
    .split(/\r?\n/)
    .map(l => l.replace(/\t/g, ' ').trim())
    .filter(l => l.length > 0)
    .map<ParsedFixture>(rawLine => {
      const raw = rawLine;
      const row: ParsedFixture = {
        raw, date: null, time: null, opponent: null,
        isHome: true, location: null, include: true,
      };

      // Date first, before tidy(): a leading "15." in 15.08.2026 is indistinguishable
      // from a round-number prefix like "12." until the date has been claimed.
      const d = extractDate(raw, today);
      row.date = d.date;
      const t = extractTime(d.rest);
      row.time = t.time;

      const rest = tidy(t.rest);
      const teams = splitTeams(rest);

      if (teams) {
        const [left, right] = teams;
        const leftIsUs  = isOurClub(left, clubName);
        const rightIsUs = isOurClub(right, clubName);

        if (leftIsUs && !rightIsUs) {
          row.isHome = true;
          row.opponent = right;
        } else if (rightIsUs && !leftIsUs) {
          row.isHome = false;
          row.opponent = left;
        } else {
          // Neither side matched (or both did) — assume the usual "home - away" ordering
          // and let the coach correct it.
          row.isHome = true;
          row.opponent = right;
          row.issue = 'Check which team is yours';
        }
        // Venue is deliberately not guessed from the line: separators vary too much to
        // tell a ground from part of a club's name, and a wrong venue is worse than none.
      } else {
        // No separator: treat the remainder as the opponent's name.
        row.opponent = rest || null;
        row.issue = row.opponent ? 'Couldn’t tell home from away' : 'Couldn’t read this line';
      }

      if (!row.date) {
        row.issue = row.opponent ? 'No date found' : 'Couldn’t read this line';
      }
      if (!row.date || !row.opponent) row.include = false;

      return row;
    });
}

/** Combines a row's date and time into a timestamp for the matches table. */
export function toTimestamp(row: ParsedFixture): string | null {
  if (!row.date) return null;
  return `${row.date}T${row.time ?? '00:00'}:00`;
}
