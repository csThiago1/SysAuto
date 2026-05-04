import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Configure foreground notification behaviour once at module level.
// Wrapped in try-catch because Expo Go doesn't include the native module.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // ExpoPushTokenManager not available (Expo Go) — push disabled
}

interface PushTokenResponse {
  detail: string;
}

/**
 * Solicita permissão de push notifications, registra o Expo Push Token
 * no backend e configura o listener de foreground.
 *
 * Deve ser chamado uma única vez na raiz do app autenticado.
 */
export function usePushNotifications(): void {
  const { token: authToken } = useAuthStore();
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (authToken == null) return;

    try {
      void registerForPushNotifications();

      // Listener para notificações recebidas em foreground
      listenerRef.current = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
        const { title, body } = notification.request.content;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[PushNotifications] foreground:', { title, body });
        }
      });
    } catch {
      // Native module not available (Expo Go) — skip
    }

    return () => {
      listenerRef.current?.remove();
    };
  }, [authToken]);
}

async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DS Car',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e31b1b',
    });
  }

  // expo-modules-core não resolve via bundler neste tsconfig — cast necessário
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPerms = await Notifications.getPermissionsAsync() as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  let finalGranted = Boolean(existingPerms.granted);

  if (!finalGranted) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqPerms = await Notifications.requestPermissionsAsync() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    finalGranted = Boolean(reqPerms.granted);
  }

  if (!finalGranted) {
    // Usuário negou — não forçar novamente
    return;
  }

  try {
    // projectId é obrigatório no Expo Go — se não estiver no app.json/EAS, pula silenciosamente
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[PushNotifications] projectId não configurado — token ignorado em dev');
      }
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenData.data;

    // Registrar no backend
    await api.patch<PushTokenResponse>('/auth/push-token/', { token: expoPushToken });

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[PushNotifications] token registrado:', expoPushToken);
    }
  } catch (err: unknown) {
    // Falha silenciosa — push é feature opcional
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[PushNotifications] falha ao registrar token:', err);
    }
  }
}
