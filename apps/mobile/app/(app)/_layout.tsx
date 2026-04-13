import React from 'react';
import { Tabs } from 'expo-router';
import { FrostedNavBar } from '@/components/navigation/FrostedNavBar';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function AppLayout() {
  usePushNotifications();

  return (
    <Tabs
      tabBar={(props) => <FrostedNavBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'OS' }} />
      <Tabs.Screen name="busca/index" options={{ title: 'Busca' }} />
      <Tabs.Screen name="nova-os/index" options={{ title: 'Nova OS' }} />
      <Tabs.Screen name="notificacoes/index" options={{ title: 'Notificacoes' }} />
      <Tabs.Screen name="perfil/index" options={{ title: 'Perfil' }} />
      {/* Detail routes — no tab icon */}
      <Tabs.Screen name="os" options={{ href: null }} />
      <Tabs.Screen name="checklist" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ href: null }} />
      <Tabs.Screen name="photo-editor" options={{ href: null }} />
      <Tabs.Screen name="vistoria" options={{ href: null }} />
    </Tabs>
  );
}
