import React from 'react';
import { Tabs } from 'expo-router';
import { FrostedNavBar } from '@/components/navigation/FrostedNavBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <FrostedNavBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* The 5 tabs that appear in the FrostedNavBar, in TAB_CONFIG order */}
      <Tabs.Screen name="index" options={{ title: 'OS' }} />
      <Tabs.Screen name="busca/index" options={{ title: 'Busca' }} />
      <Tabs.Screen name="nova-os/index" options={{ title: 'Nova OS' }} />
      <Tabs.Screen name="notificacoes/index" options={{ title: 'Notificacoes' }} />
      <Tabs.Screen name="perfil/index" options={{ title: 'Perfil' }} />
      {/* Detail routes — no tab icon */}
      <Tabs.Screen name="os" options={{ href: null }} />
      <Tabs.Screen name="checklist" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ href: null }} />
    </Tabs>
  );
}
