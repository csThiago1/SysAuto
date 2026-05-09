import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { Colors, Spacing } from '@/constants/theme';
import { useOSDocuments, downloadAndSharePdf } from '@/hooks/useOSDocuments';
import { toast } from '@/stores/toast.store';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocsTabProps {
  osId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocsTab({ osId }: DocsTabProps): React.JSX.Element {
  const { documents, isLoading, generateDocument, isGenerating } = useOSDocuments(osId);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ShimmerBlock height={80} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {documents.length === 0 ? (
        <Card style={styles.card}>
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
            <Text variant="body" color={Colors.textTertiary}>
              Nenhum documento gerado
            </Text>
          </View>
        </Card>
      ) : (
        documents.map((doc) => (
          <Card key={doc.id} style={styles.card}>
            <View style={styles.docContent}>
              <View style={styles.docHeader}>
                <Text variant="body" color={Colors.textPrimary}>
                  {doc.document_type_display}
                </Text>
                <MonoLabel variant="accent">{`v${doc.version}`}</MonoLabel>
              </View>
              <Text variant="bodySmall" color={Colors.textTertiary}>
                {new Date(doc.generated_at).toLocaleDateString('pt-BR')} · {doc.generated_by_name}
              </Text>
              <View style={styles.docActions}>
                <Button
                  variant="ghost"
                  label="Compartilhar"
                  onPress={async () => {
                    try {
                      await downloadAndSharePdf(
                        doc.download_url,
                        `${doc.document_type_display}-v${doc.version}`,
                      );
                    } catch {
                      toast.error('Erro ao compartilhar documento');
                    }
                  }}
                />
              </View>
            </View>
          </Card>
        ))
      )}

      <View style={styles.generateWrapper}>
        <Button
          variant="secondary"
          label={isGenerating ? 'Gerando...' : 'Gerar Documento'}
          loading={isGenerating}
          onPress={async () => {
            try {
              await generateDocument('os_report');
              toast.success('Documento gerado com sucesso');
            } catch {
              toast.error('Erro ao gerar documento');
            }
          }}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  empty: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  docContent: {
    gap: Spacing.sm,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  generateWrapper: {
    marginHorizontal: 16,
  },
});
