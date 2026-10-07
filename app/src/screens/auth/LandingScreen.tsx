/**
 * LandingScreen — the first thing anybody sees, and the only screen that has
 * to sell rather than serve.
 *
 * **It is a marketing page, not a form with decoration.** A claim set large,
 * one line saying what the app replaces, and two buttons. Everything else is
 * light and space, because a squad app that looks like admin software has lost
 * the argument before the first tap.
 *
 * **The light is Home's, hung the same way** (2026-10-01) — a wide pool whose
 * centre sits on the ceiling, drawn in a 100×100 viewBox stretched to the
 * frame (`preserveAspectRatio="none"`), so the shape is identical on any
 * screen and nothing waits for a measured size. See `HomeBackdrop`. It reaches
 * further down here: Home has a screenful of content to get out of the way of,
 * this has three paragraphs. The continuity is deliberate — logging in should
 * feel like walking further into the same room, not like arriving somewhere
 * else.
 *
 * **No club colour** — there is no club yet. The blue belongs to the product
 * here rather than to a match.
 *
 * The sheets below (login, signup) are the older hand-built `BottomSheet`.
 * They still work; they have not had the tokens pass this screen just had.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Modal, ScrollView, Image,
  ActivityIndicator,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence,
  runOnJS, interpolate, Extrapolation, Easing, FadeInDown, FadeIn,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import haptics from '../../utils/haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { supabase } from '../../lib/supabase';
import GlassInput from '../../components/ui/GlassInput';
import LanguagePicker from '../../components/ui/LanguagePicker';
import AthlinkMark from '../../components/ui/AthlinkMark';
import PressableScale from '../../components/ui/PressableScale';
import { hsla } from '../../utils/theme';
import { SURFACE, TEXT, LINE, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, DISPLAY_FONT_LARGE, UI_FONT, UI_FONT_REGULAR } from '../../utils/type';

// Pre-login palette — the mark's own gradient, warm white to barely-cool.
const OFF_WHITE  = '#F4F1ED';
const COOL_WHITE = '#ECE9F5';

const { width: W, height: H } = Dimensions.get('window');

/** Home's blue. Same light, same product. */
const HUE = 200;

/**
 * The one red in the app. Nothing else on an athlete screen is allowed to be
 * red, so a failed sign-in reads instantly.
 */
const ERROR = '#E5484D';

/** How long the entrance takes to walk down the page. */
const STEP = 90;

/** The sheet's own close animation, below. One place, so the swap can wait it out. */
const SHEET_CLOSE_MS = 260;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  /**
   * **The page itself is English, whoever is holding the phone.**
   *
   * Before anyone signs in there is no `profiles.language` to go on, only the
   * phone's own setting — and a squad is not all on the same one. English is
   * what every dressing room has in common, and it is the language the product
   * is pitched in. The sheets below do follow the picker, so the moment someone
   * chooses their language the form switches under them.
   *
   * The Norwegian strings are kept in step in `no.json` so the two can never
   * come to mean different things if this is ever localised again.
   */
  const en = (key: string) => t(key, { lng: 'en' });
  const [loginVisible,  setLoginVisible]  = useState(false);
  const [signupVisible, setSignupVisible] = useState(false);

  /**
   * "Har du ikke konto? Bli med" swaps one sheet for the other — and iOS
   * presents one Modal at a time, so opening the second while the first is
   * still dismissing drops it silently and leaves you looking at the landing
   * page. Verified: both links did nothing at all. Let the first close first.
   */
  const swap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(swap.current), []);
  const switchTo = useCallback((open: (v: boolean) => void) => {
    swap.current = setTimeout(() => open(true), SHEET_CLOSE_MS + 60);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Glow />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={styles.wordmarkRow} entering={FadeIn.duration(600)}>
          <AthlinkMark width={22} fromColor={OFF_WHITE} toColor={COOL_WHITE} />
          <Text style={styles.wordmark}>Athlink</Text>
        </Animated.View>

        <View style={styles.spacerTop} />

        <View style={styles.pitch}>
          <Animated.Text style={styles.title} entering={FadeInDown.delay(STEP).duration(620)}>
            {en('landing.heroTitle')}
          </Animated.Text>
          <Animated.Text style={styles.sub} entering={FadeInDown.delay(STEP * 2).duration(620)}>
            {en('landing.heroSub')}
          </Animated.Text>
        </View>

        {/* The dark room between the claim and the buttons. */}
        <View style={styles.spacer} />

        <Animated.View
          style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}
          entering={FadeInDown.delay(STEP * 3).duration(620)}
        >
          <PressableScale style={styles.primaryBtn} scaleTo={0.97} haptic="soft" onPress={() => setSignupVisible(true)}>
            <Text style={styles.primaryBtnText}>{en('landing.joinBtn')}</Text>
          </PressableScale>

          <PressableScale style={styles.secondaryBtn} scaleTo={0.97} haptic="soft" onPress={() => setLoginVisible(true)}>
            <Text style={styles.secondaryBtnText}>{en('landing.loginBtn')}</Text>
          </PressableScale>
        </Animated.View>
      </SafeAreaView>

      <LoginSheet
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
        onSwitchToSignup={() => { setLoginVisible(false); switchTo(setSignupVisible); }}
      />
      <SignupSheet
        visible={signupVisible}
        onClose={() => setSignupVisible(false)}
        onSwitchToLogin={() => { setSignupVisible(false); switchTo(setLoginVisible); }}
      />
    </View>
  );
}

