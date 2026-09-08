/**
 * BlobLab — dev-only. Judges the card treatment on a real screen.
 *
 * Two modes, and the split is the point.
 *
 * TUNE is a swatch page: variants stacked with one variable moving at a time.
 * Good for isolating a cause, bad for judging whether something is right,
 * because a card on a swatch page has nothing to be too loud *for*.
 *
 * HOME is the same cards inside the real AthleteFrame, at real size, under
 * real type, with the controls live at the bottom. This is where the answer
 * actually comes from — "these would not look good on the home screen" is a
 * judgement nobody can make from a gallery, including the person making it.
 *
 * Row 0 of TUNE is a pair of pass/fail controls for the two rendering
 * features the card depends on. They are here because `filter: blur` silently
 * no-ops on iOS (see Blob.tsx), and a silent no-op is indistinguishable from
 * a bad design decision unless something isolates it.
 *
 * Reachable in __DEV__ by long-pressing your avatar, then "Blobs".
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import Blob, { blobPaletteFor } from '../../components/ui/Blob';
import AthleteFrame from '../../components/athlete/AthleteFrame';
import { SURFACE_BASE } from '../../utils/theme';

const { width: W } = Dimensions.get('window');

/** Taken from the Figma mockup: 345 and 163x207 inside a 402pt frame. */
const PAD = 28;
const CARD_W = W - PAD * 2;
const MAIN_H = Math.round((253 / 345) * CARD_W);
const SMALL_W = Math.round((CARD_W - 20) / 2);
const SMALL_H = Math.round((207 / 163) * SMALL_W);
const SWATCH = Math.floor((W - PAD * 2 - 12 * 2) / 3);

/** Mirrors CLUB_COLORS in web/lib/clubTheme.ts — the 18 a club can actually pick. */
const CLUB_COLORS: [string, string][] = [
  ['Scarlet', '#F5424B'], ['Red', '#E01B24'], ['Deep red', '#B01B2E'], ['Claret', '#9E3050'],
  ['Sky blue', '#5FB3E4'], ['Blue', '#3B82F6'], ['Royal blue', '#2563C9'], ['Navy', '#4A6CB3'],
  ['Mint', '#4ADE80'], ['Green', '#22B455'], ['Forest', '#3E8E5A'], ['Yellow', '#FBD024'],
  ['Amber', '#F59E0B'], ['Orange', '#F97316'], ['Purple', '#A855F7'], ['Maroon', '#8E4A6B'],
  ['Silver', '#C6CBD4'], ['Teal', '#14B8A6'],
];

/** reach is a fraction of the card's short side, so one number fits every size. */
const REACHES = [0.18, 0.3, 0.45, 0.6];
const INTENSITIES = [0.35, 0.5, 0.7, 1.0];
const THICKNESSES = [-4, 0, 4];

const BASE_INTENSITY = 0.7;
const BASE_GLOW = 1.4;

