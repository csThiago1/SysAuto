import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { FrostedNavBar } from '@/components/navigation/FrostedNavBar';
import { FloatingFAB } from '@/components/navigation/FloatingFAB';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { OfflineBanner } from '@/components/common/OfflineBanner';

export default function AppLayout() {
  usePushNotifications();

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Tabs
        tabBar={(props) => <FrostedNavBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {/* ── Tabs visíveis (4 itens no pill) ──────────────────────────── */}
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="os/index" options={{ title: 'OS' }} />
        <Tabs.Screen name="agenda/index" options={{ title: 'Agenda' }} />
        <Tabs.Screen name="mais/index" options={{ title: 'Mais' }} />

        {/* ── Detail routes (sem tab icon) ─────────────────────────────── */}
        <Tabs.Screen name="os" options={{ href: null }} />
        <Tabs.Screen name="nova-os/index" options={{ href: null }} />
        <Tabs.Screen name="notificacoes/index" options={{ href: null }} />
        <Tabs.Screen name="perfil/index" options={{ href: null }} />
        <Tabs.Screen name="busca/index" options={{ href: null }} />
        <Tabs.Screen name="checklist" options={{ href: null }} />
        <Tabs.Screen name="camera" options={{ href: null }} />
        <Tabs.Screen name="photo-editor" options={{ href: null }} />
        <Tabs.Screen name="vistoria" options={{ href: null }} />
        <Tabs.Screen name="cadastro/cliente" options={{ href: null }} />
        <Tabs.Screen name="cadastro/veiculo" options={{ href: null }} />
        <Tabs.Screen name="kanban" options={{ href: null }} />
      </Tabs>
      <FloatingFAB />
    </View>
  );
}
