import React from 'react';
import { Tabs } from 'expo-router';
import { PillTabBar } from '@/components/navigation/PillTabBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* As 5 tabs que aparecem na PillTabBar, na mesma ordem do TAB_CONFIG */}
      <Tabs.Screen name="index" options={{ title: 'OS' }} />
      <Tabs.Screen name="busca/index" options={{ title: 'Busca' }} />
      <Tabs.Screen name="nova-os/index" options={{ title: 'Nova OS' }} />
      <Tabs.Screen name="notificacoes/index" options={{ title: 'Notificacoes' }} />
      <Tabs.Screen name="perfil/index" options={{ title: 'Perfil' }} />
      {/* Rotas internas — sem tab icon */}
      <Tabs.Screen name="os" options={{ href: null }} />
      <Tabs.Screen name="checklist" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ href: null }} />
    </Tabs>
  );
}
