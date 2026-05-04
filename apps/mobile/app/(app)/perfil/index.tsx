import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InfoRow } from '@/components/ui/InfoRow';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { useAuth } from '@/hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CONSULTANT: 'Consultor',
  STOREKEEPER: 'Almoxarife',
};

export default function PerfilScreen() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text variant="heading2" style={styles.pageTitle}>
          Perfil
        </Text>

        {/* Avatar placeholder */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text variant="heading2" color={Colors.textPrimary}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </View>
          <Text variant="heading3" style={styles.userName}>
            {user?.name ?? 'Usuário'}
          </Text>
          <Text variant="bodySmall" color={Colors.textTertiary}>
            {user?.email ?? ''}
          </Text>
        </View>

        {/* Informacoes */}
        <SectionDivider label="DADOS PESSOAIS" />
        <Card style={styles.infoCard}>
          <InfoRow
            label="Função"
            value={user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
            icon="person-outline"
          />
          <InfoRow
            label="Empresa"
            value="DS Car"
            icon="business-outline"
          />
          <InfoRow
            label="Ambiente"
            value={__DEV__ ? 'Desenvolvimento' : 'Produção'}
            icon="globe-outline"
            noDivider
          />
        </Card>

        <View style={styles.actions}>
          <Button
            variant="secondary"
            label="Sair da conta"
            onPress={handleLogout}
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    padding: Spacing.lg,
    paddingBottom: 120,
    gap: 20,
  },
  pageTitle: {
    paddingTop: Spacing.sm,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  userName: {
    textAlign: 'center',
  },
  infoCard: {
    gap: 0,
  },
  actions: {
    marginTop: Spacing.sm,
  },
});
