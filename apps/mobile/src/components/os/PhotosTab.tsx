import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { toast } from '@/stores/toast.store';
import { PhotoGroup } from './PhotoGroup';
import { groupPhotosByFolder } from './os-detail-utils';
import type { OSPhoto, ServiceOrderDetail } from './os-detail-utils';

// ─── AcompanhamentoSection ────────────────────────────────────────────────────

interface AcompanhamentoSectionProps {
  osId: string;
  onAddPhoto: () => void;
  onPhotoPress: (url: string) => void;
  remotePhotos: OSPhoto[];
}

const AcompanhamentoSection = React.memo(function AcompanhamentoSection({
  osId,
  onAddPhoto,
  onPhotoPress,
  remotePhotos,
}: AcompanhamentoSectionProps): React.JSX.Element {
  const isOnline = useConnectivity();
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const localPhotos = usePhotoStore(
    useShallow((s) => s.queue.filter((p) => p.osId === osId && p.folder === 'acompanhamento')),
  );

  const pendingCount = localPhotos.filter((p) => p.uploadStatus === 'pending').length;
  const errorCount = localPhotos.filter((p) => p.uploadStatus === 'error').length;
  // Mostra botão para pending E para retry de erros
  const showUpload = pendingCount + errorCount > 0 && isOnline;
  const uploadLabel =
    errorCount > 0 && pendingCount === 0
      ? `Tentar novamente (${errorCount})`
      : `Enviar fotos (${pendingCount + errorCount})`;

  const handleUpload = useCallback((): void => {
    if (isUploading) return;
    // Recoloca erros como pending para que uploadPendingPhotos os processe
    const { queue } = usePhotoStore.getState();
    const errorIds = queue
      .filter((p) => p.osId === osId && p.folder === 'acompanhamento' && p.uploadStatus === 'error')
      .map((p) => p.id);
    errorIds.forEach((pid) => usePhotoStore.getState().retryPhoto(pid));
    setIsUploading(true);
    void uploadPendingPhotos()
      .then(() => {
        toast.success('Foto enviada');
      })
      .catch(() => {
        toast.error('Erro ao enviar foto');
      })
      .finally(() => setIsUploading(false));
  }, [isUploading, osId]);

  return (
    <View>
      <View style={styles.acompSectionHeader}>
        <Text variant="label" color={Colors.textPrimary}>
          Fotos de Acompanhamento
        </Text>
        <TouchableOpacity
          style={styles.acompAddBtn}
          onPress={onAddPhoto}
          activeOpacity={0.75}
        >
          <Ionicons name="camera-outline" size={16} color={Colors.brand} />
          <Text variant="caption" style={styles.acompAddLabel}>
            Adicionar
          </Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.card} padded={false}>
        {localPhotos.length === 0 && remotePhotos.length === 0 ? (
          <View style={styles.acompEmpty}>
            <Ionicons name="images-outline" size={32} color={Colors.skeleton} />
            <Text variant="bodySmall" color={Colors.textSecondary} style={styles.acompEmptyText}>
              Nenhuma foto de acompanhamento ainda
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
            contentContainerStyle={styles.acompScrollContent}
          >
            {/* Remote (uploaded) photos */}
            {remotePhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() => onPhotoPress(photo.url)}
                activeOpacity={0.85}
                style={styles.acompThumb}
              >
                <Image source={{ uri: photo.url }} style={styles.acompThumbImg} contentFit="cover" cachePolicy="disk" transition={150} />
                <View style={[styles.acompThumbBadge, styles.acompThumbDone]}>
                  <Ionicons name="checkmark" size={10} color={Colors.textPrimary} />
                </View>
              </TouchableOpacity>
            ))}
            {/* Local (queued) photos */}
            {localPhotos.map((photo) => {
              const uri = photo.annotatedLocalUri ?? photo.localUri;
              const isDone = photo.uploadStatus === 'done';
              const isErr = photo.uploadStatus === 'error';
              return (
                <TouchableOpacity
                  key={photo.id}
                  onPress={() => onPhotoPress(photo.remoteUrl ?? uri)}
                  activeOpacity={0.85}
                  style={styles.acompThumb}
                >
                  <Image source={{ uri }} style={styles.acompThumbImg} contentFit="cover" cachePolicy="disk" transition={150} />
                  <View
                    style={[
                      styles.acompThumbBadge,
                      isDone
                        ? styles.acompThumbDone
                        : isErr
                          ? styles.acompThumbErr
                          : styles.acompThumbPending,
                    ]}
                  >
                    {photo.uploadStatus === 'uploading' ? (
                      <ActivityIndicator
                        size="small"
                        color={Colors.textPrimary}
                        style={{ width: 10, height: 10 }}
                      />
                    ) : (
                      <Ionicons
                        name={isDone ? 'checkmark' : isErr ? 'alert' : 'time-outline'}
                        size={10}
                        color={Colors.textPrimary}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showUpload && (
          <TouchableOpacity
            style={styles.acompUploadBtn}
            onPress={handleUpload}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={14} color={Colors.textPrimary} />
            )}
            <Text variant="caption" style={styles.acompUploadLabel}>
              {isUploading ? 'Enviando...' : uploadLabel}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </View>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhotosTabProps {
  order: ServiceOrderDetail;
  osId: string;
  onAddAcompanhamento: () => void;
  onPhotoPress: (url: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhotosTab({
  order,
  osId,
  onAddAcompanhamento,
  onPhotoPress,
}: PhotosTabProps): React.JSX.Element {
  const acompanhamentoRemote = (order.photos ?? []).filter((p) => p.folder === 'acompanhamento');
  const nonAcompanhamentoPhotos = (order.photos ?? []).filter((p) => p.folder !== 'acompanhamento');
  const photoGroups =
    nonAcompanhamentoPhotos.length > 0 ? groupPhotosByFolder(nonAcompanhamentoPhotos) : [];

  return (
    <>
      <AcompanhamentoSection
        osId={osId}
        onAddPhoto={onAddAcompanhamento}
        onPhotoPress={onPhotoPress}
        remotePhotos={acompanhamentoRemote}
      />

      {photoGroups.length > 0 && (
        <>
          <SectionDivider label="OUTRAS FOTOS" />
          <Card style={styles.card} padded={false}>
            {photoGroups.map(([folder, photos]) => (
              <PhotoGroup
                key={folder}
                folder={folder}
                photos={photos}
                onPhotoPress={onPhotoPress}
              />
            ))}
          </Card>
        </>
      )}

      {acompanhamentoRemote.length === 0 && photoGroups.length === 0 && (
        <View style={styles.tabEmpty}>
          <Ionicons name="images-outline" size={40} color={Colors.skeleton} />
          <Text variant="bodySmall" color={Colors.textSecondary}>
            Nenhuma foto registrada
          </Text>
        </View>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  tabEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  // Photo scroll
  photoScroll: {
    paddingLeft: 16,
  },
  // Acompanhamento section
  acompSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  acompAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.brandTint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  acompAddLabel: {
    color: Colors.brand,
  },
  acompEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  acompEmptyText: {
    textAlign: 'center',
  },
  acompScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  acompThumb: {
    width: 90,
    height: 90,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    marginRight: 8,
    position: 'relative',
  },
  acompThumbImg: {
    width: '100%',
    height: '100%',
  },
  acompThumbBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acompThumbDone: { backgroundColor: Colors.success },
  acompThumbErr: { backgroundColor: Colors.error },
  acompThumbPending: { backgroundColor: Colors.textSecondary },
  acompUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.sm,
  },
  acompUploadLabel: {
    color: Colors.textPrimary,
  },
});
