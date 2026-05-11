import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Radii } from '@/constants/theme';
import { QuickActionsSheet } from '@/components/common/QuickActionsSheet';

import { usePathname } from 'expo-router';

// Rotas que escondem o FAB global (telas full-screen com ações próprias).
const HIDDEN_FAB_ROUTES = ['/os/resolver', '/os/apontamento'];

export function FloatingFAB(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [showActions, setShowActions] = useState(false);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (HIDDEN_FAB_ROUTES.some((r) => pathname.includes(r))) {
    return <></>;
  }

  const handlePress = (): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.9, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    setShowActions(true);
  };

  return (
    <>
      <Animated.View
        style={[
          styles.fabContainer,
          { bottom: Math.max(insets.bottom, 10) + 70 },
          animStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={handlePress}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Ações rápidas"
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </TouchableOpacity>
      </Animated.View>
      <QuickActionsSheet
        visible={showActions}
        onClose={() => setShowActions(false)}
        actions={[
          { icon: 'add-circle-outline', label: 'Nova OS', onPress: () => router.push('/(app)/nova-os') },
          { icon: 'person-add-outline', label: 'Novo Cliente', onPress: () => router.push('/(app)/cadastro/cliente') },
          { icon: 'car-outline', label: 'Novo Veículo', onPress: () => router.push('/(app)/cadastro/veiculo') },
          { icon: 'calendar-outline', label: 'Agendar Entrada', onPress: () => router.push('/(app)/agenda') },
          { icon: 'checkbox-outline', label: 'Checklist', onPress: () => router.push('/(app)/checklist') },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
