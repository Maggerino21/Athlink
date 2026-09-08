import 'react-native-url-polyfill/auto';
import './src/i18n';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ChakraPetch_300Light, ChakraPetch_400Regular, ChakraPetch_500Medium } from '@expo-google-fonts/chakra-petch';
import { Archivo_300Light, Archivo_400Regular, Archivo_500Medium } from '@expo-google-fonts/archivo';
import { Rajdhani_300Light, Rajdhani_400Regular, Rajdhani_500Medium } from '@expo-google-fonts/rajdhani';

/**
 * Candidates for the card numerals, loaded in development only so the live
 * switcher on Home can compare them on a real screen. Once one is chosen the
 * others come out of package.json — a font is ~40KB of bundle each.
 */
const DISPLAY_CANDIDATES = {
  ChakraPetch_300Light, ChakraPetch_400Regular, ChakraPetch_500Medium,
  Archivo_300Light, Archivo_400Regular, Archivo_500Medium,
  Rajdhani_300Light, Rajdhani_400Regular, Rajdhani_500Medium,
};
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * Stop rendering screens that are off-screen.
 *
 * `UITabBarController` keeps every tab's view alive, so without this all five
 * athlete tabs keep re-rendering forever — each with its own full-screen
 * gradient background, all of which Liquid Glass then has to sample and blur
 * through on every frame. Freezing makes the four hidden tabs cost nothing
 * until they are shown again.
 */
enableFreeze(true);

export default function App() {
  // Two families on purpose: Space Grotesk carries the wordmark, Inter carries
  // everything the user actually reads. Space Grotesk's numerals are
  // characterful, which is right for a logo and wrong at 90pt on a card.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular, SpaceGrotesk_500Medium,
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    ...(__DEV__ ? DISPLAY_CANDIDATES : {}),
  });
  if (!fontsLoaded) return null;

  return (
    // GestureHandlerRootView must be the outermost view — gestures below it are
    // inert without it, and it has to carry flex:1 or the tree collapses.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
