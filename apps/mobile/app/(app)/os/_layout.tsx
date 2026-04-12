import React from 'react';
import { Stack } from 'expo-router';

export default function OSLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#e31b1b',
        headerTitleStyle: { fontWeight: '600', color: '#111111' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Detalhes da OS' }} />
    </Stack>
  );
}
