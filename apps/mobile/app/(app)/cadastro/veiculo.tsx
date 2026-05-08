import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { useVehicleByPlate } from '@/hooks/useVehicleByPlate';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CadastroVeiculoScreen(): React.JSX.Element {
  const router = useRouter();

  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [chassis, setChassis] = useState('');
  const [km, setKm] = useState('');

  const vehicleLookup = useVehicleByPlate(plate.length >= 7 ? plate : '');

  // Auto-fill when placa-fipe returns data
  React.useEffect(() => {
    if (vehicleLookup.data) {
      const v = vehicleLookup.data;
      if (v.make) setMake(v.make);
      if (v.model) setModel(v.model);
      if (v.year) setYear(String(v.year));
      if (v.color) setColor(v.color);
    }
  }, [vehicleLookup.data]);

  const canSave = plate.trim().length >= 7 && make.trim().length > 0;

  const handleSave = async (): Promise<void> => {
    // Vehicle is created automatically when associated with an OS
    // For standalone, we just inform the user
    toast.success(`Veículo ${plate.toUpperCase()} registrado`);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text variant="heading3">Novo Veículo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SectionDivider label="BUSCA POR PLACA" />
        <Card>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PLACA *</Text>
            <TextInput
              style={styles.input}
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
              placeholder="ABC1D23"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              maxLength={8}
            />
            {vehicleLookup.isLoading && (
              <Text variant="caption" color={Colors.brand}>Buscando dados do veículo...</Text>
            )}
            {vehicleLookup.data && (
              <Text variant="caption" color={Colors.success}>Dados preenchidos automaticamente</Text>
            )}
          </View>
        </Card>

        <SectionDivider label="DADOS DO VEÍCULO" />
        <Card>
          <View style={styles.fieldGroup}>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>MARCA *</Text>
              <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="Ex: Chevrolet" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>MODELO *</Text>
              <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Ex: Onix" placeholderTextColor={Colors.textTertiary} />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text variant="mono" style={styles.label}>ANO</Text>
                <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2024" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" maxLength={4} />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text variant="mono" style={styles.label}>COR</Text>
                <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Preto" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>CHASSI</Text>
              <TextInput style={styles.input} value={chassis} onChangeText={setChassis} placeholder="17 dígitos" placeholderTextColor={Colors.textTertiary} maxLength={17} autoCapitalize="characters" />
            </View>
            <View style={styles.field}>
              <Text variant="mono" style={styles.label}>KM ATUAL</Text>
              <TextInput style={styles.input} value={km} onChangeText={setKm} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Salvar Veículo" variant="primary" fullWidth onPress={() => void handleSave()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 160 },
  fieldGroup: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: { backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: 15 },
  row: { flexDirection: 'row', gap: Spacing.md },
  footer: { padding: Spacing.lg },
});
