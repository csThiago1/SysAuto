import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text variant="heading1" style={styles.code}>
          404
        </Text>
        <Text variant="heading3" style={styles.title}>
          Pagina nao encontrada
        </Text>
        <Text variant="body" color={Colors.textTertiary} style={styles.description}>
          A rota que voce acessou nao existe ou foi removida.
        </Text>

        <Button
          variant="primary"
          label="Voltar ao inicio"
          onPress={() => router.replace('/(app)')}
          style={styles.button}
        />

        <Link href="/(app)" style={styles.link}>
          <Text variant="bodySmall" color={Colors.brand}>
            ou toque aqui
          </Text>
        </Link>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  code: {
    color: Colors.brand,
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    maxWidth: 280,
  },
  link: {
    marginTop: 4,
  },
});
