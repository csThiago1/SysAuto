import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useCustomerSearch, type CustomerSearchResult } from '@/hooks/useCustomerSearch';
import { useCustomerCreate } from '@/hooks/useCustomerCreate';
import { useNewOSStore } from '@/stores/new-os.store';
import { Colors, Radii } from '@/constants/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step2CustomerProps {
  onNext: () => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step2Customer({ onNext, onBack }: Step2CustomerProps): React.JSX.Element {
  const { results, isLoading: isSearching, search, clear } = useCustomerSearch();
  const { create: createCustomer, isLoading: isCreating, error: createError, clearError } =
    useCustomerCreate();

  const customer = useNewOSStore((s) => s.customer);
  const customerSource = useNewOSStore((s) => s.customerSource);
  const setCustomer = useNewOSStore((s) => s.setCustomer);

  const [queryText, setQueryText] = useState<string>('');
  const [showCreate, setShowCreate] = useState<boolean>(false);

  // Create form
  const [createName, setCreateName] = useState<string>('');
  const [createCpf, setCreateCpf] = useState<string>('');
  const [createPhone, setCreatePhone] = useState<string>('');
  const [createEmail, setCreateEmail] = useState<string>('');
  const [createBirthDate, setCreateBirthDate] = useState<string>('');

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  const handleQueryChange = (text: string): void => {
    setQueryText(text);
    search(text);
  };

  const handleSelectCustomer = (result: CustomerSearchResult): void => {
    setCustomer(result, 'search');
    setQueryText('');
    clear();
  };

  const handleSwapCustomer = (): void => {
    setCustomer(null, 'search');
    setQueryText('');
    clear();
    setShowCreate(false);
  };

  const handleOpenCreate = (): void => {
    clearError();
    setCreateName(queryText.trim());
    setCreateCpf('');
    setCreatePhone('');
    setCreateEmail('');
    setCreateBirthDate('');
    setShowCreate(true);
  };

  const handleCancelCreate = (): void => {
    clearError();
    setShowCreate(false);
  };

  const cpfDigits = createCpf.replace(/\D/g, '');
  const phoneDigits = createPhone.replace(/\D/g, '');
  const canCreate =
    createName.trim().length > 0 &&
    cpfDigits.length === 11 &&
    phoneDigits.length >= 10 &&
    createEmail.trim().includes('@');

  const handleCreate = async (): Promise<void> => {
    try {
      const result = await createCustomer({
        name: createName.trim(),
        cpf: cpfDigits,
        phone: phoneDigits,
        email: createEmail.trim(),
        birth_date: createBirthDate.trim() || undefined,
      });
      setCustomer(result, 'search');
      setShowCreate(false);
    } catch {
      // erro exibido via createError
    }
  };

  const isSelected = customerSource === 'search' && customer !== null;

  // ─── Selected mode ──────────────────────────────────────────────────────────
  if (isSelected && customer !== null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text variant="bodySmall" color={Colors.textTertiary}>
          Passo 2 de 4
        </Text>
        <Text variant="heading3" style={styles.title}>
          Cliente
        </Text>

        <View style={styles.customerCard}>
          <Text variant="label" color="#15803d">
            Cliente selecionado
          </Text>
          <Text variant="body" style={styles.customerName}>
            {customer.name}
          </Text>
          {customer.cpf_masked ? (
            <Text variant="bodySmall" color={Colors.textTertiary}>
              {[customer.cpf_masked, customer.phone_masked].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <TouchableOpacity onPress={handleSwapCustomer} style={styles.swapLink}>
            <Text variant="bodySmall" color={Colors.brand}>
              Trocar cliente
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text variant="label" color={Colors.textPrimary}>
            Continuar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
          <Text variant="bodySmall" color={Colors.textTertiary} style={styles.backText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Create mode ────────────────────────────────────────────────────────────
  if (showCreate) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="bodySmall" color={Colors.textTertiary}>
          Passo 2 de 4
        </Text>
        <Text variant="heading3" style={styles.title}>
          Novo Cliente
        </Text>

        <Text variant="bodySmall" color={Colors.textTertiary}>
          Campos obrigatórios: nome, CPF, telefone e e-mail
        </Text>

        <View style={styles.formSection}>
          <TextInput
            style={styles.input}
            placeholder="Nome completo *"
            placeholderTextColor={Colors.textSecondary}
            value={createName}
            onChangeText={setCreateName}
            autoCorrect={false}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="CPF (somente números) *"
            placeholderTextColor={Colors.textSecondary}
            value={createCpf}
            onChangeText={setCreateCpf}
            keyboardType="numeric"
            maxLength={14}
          />
          <TextInput
            style={styles.input}
            placeholder="Telefone * (ex: 92 99999-9999)"
            placeholderTextColor={Colors.textSecondary}
            value={createPhone}
            onChangeText={setCreatePhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="E-mail *"
            placeholderTextColor={Colors.textSecondary}
            value={createEmail}
            onChangeText={setCreateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Nascimento (AAAA-MM-DD — opcional)"
            placeholderTextColor={Colors.textSecondary}
            value={createBirthDate}
            onChangeText={setCreateBirthDate}
            keyboardType="numeric"
          />
        </View>

        {createError !== null && (
          <Text variant="bodySmall" color={Colors.brand} style={styles.errorText}>
            {createError}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.continueButton,
            (!canCreate || isCreating) && styles.buttonDisabled,
          ]}
          onPress={handleCreate}
          disabled={!canCreate || isCreating}
          activeOpacity={0.8}
        >
          {isCreating ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Text variant="label" color={Colors.textPrimary}>
              Cadastrar
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCancelCreate}
          style={styles.backLink}
          activeOpacity={0.7}
          disabled={isCreating}
        >
          <Text variant="bodySmall" color={Colors.textTertiary} style={styles.backText}>
            Cancelar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Search mode ────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="bodySmall" color={Colors.textTertiary}>
        Passo 2 de 4
      </Text>
      <Text variant="heading3" style={styles.title}>
        Cliente
      </Text>

      {/* Search input */}
      <View style={styles.searchWrapper}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          placeholder="Buscar por nome, CPF ou telefone..."
          placeholderTextColor={Colors.textSecondary}
          value={queryText}
          onChangeText={handleQueryChange}
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator style={styles.searchSpinner} color={Colors.brand} size="small" />
        )}
      </View>

      {/* Results */}
      {results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultRow}
              onPress={() => handleSelectCustomer(item)}
              activeOpacity={0.75}
            >
              <Text variant="body">{item.name}</Text>
              <Text variant="caption" color={Colors.textTertiary}>
                {[item.cpf_masked, item.phone_masked].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* New customer link — visible while typing */}
      {queryText.trim().length >= 3 && !isSearching && (
        <TouchableOpacity onPress={handleOpenCreate} style={styles.newClientLink} activeOpacity={0.7}>
          <Text variant="bodySmall" color={Colors.brand}>
            + Cadastrar "{queryText.trim()}"
          </Text>
        </TouchableOpacity>
      )}

      {/* Continue — only enabled after selection */}
      <TouchableOpacity
        style={[styles.primaryButton, styles.continueButton, styles.buttonDisabled]}
        disabled
        activeOpacity={0.8}
      >
        <Text variant="label" color={Colors.textPrimary}>
          Continuar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.backText}>
          Voltar
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    marginTop: 4,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchInput: {
    paddingRight: 44,
  },
  searchSpinner: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  resultsList: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bg,
    gap: 2,
  },
  newClientLink: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  customerCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: 14,
    gap: 4,
  },
  customerName: {
    fontWeight: '600',
  },
  swapLink: {
    marginTop: 8,
  },
  formSection: {
    gap: 12,
  },
  errorText: {
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: Colors.brand,
    borderRadius: Radii.md,
    padding: 14,
    alignItems: 'center',
  },
  continueButton: {
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backText: {
    textAlign: 'center',
  },
});
