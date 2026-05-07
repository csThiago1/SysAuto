import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/Text';
import { NeonLines } from '@/components/ui/NeonLines';
import { Colors, SemanticColors, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dscarLogo = require('../../assets/dscar-logo.png') as number;

export default function LoginScreen() {
  const { loginDev } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
        setError('Credenciais inválidas. Tente novamente.');
      }
    } catch {
      setError('Erro inesperado. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      {/* Listras neon animadas */}
      <NeonLines />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Spacer top */}
          <View style={styles.spacer} />

          {/* Logo */}
          <Image
            source={dscarLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <LinearGradient
            colors={['transparent', Colors.brand, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.logoDivider}
          />

          {/* Títulos */}
          <Text style={styles.welcome}>Bem-vindo de volta</Text>
          <Text style={styles.welcomeSub}>ACESSE SUA CONTA PARA CONTINUAR</Text>

          {/* Formulário */}
          <View style={styles.form}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              editable={!loading}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <Text style={styles.label}>SENHA</Text>
            <TextInput
              ref={passwordRef}
              style={[styles.input, passwordFocused && styles.inputFocused]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              returnKeyType="done"
              editable={!loading}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onSubmitEditing={handleLogin}
            />

            {error !== null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.brand, Colors.brandShade]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'ENTRANDO...' : 'ENTRAR'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Spacer bottom */}
          <View style={styles.spacer} />

          {/* Footer */}
          <Text style={styles.powered}>PADDOCK SOLUTIONS</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  spacer: {
    flex: 1,
  },

  // Logo
  logo: {
    width: 240,
    height: 100,
    tintColor: Colors.textPrimary,
    marginBottom: 8,
  },
  logoDivider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginBottom: 20,
  },

  // Títulos
  welcome: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  welcomeSub: {
    ...Typography.labelMono,
    color: 'rgba(255,255,255,0.25)',
    marginBottom: 24,
  },

  // Form
  form: {
    width: '100%',
    gap: 10,
  },
  label: {
    ...Typography.labelMono,
    marginTop: 4,
  },
  input: {
    width: '100%',
    height: 46,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  // Error
  errorBox: {
    backgroundColor: SemanticColors.error.bg,
    borderWidth: 1,
    borderColor: SemanticColors.error.border,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: SemanticColors.error.color,
    fontSize: 13,
  },

  // Button
  button: {
    width: '100%',
    height: 48,
    borderRadius: 9,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Footer
  powered: {
    ...Typography.labelMono,
    color: 'rgba(255,255,255,0.15)',
    marginTop: 16,
  },
});
