import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/theme';

export default function ResolverScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="body" color={Colors.textPrimary}>Resolver: {osId}</Text>
    </View>
  );
}
