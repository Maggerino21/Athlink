import React, { createContext, useContext, useEffect, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]         = useState<Session | null>(null);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  const fetchProfile = async (userId: string, attempt = 1): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, avatar_url, club_id, language, clubs(name, primary_color)')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn(`[AuthContext] Profile fetch error (attempt ${attempt}):`, error.code, error.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 800 * attempt));
          return fetchProfile(userId, attempt + 1);
        }
        setProfileError(`${error.code}: ${error.message}`);
        setLoading(false);
      } else if (data) {
        const { clubs, ...rest } = data as any;
        const profile: Profile = {
          ...rest,
          club_name:  clubs?.name          ?? null,
          club_color: clubs?.primary_color ?? '#3B82F6',
        };
        setProfile(profile);
        setProfileError(null);
        setLoading(false);
        // Switch app language to match the user's preference
        if (profile.language && profile.language !== i18n.language) {
          i18n.changeLanguage(profile.language);
        }
        // Register push token (fire-and-forget)
        registerPushToken(userId);
      } else {
        console.warn('[AuthContext] Profile fetch returned null data, no error. userId:', userId);
        setProfileError('no_data');
        setLoading(false);
      }
    } catch (e) {
      console.warn('[AuthContext] Profile fetch exception:', e);
      setProfileError(String(e));
      setLoading(false);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('[AuthContext] onAuthStateChange:', _event, newSession?.user?.id ?? 'no user');
        setSession(newSession);
        if (newSession) {
          setLoading(true);
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setProfileError(null);
          setLoading(false);
        }
      }
    );

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
