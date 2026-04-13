import { Stack } from 'expo-router';

export default function VistoriaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="entrada/[osId]" />
      <Stack.Screen name="saida/[osId]" />
    </Stack>
  );
}
