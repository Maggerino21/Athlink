/**
 * EventDetailScreen — an event or fixture, presented as a real iOS sheet.
 *
 * This is a navigation *route*, not an inline component, because that is what
 * it takes to get `UISheetPresentationController`. React Navigation's
 * native-stack presents it with `presentation: 'formSheet'`, and iOS then owns
 * the detents, the grabber, interactive dismissal, scroll-to-expand, the
 * stacked-card recede of the screen behind, and — on iOS 26 — the sheet's own
 * Liquid Glass material.
 *
 * The sheet chrome is Apple's, so this screen draws only its *content*. Do not
 * add a drag handle, a backdrop, or a close button — the presentation supplies
 * all three.
 *
 * **The sheet wears the event's colour.** It is the card you just tapped,
 * opened out: a rust card rising into a rust sheet is one continuous object,
 * where a rust card rising into a grey sheet is two. It also keeps the rule the
 * rest of the app follows — colour means the type of thing, and nothing else.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { eventAccent } from '../../components/athlete/eventTypes';
import { DISPLAY_FONT, DISPLAY_FONT_LARGE, UI_FONT } from '../../utils/type';
import { RADIUS } from '../../utils/tokens';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'EventDetail'>;

/**
 * The coloured canvas, stated rather than inherited.
 *
 * `react-native-screens` gives a formSheet's content wrapper
 * `position: absolute` with top/left/right pinned and **no bottom**
 * (`ScreenStackItem.getPositioningStyle`), so there is no height for a
 * `flex: 1` chain to fill — a ScrollView inside one measures zero and draws
 * nothing at all. Matching the detent explicitly is what gives the content
 * something to live in.
 *
 * A ScrollView does not work in here at all — inside that absolute wrapper it
 * measures zero and draws nothing, which is the same quirk that forced the
 * `fitToContents` version to drop its scroller. The content is laid out to fit
 * two thirds of the screen instead; a very long note will clip rather than
 * scroll, which is worth revisiting if coaches start writing essays.
 *
 * It is the FULL screen height, not the detent's two thirds, because iOS lets
 * you rubber-band a sheet up past its detent. Sized to the detent exactly, the
 * colour ran out mid-drag and you could see the end of the card with black
 * below it. Anything taller than the sheet can ever be is simply clipped by the
 * sheet's own rounded frame, so the ground never runs out.
 */
const SHEET_H = Dimensions.get('window').height;

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/** "Saturday 12 September" from a local YYYY-MM-DD. */
function longDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

export default function EventDetailScreen({ route }: Props) {
  const { event } = route.params;
  const accent = eventAccent(event.type);
  const isMatch = event.source === 'match';
  const [crestFailed, setCrestFailed] = useState(false);

  const category = event.type.charAt(0).toUpperCase() + event.type.slice(1);
  const showCrest = isMatch && !!event.opponent_logo_url && !crestFailed;

  return (
    <View style={[styles.root, { backgroundColor: accent.fill }]}>
      <View style={styles.content}>
        {/* The category leads, set in the display face — the same one the
            Schedule header uses, so a sheet reads as part of that screen
            rather than as a dialog that arrived from somewhere else. */}
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={[styles.category, { color: accent.ink }]}>{category}</Text>
            <Text style={styles.title}>{event.title}</Text>
          </View>

          {/* A crest is identity, not decoration, so it survives where the old
              category icon did not. Hidden outright if the provider's image
              404s rather than leaving an empty frame. */}
          {showCrest && (
            <Image
              source={{ uri: event.opponent_logo_url! }}
              style={styles.crest}
              resizeMode="contain"
              onError={() => setCrestFailed(true)}
            />
          )}
        </View>

        <View style={styles.rule} />

        {/* What an athlete opened this to find.
            For a match that is where and when to BE — the meet, not kick-off.
            CLAUDE.md is explicit about it, and it is why meet leads here. */}
        {isMatch && (event.meet_time || event.meet_location) ? (
          <>
            <Figure
              label="Meet"
              value={event.meet_time ?? '—'}
              caption={event.meet_location ?? undefined}
              emphasis
            />
            {event.start_time ? (
              <Figure label="Kick-off" value={event.start_time} caption={event.location ?? undefined} />
            ) : null}
          </>
        ) : (
          <Figure
            label={isMatch ? 'Kick-off' : 'Starts'}
            value={event.start_time ?? 'All day'}
            caption={event.location ?? undefined}
            emphasis
          />
        )}

        <Text style={styles.date}>{longDate(event.date)}</Text>

        {/* A block spanning days says so, rather than looking like a one-day
            event that mysteriously repeats. */}
        {event.spanTotal && event.spanTotal > 1 ? (
          <Text style={styles.span}>Day {event.spanDay} of {event.spanTotal}</Text>
        ) : null}

        {(isMatch ? event.notes : event.description) ? (
          <>
            <View style={styles.rule} />
            <Text style={styles.body}>
              {isMatch ? event.notes : event.description}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A labelled figure — the unit this sheet is built from.
 *
 * The label is small and the number is large, because the number is the answer
 * and the label only says what question it answers. `emphasis` marks the one
 * figure the event is really about; everything else supports it.
 */
function Figure({
  label, value, caption, emphasis,
}: { label: string; value: string; caption?: string; emphasis?: boolean }) {
  return (
    <View style={[styles.figure, emphasis && styles.figureLead]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text
        allowFontScaling={false}
        style={[styles.value, emphasis && styles.valueLead]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: SHEET_H },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headText: { flex: 1 },

  category: {
    fontFamily: DISPLAY_FONT, fontSize: 22,
    letterSpacing: -0.3, marginBottom: 2,
  },
  title: {
    fontFamily: DISPLAY_FONT, fontSize: 34, lineHeight: 39,
    color: 'rgba(255,255,255,0.97)', letterSpacing: -1,
  },
  crest: {
    width: 54, height: 54, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  rule: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 22, marginBottom: 20,
  },

  figure: { marginBottom: 20 },
  figureLead: { marginBottom: 24 },
  label: {
    fontFamily: UI_FONT, fontSize: 11, letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.5)', marginBottom: 4,
  },
  value: {
    fontFamily: DISPLAY_FONT_LARGE, fontSize: 34, lineHeight: 38,
    color: 'rgba(255,255,255,0.95)', letterSpacing: -1,
  },
  // The one figure the event is about, set large enough to read across a room —
  // an athlete checking when to be somewhere should not have to focus.
  valueLead: { fontSize: 56, lineHeight: 60, letterSpacing: -2.2 },
  caption: {
    fontFamily: UI_FONT, fontSize: 15,
    color: 'rgba(255,255,255,0.72)', marginTop: 4,
  },

  date: {
    fontFamily: UI_FONT, fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  span: {
    fontFamily: UI_FONT, fontSize: 13,
    color: 'rgba(255,255,255,0.5)', marginTop: 6,
  },

  body: {
    fontFamily: UI_FONT, fontSize: 15, lineHeight: 23,
    color: 'rgba(255,255,255,0.82)',
  },
});
