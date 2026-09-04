import 'react-native-url-polyfill/auto';
import './src/i18n';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
