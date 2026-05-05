import React, { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { useAuthStore } from '@/stores/auth.store';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { database } from '@/db';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 2,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Aguarda o Zustand rehidratar o auth store do SecureStore antes de renderizar
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // Se já está hidratado (ex: segunda montagem), resolvemos imediatamente
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return unsub;
  }, []);

  if (!hydrated) {
    return <SplashScreen />;
  }

  return (
    <DatabaseProvider database={database}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <OfflineBanner />
            <Slot />
          </AuthGuard>
        </QueryClientProvider>
      </SafeAreaProvider>
    </DatabaseProvider>
  );
}
