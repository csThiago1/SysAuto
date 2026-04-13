import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text variant="label" color={Colors.textTertiary}>
              Função
            </Text>
            <Text variant="body">
              {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="label" color={Colors.textTertiary}>
              Empresa
            </Text>
            <Text variant="body">DS Car</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="label" color={Colors.textTertiary}>
              Ambiente
            </Text>
            <Text variant="body" color={__DEV__ ? '#b45309' : '#15803d'}>
              {__DEV__ ? 'Desenvolvimento' : 'Produção'}
            </Text>
          </View>
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
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 120,
    gap: 20,
  },
  pageTitle: {
    paddingTop: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e31b1b',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  actions: {
    marginTop: 8,
  },
});
