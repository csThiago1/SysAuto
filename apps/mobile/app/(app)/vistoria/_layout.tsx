import { Stack } from 'expo-router';

export default function VistoriaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="entrada/[osId]" />
      <Stack.Screen name="saida/[osId]" />
    </Stack>
  );
}
