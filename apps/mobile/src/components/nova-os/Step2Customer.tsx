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
import { useNewOSStore } from '@/stores/new-os.store';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step2CustomerProps {
  onNext: () => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Step2Customer({ onNext, onBack }: Step2CustomerProps): React.JSX.Element {
  const { results, isLoading, search, clear } = useCustomerSearch();

  const customer = useNewOSStore((s) => s.customer);
  const customerManualName = useNewOSStore((s) => s.customerManualName);
  const customerSource = useNewOSStore((s) => s.customerSource);
  const setCustomer = useNewOSStore((s) => s.setCustomer);
  const setCustomerManualName = useNewOSStore((s) => s.setCustomerManualName);

  const [queryText, setQueryText] = useState<string>('');

  // Clear search results when component unmounts
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
  };

  const showManualEntry =
    customerSource !== 'search' &&
    customer === null &&
    queryText.length >= 2 &&
    results.length === 0 &&
    !isLoading;

  const isContinueDisabled = (): boolean => {
    if (customerSource === 'search' && customer !== null) return false;
    return customerManualName.trim().length < 3;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step label */}
      <Text variant="bodySmall" color="#6b7280">
        Passo 2 de 4
      </Text>

      {/* Title */}
      <Text variant="heading3" style={styles.title}>
        Cliente
      </Text>

      {/* Selected customer card */}
      {customerSource === 'search' && customer !== null ? (
        <View style={styles.selectedCard}>
          <Text variant="label" style={styles.selectedName}>
            {customer.name}
          </Text>
          <Text variant="bodySmall" color="#6b7280">
            {customer.cpf_masked} · {customer.phone_masked}
          </Text>
          <TouchableOpacity onPress={handleSwapCustomer} style={styles.swapLink}>
            <Text variant="bodySmall" color="#e31b1b">
              Trocar cliente
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Search input */}
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.searchInput]}
              placeholder="Buscar por nome, CPF ou telefone..."
              placeholderTextColor="#9ca3af"
              value={queryText}
              onChangeText={handleQueryChange}
              autoCorrect={false}
            />
            {isLoading && (
              <ActivityIndicator
                style={styles.searchSpinner}
                color="#e31b1b"
                size="small"
              />
            )}
          </View>

          {/* Results list */}
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
                  <Text variant="caption" color="#6b7280">{item.cpf_masked} · {item.phone_masked}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Manual entry */}
          {showManualEntry && (
            <View style={styles.manualSection}>
              <Text variant="bodySmall" color="#6b7280">
                Cadastro rápido
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Nome completo"
                placeholderTextColor="#9ca3af"
                value={customerManualName}
                onChangeText={setCustomerManualName}
                autoCorrect={false}
              />
            </View>
          )}
        </>
      )}

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.primaryButton, isContinueDisabled() && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isContinueDisabled()}
        activeOpacity={0.8}
      >
        <Text variant="label" color="#ffffff">
          Continuar
        </Text>
      </TouchableOpacity>

      {/* Back link */}
      <TouchableOpacity onPress={onBack} style={styles.backLink} activeOpacity={0.7}>
        <Text variant="bodySmall" color="#6b7280" style={styles.backText}>
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  searchRow: {
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
  selectedCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  selectedName: {
    color: '#1e3a5f',
  },
  swapLink: {
    marginTop: 8,
  },
  resultsList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    maxHeight: 200,
  },
  resultRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 2,
  },
  manualSection: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#e31b1b',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
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
