import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { AuthProvider, useAuth } from '@/src/auth';

// Keep splash visible until icon fonts register (preserves Android icon fix).
SplashScreen.preventAutoHideAsync();

function RootGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    if (!user && !inAuth) {
      router.replace('/auth/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)/today');
    } else if (user && segments.length === 0) {
      router.replace('/(tabs)/today');
    }
  }, [user, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF9F6' } }} />
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconErr] = useIconFonts();

  useEffect(() => {
    if (iconsLoaded || iconErr) {
      SplashScreen.hideAsync();
    }
  }, [iconsLoaded, iconErr]);

  if (!(iconsLoaded || iconErr)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
