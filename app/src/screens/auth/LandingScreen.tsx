import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { supabase } from '../../lib/supabase';
import GlassInput from '../../components/ui/GlassInput';

const { width: W, height: H } = Dimensions.get('window');

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const [loginVisible,  setLoginVisible]  = useState(false);
  const [signupVisible, setSignupVisible] = useState(false);
  const [fontsLoaded] = useFonts({ DMSerifDisplay_400Regular });

  // Use system font until custom font loads — no flash
  const serifFont = fontsLoaded ? 'DMSerifDisplay_400Regular' : undefined;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Background />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Wordmark */}
        <View style={styles.wordmarkRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>A</Text>
          </View>
          <Text style={styles.wordmark}>ATHLINK</Text>
        </View>

        {/* Hero */}
        <View style={styles.heroWrap}>
          <Text style={styles.heroPre}>Din plattform for</Text>
          <Text style={[styles.heroTitle, serifFont ? { fontFamily: serifFont, fontWeight: 'normal' } : null]}>
            utøverens{'\n'}hverdag.
          </Text>
          <Text style={styles.heroSub}>
            Tilbakemeldinger, oppgaver og{'\n'}fremgang – alt på ett sted.
          </Text>
        </View>

        {/* CTA buttons */}
        <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Primary — Bli med */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setSignupVisible(true)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Bli med</Text>
          </TouchableOpacity>

          {/* Secondary — Logg inn */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setLoginVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>Logg inn</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <LoginSheet
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
        onSwitchToSignup={() => { setLoginVisible(false); setSignupVisible(true); }}
      />
      <SignupSheet
        visible={signupVisible}
        onClose={() => setSignupVisible(false)}
        onSwitchToLogin={() => { setSignupVisible(false); setLoginVisible(true); }}
      />
    </View>
  );
}

// ─── Background — vivid purple-to-indigo + real noise grain ─────────────────
function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Full-screen primary gradient */}
      <LinearGradient
        colors={['#5B2FC0', '#3D1F9E', '#1E1060', '#0D0730', '#07041A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.25, 0.5, 0.75, 1]}
      />

      {/* Warm magenta shift top-right */}
      <LinearGradient
        colors={['rgba(160,50,200,0.5)', 'rgba(160,50,200,0)']}
        style={styles.bgMagentaRight}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.6 }}
      />

      {/* Cool blue shift top-left */}
      <LinearGradient
        colors={['rgba(60,80,230,0.4)', 'rgba(60,80,230,0)']}
        style={styles.bgCyanLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.5 }}
      />

      {/* Real noise grain — blurred to film grain, not digital static */}
      <Animated.Image
        source={require('../../../assets/noise.png')}
        style={styles.noiseLayer}
        resizeMode="cover"
        blurRadius={1.5}
      />

      {/* Bottom vignette */}
      <LinearGradient
        colors={['rgba(7,4,26,0)', 'rgba(7,4,26,0.45)', 'rgba(7,4,26,0.85)']}
        style={styles.bgVignette}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
}

