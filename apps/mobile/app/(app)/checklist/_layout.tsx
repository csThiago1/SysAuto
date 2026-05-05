import React from 'react';
import { Stack } from 'expo-router';

export default function ChecklistLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[osId]" />
    </Stack>
  );
}
