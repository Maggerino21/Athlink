import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Modal, ScrollView, PanResponder,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { supabase } from '../../lib/supabase';
import GlassInput from '../../components/ui/GlassInput';
import AthlinkMark from '../../components/ui/AthlinkMark';

// Pre-login palette — derived entirely from the mark's own gradient.
// Zero club color here. The atmosphere echoes the mark: warm white top, cool white bottom.
const BASE_BG    = '#080C1E';
const OFF_WHITE  = '#F4F1ED';  // warm near-white  (mark gradient top)
const COOL_WHITE = '#ECE9F5';  // barely-cool near-white (mark gradient bottom)

const { width: W, height: H } = Dimensions.get('window');

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loginVisible,  setLoginVisible]  = useState(false);
  const [signupVisible, setSignupVisible] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Background />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Wordmark */}
        <View style={styles.wordmarkRow}>
          <AthlinkMark width={26} fromColor={OFF_WHITE} toColor={COOL_WHITE} />
          <Text style={styles.wordmark}>ATHLINK</Text>
        </View>

        {/* Hero — large faded mark as visual centrepiece */}
        <View style={styles.heroWrap}>
          <View style={styles.heroMarkWrap}>
            <AthlinkMark width={148} fromColor={OFF_WHITE} toColor={COOL_WHITE} />
          </View>
        </View>

        {/* Hero text — sits directly above buttons */}
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroPre}>{t('landing.heroPre')}</Text>
          <Text style={styles.heroTitle}>
            {t('landing.heroTitle')}
          </Text>
          <Text style={styles.heroSub}>
            {t('landing.heroSub')}
          </Text>
        </View>

        {/* CTA buttons */}
        <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setSignupVisible(true)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>{t('landing.joinBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setLoginVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>{t('landing.loginBtn')}</Text>
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

// ─── Background — toned-down beam system in the mark's warm→cool palette ─────
// Structure mirrors the original three-beam layout; all colour stripped to
// near-white so the atmosphere reads as light, not as a specific hue.
function Background() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* Base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_BG }]} />

      {/* Centre beam — warm white, falls from top centre */}
      <LinearGradient
        colors={[
          'rgba(244,241,237,0.10)',
          'rgba(244,241,237,0.065)',
          'rgba(244,241,237,0.025)',
          'rgba(244,241,237,0.005)',
          'rgba(244,241,237,0)',
        ]}
        locations={[0, 0.14, 0.36, 0.60, 1]}
        style={styles.beamCenter}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Left beam — cool white, slightly offset */}
      <LinearGradient
        colors={[
          'rgba(236,233,245,0.06)',
          'rgba(236,233,245,0.03)',
          'rgba(236,233,245,0.008)',
          'rgba(236,233,245,0)',
        ]}
        locations={[0, 0.20, 0.50, 1]}
        style={styles.beamLeft}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Right beam — warm white, mirror of left */}
      <LinearGradient
        colors={[
          'rgba(244,241,237,0.055)',
          'rgba(244,241,237,0.025)',
          'rgba(244,241,237,0.006)',
          'rgba(244,241,237,0)',
        ]}
        locations={[0, 0.20, 0.48, 1]}
        style={styles.beamRight}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Top edge — brightest strip right at the top */}
      <LinearGradient
        colors={['rgba(244,241,237,0.07)', 'rgba(244,241,237,0)']}
        style={styles.topEdgeGlow}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Bottom vignette — deepens the lower half for readability */}
      <LinearGradient
        colors={['rgba(8,12,30,0)', 'rgba(8,12,30,0.65)', 'rgba(8,12,30,0.95)']}
        locations={[0, 0.42, 1]}
        style={styles.bottomVignette}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Noise grain */}
      <Animated.Image
        source={require('../../../assets/noise.png')}
        style={styles.noiseLayer}
        resizeMode="cover"
        blurRadius={1.5}
      />
    </View>
  );
}

