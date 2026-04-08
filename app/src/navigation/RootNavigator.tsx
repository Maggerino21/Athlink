import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LandingScreen from '../screens/auth/LandingScreen';
import HomeScreen from '../screens/athlete/HomeScreen';
import StaffHomeScreen from '../screens/staff/StaffHomeScreen';
import StaffAthleteDetailScreen from '../screens/staff/StaffAthleteDetailScreen';

// ── Stack param lists ──────────────────────────────────────────────────────
export type AuthStackParamList = {
  Landing: undefined;
};

export type AthleteStackParamList = {
  AthleteHome: undefined;
};

export type StaffStackParamList = {
  StaffHome: undefined;
  StaffAthleteDetail: { athleteId: string; athleteName: string };
};

// ── Individual stacks ──────────────────────────────────────────────────────
const AuthStack   = createNativeStackNavigator<AuthStackParamList>();
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
        <Text style={styles.loadingHint}>Kunne ikke laste profil</Text>
        {profileError ? <Text style={styles.errorCode}>{profileError}</Text> : null}
        <TouchableOpacity
          onPress={() => supabase.auth.signOut()}
          style={styles.signOutBtn}
        >
          <Text style={styles.signOutText}>Logg ut</Text>
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
