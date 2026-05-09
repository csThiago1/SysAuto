import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { Colors, Spacing } from '@/constants/theme';

const LOGO: ImageSourcePropType = require('../../../assets/dscar-logo.png');

interface DashboardHeaderProps {
  userName: string;
  subtitle?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia,';
  if (hour < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export function DashboardHeader({ userName, subtitle }: DashboardHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LinearGradient
      colors={[Colors.bgHeader, Colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.topRow}>
        <View style={styles.logoWrapper}>
          <Image source={LOGO} style={styles.logo} resizeMode="cover" />
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push('/(app)/notificacoes')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Notificações"
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>
      <View style={styles.greetingRow}>
        <Text style={styles.greetingLabel}>{getGreeting()}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.greetingName}>{userName}</Text>
          {subtitle ? (
            <Text style={styles.greetingSub}> · {subtitle}</Text>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logoWrapper: {
    height: 32,
    width: 100,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.brand,
    borderWidth: 1.5,
    borderColor: Colors.bgHeader,
  },
  greetingRow: {
    paddingTop: 4,
  },
  greetingLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  greetingSub: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