/**
 * The light. Two pools whose centres sit on the ceiling, so they hang rather
 * than rise, over the app's own ground.
 *
 * It breathes — slowly, about eight seconds a cycle. A static poster is the
 * one thing a first screen cannot afford to be, and a breath costs one shared
 * value on the UI thread rather than an animation loop in JS.
 */
function Glow() {
  const breath = useSharedValue(1);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(0.82, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const breathing = useAnimatedStyle(() => ({ opacity: breath.value }));

  const a = hsla(HUE, 95, 58);
  const b = hsla(HUE + 20, 95, 64);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="landA" cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={a} stopOpacity={0.7} />
            <Stop offset={0.5} stopColor={a} stopOpacity={0.26} />
            <Stop offset={1} stopColor={a} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={46} cy={0} rx={104} ry={62} fill="url(#landA)" />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, breathing]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="landB" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={b} stopOpacity={0.45} />
              <Stop offset={0.5} stopColor={b} stopOpacity={0.16} />
              <Stop offset={1} stopColor={b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={86} cy={0} rx={66} ry={48} fill="url(#landB)" />
        </Svg>
      </Animated.View>

      {/* Grain. A pool this wide bands into visible steps on an OLED panel
          without something to break the ramp up. */}
      <Image source={require('../../../assets/noise.png')} style={styles.grain} resizeMode="cover" />
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
          ? <ActivityIndicator color={SURFACE.base} size="small" />
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

  const [step, setStep]         = useState<Step>(1);
  // Whatever the phone's own language resolved to at launch — see i18n/index.
  const [language, setLanguage] = useState<string>(i18n.language);
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

  // Switch the whole screen as they pick, so the choice is self-evidencing:
  // you see the language you chose before you have typed anything.
  const handleLanguageChange = (lang: string) => {
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
          // No `role` here on purpose. The handle_new_user trigger derives it from which
          // invite code matched (athlete code → athlete, staff code → staff). Anything
          // sent from the client is untrusted and ignored.
          full_name:   fullName.trim(),
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
        <View style={{ marginBottom: 24 }}>
          <LanguagePicker
            value={language}
            onChange={handleLanguageChange}
            placeholder={t('language.search')}
          />
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
          ? <ActivityIndicator color={SURFACE.base} size="small" />
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
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);

  const translateY = useSharedValue(H);

  // Keep the latest onClose reachable from a worklet callback without
  // rebuilding the gesture on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const requestClose = useCallback(() => {
    haptics.soft();
    onCloseRef.current();
  }, []);

  const finishClose = useCallback(() => setMounted(false), []);

  // Step 1 — when visible flips, either mount+reset or start the close animation
  useEffect(() => {
    if (visible) {
      translateY.value = H;
      setMounted(true);
    } else if (mounted) {
      translateY.value = withTiming(
        H,
        { duration: SHEET_CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (done) => { if (done) runOnJS(finishClose)(); }
      );
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2 — after mount (Modal is now rendered), spring the sheet up
  useEffect(() => {
    if (mounted && visible) {
      translateY.value = withSpring(0, { duration: 520, dampingRatio: 0.84 });
      haptics.soft();
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag handle — pull down past a quarter of the sheet, or flick, to dismiss.
  // Scoped to the handle rather than the whole sheet because this sheet holds
  // text inputs and a keyboard-adjusting ScrollView.
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((e) => {
      // Downward only; upward pull meets a stiff, capped resistance.
      translateY.value = e.translationY > 0
        ? e.translationY
        : -40 * (1 - Math.exp(e.translationY / 40));
    })
    .onEnd((e) => {
      const projected = translateY.value + e.velocityY * 0.15;
      if (translateY.value > H * 0.12 || e.velocityY > 800 || projected > H * 0.25) {
        translateY.value = withTiming(H, { duration: 240, easing: Easing.in(Easing.cubic) });
        runOnJS(requestClose)();
      } else {
        translateY.value = withSpring(0, { duration: 400, dampingRatio: 0.78 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, H * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop tint — visual only */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, backdropStyle]}
        pointerEvents="none"
      />
      {/* Backdrop tap-to-close — behind the sheet */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

      {/* Sheet — anchored to bottom, no KAV needed; ScrollView handles keyboard natively */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          { position: 'absolute', bottom: 0, left: 0, right: 0 },
          { paddingBottom: Math.max(insets.bottom + 8, 24) },
          sheetStyle,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: SURFACE.base }]} />

        {/* Handle area — larger tap/drag target wrapping the visible pill */}
        <GestureDetector gesture={pan}>
          <View style={sheetStyles.handleArea}>
            <View style={sheetStyles.handle} />
          </View>
        </GestureDetector>

        <ScrollView
          style={{ flex: 1, zIndex: 1 }}
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
  root: { flex: 1, backgroundColor: SURFACE.base },
  safe: { flex: 1 },

  wordmarkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 24, paddingTop: 10,
  },
  /**
   * Home's wordmark, to the letter — same face, size and tracking as the one in
   * `AthleteFrame`'s brand header. The first screen and the screen behind it
   * should not be setting the name two different ways.
   */
  wordmark: {
    fontFamily: 'SpaceGrotesk_400Regular', fontSize: 27,
    color: '#FFFFFF', letterSpacing: -0.3,
  },

  /**
   * Stated in points, not `absoluteFill`: an Image given only insets covered
   * the top 59% of the screen and left a visible edge where the grain
   * stopped — measured off a screenshot, not guessed.
   */
  grain: { position: 'absolute', top: 0, left: 0, width: W, height: H, opacity: 0.035 },

  /**
   * The claim is weighted above centre: more light over it than dark under it,
   * so the page leads with the light rather than floating in the middle.
   */
  spacerTop: { flex: 4 },
  spacer: { flex: 1 },

  pitch: { paddingHorizontal: 24 },
  /**
   * The claim. Archivo Regular rather than Medium: at this size the stroke
   * stops being type and starts being a logo, and the size is the emphasis.
   */
  title: {
    fontFamily: DISPLAY_FONT_LARGE, fontSize: 40, lineHeight: 43,
    color: OFF_WHITE, letterSpacing: -1.3,
  },
  sub: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16, lineHeight: 23,
    color: TEXT.secondary, marginTop: 16, maxWidth: 320,
  },
  ctaWrap: { paddingHorizontal: 24, paddingTop: 30, gap: 10 },
  /** The app's own button: an opaque near-white pill, as on Betal alt. */
  primaryBtn: {
    height: 56, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: OFF_WHITE,
  },
  primaryBtnText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  secondaryBtn: {
    height: 52, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { fontFamily: UI_FONT, fontSize: 16, color: TEXT.secondary },
});

/**
 * The sheets, on the app's own tokens (2026-10-01). They used to sit on a navy
 * panel of their own, which read as a different product the moment the landing
 * page stopped being navy. Same surfaces and the same near-white pill as the
 * rest of the app now; the shell itself is still the hand-built one.
 *
 * Several styles below (`roleCard*`, `roleBtnSpec`) belong to signup steps that
 * no longer exist — left alone rather than swept in a design pass.
 */
const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', height: H * 0.85,
  },
  handleArea: {
    width: '100%', paddingVertical: 12,
    alignItems: 'center', zIndex: 2,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: TEXT.faint,
  },
  sheetContent: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 16, zIndex: 1 },
  sheetTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary,
    marginBottom: 24, letterSpacing: -0.6,
  },

  roleLabel: {
    fontFamily: UI_FONT, fontSize: 11, color: TEXT.tertiary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE.recessed,
    borderRadius: RADIUS.md,
    padding: 4, gap: 4, marginBottom: 20, overflow: 'hidden',
  },
  roleBtn: {
    flex: 1, paddingVertical: 11, borderRadius: RADIUS.sm,
    alignItems: 'center', overflow: 'hidden',
  },
  /** Chosen is brighter, not coloured — as everywhere else in the app. */
  roleBtnActive: { backgroundColor: SURFACE.active },
  roleBtnSpec: {
    position: 'absolute', top: 0, left: 12, right: 12, height: 1,
    backgroundColor: LINE.soft,
  },
  roleBtnText: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.tertiary },
  roleBtnTextActive: { fontFamily: UI_FONT, color: TEXT.primary },

  submitBtn: {
    height: 54, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
    backgroundColor: OFF_WHITE,
  },
  submitText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },

  error: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: ERROR, textAlign: 'center', marginTop: 14 },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.tertiary },
  switchLink: { fontFamily: UI_FONT, color: TEXT.primary },

  doneWrap: { alignItems: 'center', paddingVertical: 16 },
  doneIcon: { fontSize: 52, marginBottom: 16 },
  doneSub: {
    fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.secondary,
    textAlign: 'center', lineHeight: 23,
  },

  roleCards: { gap: 12, marginBottom: 24 },
  roleCard: { padding: 18, borderRadius: RADIUS.md, backgroundColor: SURFACE.raised },
  roleCardActive: { backgroundColor: SURFACE.active },
  roleCardEmoji: { fontSize: 28, marginBottom: 8 },
  roleCardTitle: { fontFamily: UI_FONT, fontSize: 16, color: TEXT.secondary, marginBottom: 4 },
  roleCardTitleActive: { color: TEXT.primary },
  roleCardSub: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, lineHeight: 18 },

  fieldLabel: {
    fontFamily: UI_FONT, fontSize: 11, color: TEXT.tertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  backBtn: { marginBottom: 20 },
  backText: { fontFamily: UI_FONT, fontSize: 14, color: TEXT.secondary },

  clubHint: {
    fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary,
    lineHeight: 21, marginBottom: 16,
  },
});
