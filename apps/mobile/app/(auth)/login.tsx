import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { loginDev } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const success = await loginDev(email.trim().toLowerCase(), password);
      if (!success) {
        setError('Credenciais invalidas. Tente novamente.');
      }
      // Em caso de sucesso, o AuthGuard redireciona automaticamente
    } catch {
      setError('Erro inesperado. Verifique sua conexao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo placeholder */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Text variant="heading1" color="#ffffff" style={styles.logoText}>
                DS
              </Text>
            </View>
            <Text variant="heading2" style={styles.logoTitle}>
              DS Car
            </Text>
            <Text variant="bodySmall" color="#6b7280" style={styles.logoSubtitle}>
              Gestao de Ordens de Servico
            </Text>
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.fieldLabel}>
                Email
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.fieldLabel}>
                Senha
              </Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
              />
            </View>

            {error !== null && (
              <View style={styles.errorContainer}>
                <Text variant="bodySmall" color="#ef4444">
                  {error}
                </Text>
              </View>
            )}

            <Button
              variant="primary"
              label="Entrar"
              loading={loading}
              fullWidth
              onPress={handleLogin}
              style={styles.loginButton}
            />
          </View>

          {/* Hint dev */}
          {__DEV__ && (
            <View style={styles.devHint}>
              <Text variant="caption" color="#9ca3af" style={styles.devHintText}>
                DEV: qualquer email + paddock123
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#e31b1b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#e31b1b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    color: '#ffffff',
  },
  logoTitle: {
    marginBottom: 4,
    color: '#111111',
  },
  logoSubtitle: {
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    color: '#374151',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    minHeight: 52,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  loginButton: {
    marginTop: 8,
  },
  devHint: {
    marginTop: 32,
    alignItems: 'center',
  },
  devHintText: {
    fontStyle: 'italic',
  },
});
