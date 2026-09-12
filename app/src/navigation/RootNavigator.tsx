import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LandingScreen from '../screens/auth/LandingScreen';
import HomeScreen from '../screens/athlete/HomeScreen';
import EventDetailScreen from '../screens/athlete/EventDetailScreen';
import BriefingScreen from '../screens/athlete/BriefingScreen';
import type { CalEvent } from '../components/athlete/eventTypes';
import StaffHomeScreen from '../screens/staff/StaffHomeScreen';
import StaffAthleteDetailScreen from '../screens/staff/StaffAthleteDetailScreen';

// ── Stack param lists ──────────────────────────────────────────────────────
export type AuthStackParamList = {
  Landing: undefined;
};

export type AthleteStackParamList = {
  AthleteHome: undefined;
  /**
   * Detail views are routes, not inline components, so iOS can present them
   * with `UISheetPresentationController` — see the note on the navigator below.
   *
   * `CalEvent` is a flat object of primitives, so passing it as a param is
   * serialisable and avoids a refetch just to render what the list already had.
   */
  EventDetail: { event: CalEvent };
  Briefing: {
    headline: string;
    fullSummary: string;
    sections: Array<{ title: string; items: string[] }>;
  };
};

export type StaffStackParamList = {
  StaffHome: undefined;
  StaffAthleteDetail: { athleteId: string; athleteName: string };
};

// ── Individual stacks ──────────────────────────────────────────────────────
const AuthStack   = createNativeStackNavigator<AuthStackParamList>();
/**
 * The sheet's ground colour. Lives here because both the route container and
 * the screens drawn inside it have to agree — a mismatch shows as a seam at
 * whichever edge the content stops short of.
 */
export const SHEET_SURFACE = '#0E1220';

const AthleteStack = createNativeStackNavigator<AthleteStackParamList>();
const StaffStack  = createNativeStackNavigator<StaffStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
    </AuthStack.Navigator>
  );
}

function AthleteNavigator() {
  return (
    <AthleteStack.Navigator screenOptions={{ headerShown: false }}>
      <AthleteStack.Screen name="AthleteHome" component={HomeScreen} />

      {/*
        Detail views are presented as real iOS sheets rather than as a
        hand-built bottom sheet. `presentation: 'formSheet'` hands the whole
        interaction to `UISheetPresentationController`, which brings:

          - Apple's sheet material — Liquid Glass on iOS 26
          - real detents with the system's own spring
          - the grabber, and interactive dismissal with correct physics
          - scroll-to-expand: dragging content at the top grows the sheet to the
            next detent instead of dismissing. This is the behaviour a
            hand-built sheet cannot reproduce, and the one that makes an iOS
            sheet feel alive.
          - the stacked-card recede of the screen behind

        `fitToContents` sizes the sheet to what it holds, so a short event and a
        long match briefing each get an appropriate height instead of a fixed
        62% that is wrong for both.

        Android maps this to a Material bottom sheet, which is the right
        equivalent there — the two platforms diverge on purpose.
      */}
      <AthleteStack.Group
        screenOptions={{
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          // Let the sheet grow when the user scrolls its content to the top.
          sheetExpandsWhenScrolledToEdge: true,
          headerShown: false,
          // Dim starts immediately rather than only at the largest detent.
          sheetLargestUndimmedDetentIndex: -1,
          // The route's own container, which defaults to white. Unset, it shows
          // as a bright band wherever the screen's content does not reach — and
          // on a dark sheet that band is the first thing you see.
          contentStyle: { backgroundColor: SHEET_SURFACE },
        }}
      >
        <AthleteStack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{
            // Two thirds, with drag-to-full. An event is the backbone of this
            // app and a sheet that sizes to its contents made a short one look
            // like a scrap of paper; a fixed detent gives every event the same
            // presence. The second value pairs with `sheetExpandsWhenScrolled-
            // ToEdge` so long notes can take the whole screen.
            // One detent, matching SHEET_H in the screen. A second one would
            // let the sheet grow past content that cannot grow with it.
            sheetAllowedDetents: [0.67],
          }}
        />
        <AthleteStack.Screen name="Briefing" component={BriefingScreen} />
      </AthleteStack.Group>
    </AthleteStack.Navigator>
  );
}

function StaffNavigator() {
  return (
    <StaffStack.Navigator screenOptions={{ headerShown: false }}>
      <StaffStack.Screen name="StaffHome" component={StaffHomeScreen} />
      <StaffStack.Screen
        name="StaffAthleteDetail"
        component={StaffAthleteDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </StaffStack.Navigator>
  );
}

// ── Root: reads auth state and routes accordingly ──────────────────────────
export default function RootNavigator() {
  const { session, profile, profileError, loading } = useAuth();

  // Brief loading state while Supabase checks for a persisted session
  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.loadingWordmark}>ATHLINK</Text>
      </View>
    );
  }

  // No session → auth screens
  if (!session) return <AuthNavigator />;

  // Session exists but profile couldn't be loaded — escape hatch
  if (!profile) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.loadingWordmark}>ATHLINK</Text>
        <Text style={styles.loadingHint}>Couldn't load your profile</Text>
        {profileError ? <Text style={styles.errorCode}>{profileError}</Text> : null}
        <TouchableOpacity
          onPress={() => supabase.auth.signOut()}
          style={styles.signOutBtn}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Removed from the club. Access is already gone at the database level —
  // `user_club_id()` and `user_role()` both filter on `removed_at`, so every
  // policy denies them and every query comes back empty. Without this screen
  // the app just renders blank tabs, which reads as broken software rather
  // than as "your club removed you".
  if (profile.removed_at) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.loadingWordmark}>ATHLINK</Text>
        <Text style={styles.removedTitle}>You're no longer in this club</Text>
        <Text style={styles.removedBody}>
          {profile.club_name
            ? `Your access to ${profile.club_name} has ended. If this looks wrong, speak to your coach — they can add you back.`
            : 'Your club access has ended. If this looks wrong, speak to your coach.'}
        </Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Route by role
  if (profile.role === 'staff') return <StaffNavigator />;
  return <AthleteNavigator />;
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1, backgroundColor: '#080E1A',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingWordmark: {
    fontSize: 32, fontWeight: '800',
    color: 'rgba(255,255,255,0.9)', letterSpacing: 6,
  },
  loadingHint: {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
  },
  removedTitle: {
    fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    marginTop: 4, textAlign: 'center', paddingHorizontal: 32,
  },
  removedBody: {
    fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', paddingHorizontal: 40,
  },
  signOutBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  signOutText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  errorCode: {
    fontSize: 11, color: 'rgba(255,100,100,0.6)',
    marginTop: 4, paddingHorizontal: 16, textAlign: 'center',
  },
});