// ─── Login sheet ──────────────────────────────────────────────────────────────
function LoginSheet({
  visible, onClose, onSwitchToSignup,
}: { visible: boolean; onClose: () => void; onSwitchToSignup: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (visible) { setEmail(''); setPassword(''); setError(''); }
  }, [visible]);

  const handleLogin = async () => {
    if (!email || !password) { setError(t('login.error')); return; }
    setError(''); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('login.title')}>
      <GlassInput
        label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('login.emailPlaceholder')}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <View style={{ height: 12 }} />
      <GlassInput
        label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('login.passwordPlaceholder')}
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
          : <Text style={sheetStyles.submitText}>{t('login.submit')}</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onSwitchToSignup} activeOpacity={0.7} style={sheetStyles.switchRow}>
        <Text style={sheetStyles.switchText}>
          {t('login.noAccount')}{'  '}
          <Text style={sheetStyles.switchLink}>{t('login.switchLink')}</Text>
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Signup sheet — athletes only ────────────────────────────────────────────
// Staff create their club at the web portal. Mobile signup = join via invite code.
function SignupSheet({
  visible, onClose, onSwitchToLogin,
}: { visible: boolean; onClose: () => void; onSwitchToLogin: () => void }) {
  const { t } = useTranslation();

  type Step = 1 | 2;
  type Lang = 'en' | 'no';

  const [step, setStep]         = useState<Step>(1);
  const [language, setLanguage] = useState<Lang>(
    (i18n.language === 'no' ? 'no' : 'en') as Lang
  );
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(1); setFullName(''); setEmail('');
      setPassword(''); setInviteCode(''); setError(''); setDone(false);
    }
  }, [visible]);

  const handleLanguageChange = (lang: Lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const goToStep2 = () => {
    if (!fullName.trim())    { setError(t('signup.errors.fullNameRequired')); return; }
    if (!email.trim())       { setError(t('signup.errors.emailRequired')); return; }
    if (password.length < 6) { setError(t('signup.errors.passwordTooShort')); return; }
    setError(''); setStep(2);
  };

  const handleSignup = async () => {
    if (!inviteCode.trim()) { setError(t('signup.errors.inviteRequired')); return; }
    setError(''); setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name:   fullName.trim(),
          role:        'athlete',
          language,
          invite_code: inviteCode.trim().toUpperCase(),
        },
        emailRedirectTo: 'athlink://auth/callback',
      },
    });

    setLoading(false);
    if (err || !data.user) { setError(err?.message ?? t('signup.errors.signupFailed')); return; }
    if (!data.session) setDone(true);
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title={t('signup.confirmTitle')}>
        <View style={sheetStyles.doneWrap}>
          <Text style={sheetStyles.doneIcon}>✉️</Text>
          <Text style={sheetStyles.doneSub}>{t('signup.confirmSub', { email })}</Text>
          <TouchableOpacity style={[sheetStyles.submitBtn, { marginTop: 24 }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={sheetStyles.submitText}>{t('signup.doneBtn')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  }

  // ── Step 1: Language + credentials ───────────────────────────────────────
  if (step === 1) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title={t('signup.step1Title')}>
        <Text style={sheetStyles.fieldLabel}>{t('language.label')}</Text>
        <View style={[sheetStyles.roleRow, { marginBottom: 24 }]}>
          {(['en', 'no'] as Lang[]).map(lang => (
            <TouchableOpacity
              key={lang}
              style={[sheetStyles.roleBtn, language === lang && sheetStyles.roleBtnActive]}
              onPress={() => handleLanguageChange(lang)}
              activeOpacity={0.8}
            >
              <Text style={[sheetStyles.roleBtnText, language === lang && sheetStyles.roleBtnTextActive]}>
                {lang === 'en' ? '🇬🇧  English' : '🇳🇴  Norsk'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <GlassInput label={t('signup.fullName')} value={fullName} onChangeText={setFullName}
          placeholder={t('signup.fullNamePlaceholder')} textContentType="name" autoCapitalize="words" />
        <View style={{ height: 12 }} />
        <GlassInput label={t('signup.email')} value={email} onChangeText={setEmail}
          placeholder={t('signup.emailPlaceholder')} keyboardType="email-address" textContentType="emailAddress" />
        <View style={{ height: 12 }} />
        <GlassInput label={t('signup.password')} value={password} onChangeText={setPassword}
          placeholder={t('signup.passwordPlaceholder')} secure textContentType="none" />

        {error ? <Text style={sheetStyles.error}>{error}</Text> : null}

        <TouchableOpacity style={sheetStyles.submitBtn} onPress={goToStep2} activeOpacity={0.85}>
          <Text style={sheetStyles.submitText}>{t('signup.nextBtn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitchToLogin} activeOpacity={0.7} style={sheetStyles.switchRow}>
          <Text style={sheetStyles.switchText}>
            {t('signup.haveAccount')}{'  '}
            <Text style={sheetStyles.switchLink}>{t('signup.switchLink')}</Text>
          </Text>
        </TouchableOpacity>
      </BottomSheet>
    );
  }

  // ── Step 2: Invite code ───────────────────────────────────────────────────
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('signup.step3AthleteTitle')}>
      <TouchableOpacity onPress={() => setStep(1)} style={sheetStyles.backBtn} activeOpacity={0.7}>
        <Text style={sheetStyles.backText}>{t('signup.back')}</Text>
      </TouchableOpacity>

      <Text style={sheetStyles.clubHint}>{t('signup.inviteHint')}</Text>
      <GlassInput
        label={t('signup.inviteLabel')}
        value={inviteCode}
        onChangeText={v => setInviteCode(v.toUpperCase())}
        placeholder={t('signup.invitePlaceholder')}
        autoCapitalize="characters"
      />

      {error ? <Text style={sheetStyles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[sheetStyles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSignup}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#e3d7d7" size="small" />
          : <Text style={sheetStyles.submitText}>{t('signup.joinBtn')}</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ─── Bottom sheet shell ───────────────────────────────────────────────────────
function BottomSheet({
  visible, onClose, title, children,
}: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets          = useSafeAreaInsets();
  const translateY      = useRef(new Animated.Value(H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Keep latest onClose in a ref so PanResponder (created once) always calls the current one
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Step 1 — when visible flips, either mount+reset or start close animation
  useEffect(() => {
    if (visible) {
      translateY.setValue(H);
      backdropOpacity.setValue(0);
      setMounted(true);
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: H,
          duration: 260,
          easing: Easing.in(Easing.bezier(0.55, 0, 0.55, 0.2)),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Step 2 — after mount (Modal is now rendered), start the open animation
  useEffect(() => {
    if (mounted && visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.bezier(0.25, 0.46, 0.45, 0.94)),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mounted]);

  // Drag handle — swipe down > 80px or fast flick dismisses; otherwise snaps back
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          onCloseRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop tint — visual only */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}
        pointerEvents="none"
      />
      {/* Backdrop tap-to-close — behind the sheet */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

      {/* Sheet — anchored to bottom, no KAV needed; ScrollView handles keyboard natively */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          { position: 'absolute', bottom: 0, left: 0, right: 0 },
          { paddingBottom: Math.max(insets.bottom + 8, 24) },
          { transform: [{ translateY }] },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,13,28,0.97)' }]} />

        {/* Handle area — larger tap/drag target wrapping the visible pill */}
        <View {...panResponder.panHandlers} style={sheetStyles.handleArea}>
          <View style={sheetStyles.handle} />
        </View>

        <ScrollView
          style={{ zIndex: 1 }}
          contentContainerStyle={sheetStyles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <Text style={sheetStyles.sheetTitle}>{title}</Text>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // Background layers — three-beam structure, neutral palette
  beamCenter: {
    position: 'absolute',
    top: 0,
    left: W * 0.14, right: W * 0.14,
    height: H * 0.75,
  },
  beamLeft: {
    position: 'absolute',
    top: 0,
    left: -W * 0.05,
    width: W * 0.48,
    height: H * 0.62,
  },
  beamRight: {
    position: 'absolute',
    top: 0,
    right: -W * 0.05,
    width: W * 0.48,
    height: H * 0.62,
  },
  topEdgeGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 160,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: H * 0.62,
  },
  noiseLayer: {
    position: 'absolute',
    top: 0, left: 0,
    width: W, height: H,
    opacity: 0.032,
  },

  // Wordmark
  wordmarkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, paddingTop: 8,
  },
  wordmark: {
    fontSize: 15, fontWeight: '800',
    color: OFF_WHITE,
    letterSpacing: 3.5,
  },

  // Hero — large faded mark centred in negative space
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMarkWrap: {
    opacity: 0.11,
  },

  heroTextWrap: {
    paddingHorizontal: 26,
    paddingBottom: 20,
  },
  heroPre: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(244,241,237,0.35)',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 44, fontWeight: '800',
    color: OFF_WHITE,
    letterSpacing: -1, lineHeight: 48,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(236,233,245,0.38)',
    lineHeight: 22, letterSpacing: 0.1,
    marginBottom: 24,
  },

  // CTA buttons
  ctaWrap: { paddingHorizontal: 24, gap: 12 },

  // Primary — neutral glass, warm-white border
  primaryBtn: {
    height: 58, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,241,237,0.08)',
    borderWidth: 1, borderColor: 'rgba(244,241,237,0.18)',
  },
  primaryBtnText: {
    fontSize: 16, fontWeight: '700',
    color: OFF_WHITE, letterSpacing: 0.3,
  },

  // Secondary — ghost, minimal border
  secondaryBtn: {
    height: 54, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(244,241,237,0.11)',
  },
  secondaryBtnText: {
    fontSize: 16, fontWeight: '600',
    color: 'rgba(244,241,237,0.45)', letterSpacing: 0.2,
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    overflow: 'hidden', maxHeight: H * 0.92,
  },
  handleArea: {
    width: '100%', paddingVertical: 12,
    alignItems: 'center', zIndex: 2,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(244,241,237,0.18)',
  },
  sheetContent: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 16, zIndex: 1 },
  sheetTitle: {
    fontSize: 22, fontWeight: '700', color: OFF_WHITE,
    marginBottom: 24, letterSpacing: -0.4,
  },

  roleLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(244,241,237,0.4)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(244,241,237,0.09)',
    padding: 4, gap: 4, marginBottom: 20, overflow: 'hidden',
  },
  roleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', overflow: 'hidden',
  },
  roleBtnActive: {
    backgroundColor: 'rgba(244,241,237,0.10)',
    borderWidth: 1, borderColor: 'rgba(244,241,237,0.20)',
  },
  roleBtnSpec: {
    position: 'absolute', top: 0, left: 12, right: 12, height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  roleBtnText: { fontSize: 14, fontWeight: '500', color: 'rgba(244,241,237,0.4)' },
  roleBtnTextActive: { color: OFF_WHITE, fontWeight: '700' },

  submitBtn: {
    height: 56, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(244,241,237,0.08)',
    borderWidth: 1, borderColor: 'rgba(244,241,237,0.18)',
  },
  submitText: { fontSize: 15, fontWeight: '700', color: OFF_WHITE, letterSpacing: 0.3 },

  error: { fontSize: 13, color: '#FCA5A5', textAlign: 'center', marginTop: 12 },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontSize: 14, color: 'rgba(244,241,237,0.35)' },
  switchLink: { color: COOL_WHITE, fontWeight: '600' },

  doneWrap: { alignItems: 'center', paddingVertical: 16 },
  doneIcon: { fontSize: 52, marginBottom: 16 },
  doneSub: { fontSize: 15, color: 'rgba(244,241,237,0.45)', textAlign: 'center', lineHeight: 24 },

  // Step 1 role cards
  roleCards: { gap: 12, marginBottom: 24 },
  roleCard: {
    padding: 18, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(244,241,237,0.09)',
  },
  roleCardActive: {
    backgroundColor: 'rgba(244,241,237,0.09)',
    borderColor: 'rgba(244,241,237,0.22)',
  },
  roleCardEmoji: { fontSize: 28, marginBottom: 8 },
  roleCardTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(244,241,237,0.5)', marginBottom: 4 },
  roleCardTitleActive: { color: OFF_WHITE },
  roleCardSub: { fontSize: 13, color: 'rgba(244,241,237,0.3)', lineHeight: 18 },

  fieldLabel: {
    fontSize: 11, fontWeight: '600',
    color: 'rgba(244,241,237,0.4)',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Back button
  backBtn: { marginBottom: 20 },
  backText: { fontSize: 14, color: 'rgba(236,233,245,0.6)', fontWeight: '500' },

  // Club hint text
  clubHint: {
    fontSize: 13, color: 'rgba(244,241,237,0.35)',
    lineHeight: 20, marginBottom: 16,
  },

});