export default function BlobLab() {
  const [mode, setMode] = useState<'home' | 'tune'>('home');

  return (
    <View style={styles.root}>
      <View style={styles.modeBar}>
        <Chip label="Home" on={mode === 'home'} onPress={() => setMode('home')} />
        <Chip label="Tune" on={mode === 'tune'} onPress={() => setMode('tune')} />
      </View>
      {mode === 'home' ? <HomeMode /> : <TuneMode />}
    </View>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────
// The cards where they will actually live. Controls at the bottom so a change
// and its consequence are in the same glance.

function HomeMode() {
  const [rim, setRim] = useState(true);
  const [reach, setReach] = useState(0.3);
  const [intensity, setIntensity] = useState(0.5);
  const [thickness, setThickness] = useState(0);
  const [black, setBlack] = useState(SURFACE_BASE);

  const card = {
    variant: (rim ? 'rim' : 'full') as 'rim' | 'full',
    intensity,
    thickness,
    glow: BASE_GLOW,
  };

  return (
    <View style={[styles.fill, { backgroundColor: black }]}>
      <AthleteFrame
        clubColor="#E01B24"
        greeting="God morgen"
        name="Edvin"
        initials="ED"
        clubName="Brann"
        dateLabel="lør 6. sep"
        nextMatchLabel="Kamp om 2 dager"
        onAvatarPress={() => {}}
      >
        <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
          <Blob width={CARD_W} height={MAIN_H} radius={28} reach={MAIN_H * reach} {...card}>
            <View style={styles.cardText}>
              <Text style={styles.eyebrow}>KAMPUKE</Text>
              <Text style={styles.cardTitle}>Brann borte</Text>
              <Text style={styles.cardBody}>Lørdag 15:00 · Åsane Arena</Text>
            </View>
          </Blob>

          <View style={styles.pair}>
            <Blob width={SMALL_W} height={SMALL_H} radius={24} palette="neutral" reach={SMALL_H * reach} {...card}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>2</Text>
                <Text style={styles.cardBody}>oppgaver igjen</Text>
              </View>
            </Blob>
            <Blob width={SMALL_W} height={SMALL_H} radius={24} palette="neutral" reach={SMALL_H * reach} {...card}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>1</Text>
                <Text style={styles.cardBody}>ny tilbakemelding</Text>
              </View>
            </Blob>
          </View>

          <View style={{ height: 260 }} />
        </ScrollView>
      </AthleteFrame>

      <View style={styles.panel}>
        <Row label="card">
          <Chip label="rim" on={rim} onPress={() => setRim(true)} />
          <Chip label="full" on={!rim} onPress={() => setRim(false)} />
        </Row>
        <Row label="reach">
          {REACHES.map(r => <Chip key={r} label={String(r)} on={reach === r} onPress={() => setReach(r)} />)}
        </Row>
        <Row label="bright">
          {INTENSITIES.map(i => <Chip key={i} label={i.toFixed(2)} on={intensity === i} onPress={() => setIntensity(i)} />)}
        </Row>
        <Row label="thick">
          {THICKNESSES.map(t => <Chip key={t} label={String(t)} on={thickness === t} onPress={() => setThickness(t)} />)}
        </Row>
        <Row label="black">
          {[SURFACE_BASE, '#000000', '#0E0E11'].map(b => (
            <Chip key={b} label={b.slice(1, 4)} on={black === b} onPress={() => setBlack(b)} />
          ))}
        </Row>
      </View>
    </View>
  );
}

// ── TUNE ─────────────────────────────────────────────────────────────────────

function TuneMode() {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Label>0 · controls</Label>
      <Note>
        Left: soft pink disc, no visible edge. Right: black square, pink glow
        inside the rim. A flat rectangle on either side means that feature is
        not rendering, and nothing below it is worth judging.
      </Note>
      <View style={styles.row}>
        <View
          style={[styles.control, {
            experimental_backgroundImage: [{
              type: 'radial-gradient',
              shape: 'ellipse',
              size: 'farthest-side',
              position: { top: '50%', left: '50%' },
              colorStops: [
                { color: '#ed66cb', positions: ['0%'] },
                { color: 'transparent', positions: ['100%'] },
              ],
            }],
          }]}
        />
        <View
          style={[styles.control, {
            backgroundColor: '#000',
            boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 22, spreadDistance: 2, color: '#ff9de7', inset: true }],
          }]}
        />
      </View>

      <Label>1 · rim — reach, at 0.50 bright</Label>
      <Note>How far the light travels in. This is the dial that decides whether it reads as an edge or as a whole lit card.</Note>
      {REACHES.map(r => (
        <View key={r} style={styles.stackItem}>
          <Blob width={CARD_W} height={MAIN_H} radius={28} variant="rim" reach={MAIN_H * r} intensity={0.5}>
            <CardText title="Kampuke" body={`reach ${r}`} />
          </Blob>
        </View>
      ))}

      <Label>2 · rim — brightness, at 0.30 reach</Label>
      {INTENSITIES.map(i => (
        <View key={i} style={styles.stackItem}>
          <Blob width={CARD_W} height={MAIN_H} radius={28} variant="rim" reach={MAIN_H * 0.3} intensity={i}>
            <CardText title="Kampuke" body={`bright ${i.toFixed(2)}`} />
          </Blob>
        </View>
      ))}

      <Label>3 · rim — thickness</Label>
      <Note>How solid the band is before it falls off. Negative is thinner than the shape itself.</Note>
      {THICKNESSES.map(t => (
        <View key={t} style={styles.stackItem}>
          <Blob width={CARD_W} height={MAIN_H} radius={28} variant="rim" reach={MAIN_H * 0.3} intensity={0.5} thickness={t}>
            <CardText title="Kampuke" body={`thickness ${t}`} />
          </Blob>
        </View>
      ))}

      <Label>4 · rim vs full, same settings</Label>
      <Note>The one on the bottom has a subject inside it. That is the difference you reacted to.</Note>
      <View style={styles.stackItem}>
        <Blob width={CARD_W} height={MAIN_H} radius={28} variant="rim" reach={MAIN_H * 0.3} intensity={0.5}>
          <CardText title="Kampuke" body="rim" />
        </Blob>
      </View>
      <View style={styles.stackItem}>
        <Blob width={CARD_W} height={MAIN_H} radius={28} glow={BASE_GLOW} intensity={BASE_INTENSITY}>
          <CardText title="Kampuke" body="full" />
        </Blob>
      </View>

      <Label>5 · club colour — all 18, rim</Label>
      <Note>
        Not whether the good ones are good. A club picks and we ship it, so the
        question is whether the WORST one is acceptable. Silver has no hue and
        falls back to neutral on purpose.
      </Note>
      <View style={styles.grid}>
        {CLUB_COLORS.map(([name, hex]) => (
          <View key={hex} style={{ width: SWATCH }}>
            <Blob
              width={SWATCH}
              height={SWATCH}
              radius={SWATCH * 0.27}
              variant="rim"
              reach={SWATCH * 0.3}
              intensity={0.5}
              palette={blobPaletteFor(hex)}
            />
            <Text style={styles.swatchLabel}>{name}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────────

function CardText({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.cardText}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.panelRow}>
      <Text style={styles.panelLabel}>{label}</Text>
      <View style={styles.panelChips}>{children}</View>
    </View>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <Text style={styles.label}>{children}</Text>;
const Note = ({ children }: { children: React.ReactNode }) => <Text style={styles.note}>{children}</Text>;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE_BASE },
  fill: { flex: 1 },
  modeBar: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingBottom: 8 },

  scroll: { paddingHorizontal: PAD, paddingTop: 4 },
  homeScroll: { paddingHorizontal: PAD, paddingTop: 18, gap: 20 },

  note: { fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.4)', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginTop: 30, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 16 },
  pair: { flexDirection: 'row', gap: 20 },
  stackItem: { marginBottom: 14 },
  control: { width: 120, height: 120, borderRadius: 28, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 6, textAlign: 'center' },

  cardText: { position: 'absolute', left: 20, bottom: 18, right: 20 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  cardBody: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 28,
    backgroundColor: 'rgba(18,18,22,0.94)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelLabel: { width: 48, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  panelChips: { flexDirection: 'row', gap: 6, flex: 1 },

  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipOn: { backgroundColor: 'rgba(255,255,255,0.20)' },
  chipTxt: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
});
