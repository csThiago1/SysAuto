import React from 'react';
import { Stack } from 'expo-router';

export default function OSLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#e31b1b',
        headerTitleStyle: { fontWeight: '600', color: '#111111' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ordens de Servico' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalhes da OS' }} />
    </Stack>
  );
}
