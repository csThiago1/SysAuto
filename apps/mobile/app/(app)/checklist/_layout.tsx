import React from 'react';
import { Stack } from 'expo-router';

export default function ChecklistLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Checklists' }} />
      <Stack.Screen name="[osId]" options={{ title: 'Checklist da OS' }} />
    </Stack>
  );
}