// ─── Login sheet ──────────────────────────────────────────────────────────────
function LoginSheet({
  visible, onClose, onSwitchToSignup,
}: { visible: boolean; onClose: () => void; onSwitchToSignup: () => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (visible) { setEmail(''); setPassword(''); setError(''); }
  }, [visible]);

  const handleLogin = async () => {
    if (!email || !password) { setError('Fyll inn e-post og passord.'); return; }
    setError(''); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Logg inn">
      <GlassInput
        label="E-post"
        value={email}
        onChangeText={setEmail}
        placeholder="deg@eksempel.no"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <View style={{ height: 12 }} />
      <GlassInput
        label="Passord"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secure
        textContentType="password"
      />
      {error ? <Text style={sheetStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[sheetStyles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#e3d7d7" size="small" />
          : <Text style={sheetStyles.submitText}>Logg inn</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToSignup} activeOpacity={0.7} style={sheetStyles.switchRow}>
        <Text style={sheetStyles.switchText}>
          Har du ikke konto?{'  '}
          <Text style={sheetStyles.switchLink}>Bli med</Text>
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Signup sheet ─────────────────────────────────────────────────────────────
function SignupSheet({
  visible, onClose, onSwitchToLogin,
}: { visible: boolean; onClose: () => void; onSwitchToLogin: () => void }) {
  type Role = 'athlete' | 'staff';
  const [role, setRole]         = useState<Role>('athlete');
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (visible) {
      setFullName(''); setEmail(''); setPassword('');
      setError(''); setDone(false);
    }
  }, [visible]);

  const handleSignup = async () => {
    if (!fullName.trim() || !email || !password) { setError('Fyll inn alle feltene.'); return; }
    if (password.length < 6) { setError('Passordet må ha minst 6 tegn.'); return; }
    setError(''); setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName.trim(), role },
        emailRedirectTo: 'athlink://auth/callback',
      },
    });
    setLoading(false);
    if (err || !data.user) { setError(err?.message ?? 'Registrering feilet.'); return; }
    if (!data.session) setDone(true);
  };

  if (done) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title="Sjekk e-posten din">
        <View style={sheetStyles.doneWrap}>
          <Text style={sheetStyles.doneIcon}>✉️</Text>
          <Text style={sheetStyles.doneSub}>
            Vi sendte en bekreftelseslenke til{'\n'}{email}
          </Text>
          <TouchableOpacity style={[sheetStyles.submitBtn, { marginTop: 24 }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={sheetStyles.submitText}>Ferdig</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Opprett konto">
      <Text style={sheetStyles.roleLabel}>Jeg er...</Text>
      <View style={sheetStyles.roleRow}>
        {(['athlete', 'staff'] as Role[]).map(r => (
          <TouchableOpacity
            key={r}
            style={[sheetStyles.roleBtn, role === r && sheetStyles.roleBtnActive]}
            onPress={() => setRole(r)}
            activeOpacity={0.8}
          >
            {role === r && <View style={sheetStyles.roleBtnSpec} />}
            <Text style={[sheetStyles.roleBtnText, role === r && sheetStyles.roleBtnTextActive]}>
              {r === 'athlete' ? '🏃 Utøver' : '📋 Stab / Trener'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <GlassInput label="Fullt navn" value={fullName} onChangeText={setFullName}
        placeholder="Alex Johansen" textContentType="name" autoCapitalize="words" />
      <View style={{ height: 12 }} />
      <GlassInput label="E-post" value={email} onChangeText={setEmail}
        placeholder="deg@eksempel.no" keyboardType="email-address" textContentType="emailAddress" />
      <View style={{ height: 12 }} />
      <GlassInput label="Passord" value={password} onChangeText={setPassword}
        placeholder="Min. 6 tegn" secure textContentType="newPassword" />

      {error ? <Text style={sheetStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[sheetStyles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSignup}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#e3d7d7" size="small" />
          : <Text style={sheetStyles.submitText}>Opprett konto</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToLogin} activeOpacity={0.7} style={sheetStyles.switchRow}>
        <Text style={sheetStyles.switchText}>
          Har du allerede konto?{'  '}
          <Text style={sheetStyles.switchLink}>Logg inn</Text>
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Bottom sheet shell ───────────────────────────────────────────────────────
function BottomSheet({
  visible, onClose, title, children,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets        = useSafeAreaInsets();
  const translateY    = useRef(new Animated.Value(H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Keep modal mounted during close animation
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Sheet slides up + backdrop fades in simultaneously
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.bezier(0.25, 0.46, 0.45, 0.94)),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Sheet slides down + backdrop fades out, then unmount
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: H,
          duration: 300,
          easing: Easing.in(Easing.bezier(0.55, 0, 0.55, 0.2)),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop — fades independently, never slides */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity },
          ]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet — slides up independently */}
        <Animated.View
          style={[
            sheetStyles.sheet,
            { paddingBottom: Math.max(insets.bottom + 8, 24) },
            { transform: [{ translateY }] },
          ]}
        >
          <BlurView intensity={80} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,4,26,0.78)' }]} />
          <View style={sheetStyles.sheetTopSpec} />
          <View style={sheetStyles.handle} />
          <ScrollView
            style={{ zIndex: 1 }}
            contentContainerStyle={sheetStyles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={sheetStyles.sheetTitle}>{title}</Text>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // Background layers
  bgCyanLeft: {
    position: 'absolute',
    top: -40, left: -80,
    width: W * 0.7, height: H * 0.55,
    borderRadius: 9999,
  },
  bgMagentaRight: {
    position: 'absolute',
    top: -40, right: -60,
    width: W * 0.6, height: H * 0.45,
    borderRadius: 9999,
  },
  noiseLayer: {
    position: 'absolute',
    top: 0, left: 0,
    width: W, height: H,
    opacity: 0.035,
  },
  bgVignette: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: H * 0.52,
  },

  // Wordmark
  wordmarkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, paddingTop: 8,
  },
  logoMark: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: 'rgba(108,60,220,0.5)',
    borderWidth: 1, borderColor: 'rgba(180,140,255,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoLetter: { fontSize: 17, fontWeight: '800', color: '#e3d7d7' },
  wordmark: {
    fontSize: 17, fontWeight: '800',
    color: 'rgba(227,215,215,0.85)',
    letterSpacing: 4,
  },

  // Hero
  heroWrap: {
    flex: 1, paddingHorizontal: 28,
    justifyContent: 'center',
  },
  heroPre: {
    fontSize: 16, fontWeight: '400',
    color: 'rgba(227,215,215,0.42)',
    letterSpacing: 0.2, marginBottom: 10,
  },
  heroTitle: {
    fontSize: 54, fontWeight: '400',
    color: '#e3d7d7',
    letterSpacing: -2, lineHeight: 56,
    marginBottom: 18,
  },
  heroSub: {
    fontSize: 16,
    color: 'rgba(227,215,215,0.38)',
    lineHeight: 24, letterSpacing: 0.1,
    marginBottom: 28,
  },

  // CTA buttons
  ctaWrap: { paddingHorizontal: 24, gap: 12 },

  // "Bli med" — dark navy fill, matches Figma #150c41
  primaryBtn: {
    height: 58, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#150c41',
    borderWidth: 1, borderColor: 'rgba(180,140,255,0.2)',
    shadowColor: '#6C3CDC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 16, fontWeight: '700',
    color: '#e3d7d7', letterSpacing: 0.3,
  },

  // "Logg inn" — transparent with rose-cream border, matches Figma #dbc5c5
  secondaryBtn: {
    height: 54, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2, borderColor: '#dbc5c5',
  },
  secondaryBtnText: {
    fontSize: 16, fontWeight: '600',
    color: '#dbc5c5', letterSpacing: 0.2,
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    overflow: 'hidden', maxHeight: H * 0.9,
  },
  sheetTopSpec: {
    position: 'absolute', top: 0, left: 40, right: 40, height: 1,
    backgroundColor: 'rgba(180,140,255,0.2)', zIndex: 2,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(227,215,215,0.25)',
    alignSelf: 'center', marginTop: 14, zIndex: 2,
  },
  sheetContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, zIndex: 1 },
  sheetTitle: {
    fontSize: 22, fontWeight: '700', color: '#e3d7d7',
    marginBottom: 24, letterSpacing: -0.4,
  },

  roleLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(227,215,215,0.4)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(180,140,255,0.12)',
    padding: 4, gap: 4, marginBottom: 20, overflow: 'hidden',
  },
  roleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', overflow: 'hidden',
  },
  roleBtnActive: {
    backgroundColor: 'rgba(108,60,220,0.45)',
    borderWidth: 1, borderColor: 'rgba(180,140,255,0.35)',
  },
  roleBtnSpec: {
    position: 'absolute', top: 0, left: 12, right: 12, height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  roleBtnText: { fontSize: 14, fontWeight: '500', color: 'rgba(227,215,215,0.4)' },
  roleBtnTextActive: { color: '#e3d7d7', fontWeight: '700' },

  submitBtn: {
    height: 56, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    backgroundColor: '#150c41',
    borderWidth: 1, borderColor: 'rgba(180,140,255,0.25)',
    shadowColor: '#6C3CDC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  submitText: { fontSize: 15, fontWeight: '700', color: '#e3d7d7', letterSpacing: 0.3 },

  error: { fontSize: 13, color: '#FCA5A5', textAlign: 'center', marginTop: 12 },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 14, color: 'rgba(227,215,215,0.35)' },
  switchLink: { color: '#b89cf7', fontWeight: '600' },

  doneWrap: { alignItems: 'center', paddingVertical: 16 },
  doneIcon: { fontSize: 52, marginBottom: 16 },
  doneSub: { fontSize: 15, color: 'rgba(227,215,215,0.45)', textAlign: 'center', lineHeight: 24 },
});
