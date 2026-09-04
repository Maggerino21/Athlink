import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';

export interface Profile {
  id: string;
  role: 'athlete' | 'staff';
  full_name: string;
  avatar_url: string | null;
  club_id: string | null;
  club_name: string | null;
  club_color: string;
  language: string;
  /**
   * Set when the club removed this member. Removal is soft — `user_club_id()`
   * and `user_role()` both filter on it, so every RLS policy already denies
   * them. Without reading it here the app just renders empty tabs with no
   * explanation, which reads as the app being broken rather than as access
   * having ended.
   */
  removed_at: string | null;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  profileError: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

/**
 * Turn a thrown fetch error into something a person can act on.
 *
 * "TypeError: Network request failed" is what React Native reports for every
 * failed request, including the case that actually matters here: the Supabase
 * project being paused (free tier pauses after about a week idle), which looks
 * identical to being offline.
 */
function friendlyNetworkError(e: unknown): string {
  const msg = String(e);
  if (msg.includes('Network request failed') || msg.includes('Aborted') || msg.includes('abort')) {
    return "Couldn't reach the server. Check your connection — if it persists, the backend may be asleep.";
  }
  return msg;
}

/** How long to wait for auth to settle before showing an escape hatch. */
const AUTH_TIMEOUT_MS = 12_000;
/** How long any single profile fetch may take before we give up on it. */
const PROFILE_TIMEOUT_MS = 8_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]         = useState<Session | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  /** Set once auth has resolved either way, so the watchdog knows to stand down. */
  const settledRef = useRef(false);

  const settle = () => { settledRef.current = true; setLoading(false); };

  const fetchProfile = async (userId: string, attempt = 1): Promise<void> => {
    try {
      // Hand-rolled deadline: React Native polyfills AbortSignal from the
      // `abort-controller` package, which has no static AbortSignal.timeout().
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);

      // PostgrestBuilder is a thenable, not a real Promise, so it has no
      // .finally() — clear the deadline explicitly instead.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, avatar_url, club_id, language, removed_at, clubs(name, primary_color)')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single();
      clearTimeout(deadline);

      if (error) {
        clearTimeout(deadline);
        console.warn(`[AuthContext] Profile fetch error (attempt ${attempt}):`, error.code, error.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 800 * attempt));
          return fetchProfile(userId, attempt + 1);
        }
        setProfileError(`${error.code}: ${error.message}`);
        settle();
      } else if (data) {
        const { clubs, ...rest } = data as any;
        const profile: Profile = {
          ...rest,
          club_name:  clubs?.name          ?? null,
          club_color: clubs?.primary_color ?? '#3B82F6',
        };
        setProfile(profile);
        setProfileError(null);
        settle();
        // Switch app language to match the user's preference
        if (profile.language && profile.language !== i18n.language) {
          i18n.changeLanguage(profile.language);
        }
        // Register push token (fire-and-forget)
        registerPushToken(userId);
      } else {
        console.warn('[AuthContext] Profile fetch returned null data, no error. userId:', userId);
        setProfileError('no_data');
        settle();
      }
    } catch (e) {
      // A thrown error means the request never completed — a dropped
      // connection, a paused Supabase project, or our own abort deadline. These
      // used to give up on the first attempt while Postgrest-level errors got
      // three tries, so one transient blip was a dead end. Retry both alike.
      console.warn(`[AuthContext] Profile fetch exception (attempt ${attempt}):`, e);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt));
        return fetchProfile(userId, attempt + 1);
      }
      setProfileError(friendlyNetworkError(e));
      settle();
    }
  };

  const refreshProfile = async () => {
    if (session?.user.id) await fetchProfile(session.user.id);
  };

  const registerPushToken = async (userId: string) => {
    if (!Device.isDevice) return;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
      if (tokenData) {
        await supabase.from('profiles').update({ push_token: tokenData }).eq('id', userId);
      }
    } catch (e) {
      console.warn('[AuthContext] Push token registration failed:', e);
    }
  };

  useEffect(() => {
    /**
     * The callback below is deliberately SYNCHRONOUS, and the profile fetch is
     * deferred with setTimeout(0).
     *
     * supabase-js holds an internal auth lock while it runs onAuthStateChange
     * listeners. Calling another Supabase method from inside the callback — as
     * this used to, with `await fetchProfile(...)` — can deadlock: the query
     * waits to acquire the lock, the lock waits for the callback to return, and
     * the callback waits for the query. It only triggers when a token refresh
     * happens to be in flight, which is why the app froze on the splash screen
     * intermittently rather than every time.
     *
     * Deferring to a macrotask lets the callback return and release the lock
     * before any query starts. This is the pattern Supabase documents.
     */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        console.log('[AuthContext] onAuthStateChange:', _event, newSession?.user?.id ?? 'no user');
        setSession(newSession);

        if (newSession) {
          setLoading(true);
          setTimeout(() => { void fetchProfile(newSession.user.id); }, 0);
        } else {
          setProfile(null);
          setProfileError(null);
          settle();
        }
      }
    );

    /**
     * Watchdog. Whatever goes wrong — a hung request, a paused Supabase
     * project, an auth event that never arrives — the user must never be left
     * on an unrecoverable splash screen. After this long we stop waiting and
     * show the error state, which carries a sign-out button.
     */
    const watchdog = setTimeout(() => {
      if (!settledRef.current) {
        console.warn('[AuthContext] Auth did not settle in time — releasing the splash screen.');
        setProfileError('timeout');
        settle();
      }
    }, AUTH_TIMEOUT_MS);

    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url.includes('access_token')) return;
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }); });
    const linkingSub = Linking.addEventListener('url', handleDeepLink);

    return () => {
      clearTimeout(watchdog);
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, profileError, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
