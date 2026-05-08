import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function CadastroClienteScreen(): React.JSX.Element {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const canSave = name.trim().length > 0 && phone.trim().length >= 10 && lgpdConsent;

  const handleSave = async (): Promise<void> => {
    try {
      await createCustomer.mutateAsync({
        name: name.trim(),
        cpf: cpf.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        lgpd_consent: lgpdConsent,
      });
      toast.success('Cliente cadastrado com sucesso');
      router.back();
    } catch {
      toast.error('Erro ao cadastrar cliente');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="heading3">Novo Cliente</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionDivider label="DADOS PESSOAIS" />
        <Card>
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>NOME COMPLETO *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>CPF</Text>
              <TextInput style={styles.input} value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" maxLength={14} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>TELEFONE *</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(92) 99999-0000" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" maxLength={15} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>E-MAIL</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@exemplo.com" placeholderTextColor={Colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
        </Card>

        <SectionDivider label="LGPD" />
        <Card>
          <View style={styles.lgpdRow}>
            <Text variant="bodySmall" color={Colors.textSecondary} style={{ flex: 1 }}>
              Autorizo o uso dos meus dados pessoais conforme a Lei Geral de Proteção de Dados.
            </Text>
            <Switch value={lgpdConsent} onValueChange={setLgpdConsent} trackColor={{ true: Colors.brand }} />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Cadastrar Cliente" variant="primary" fullWidth loading={createCustomer.isPending} onPress={() => void handleSave()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  fieldGroup: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: 15 },
  lgpdRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  footer: { padding: Spacing.lg },
});
