import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NEUTRAL_PAINT, STOPS, type PanelKey, type Vec3 } from '@paddock/car-3d/core';

import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ItemChecklistGrid } from '@/components/checklist/ItemChecklistGrid';
import { SLOT_LABELS } from '@/components/checklist/PhotoSlotGrid';
import { BelongingsStop } from '@/components/entry-checklist/BelongingsStop';
import { BodyTypePicker } from '@/components/entry-checklist/BodyTypePicker';
import { DamageSheet } from '@/components/entry-checklist/DamageSheet';
import { StopProgress } from '@/components/entry-checklist/StopProgress';
import { SlotCards, StopScreen, type CarAsset } from '@/components/entry-checklist/StopScreen';
import {
  CHECKLIST_TYPE,
  checkStop,
  damageSlot,
  FOLDER,
  highlightsFor,
  stopPhotos,
} from '@/components/entry-checklist/stopLogic';
import { useEntryChecklistState } from '@/hooks/useEntryChecklistState';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { ApiError } from '@/lib/api';
import { ensureModel, loadRegions, resolveEntryModel } from '@/lib/car3dAssets';
import { syncChecklistItems } from '@/stores/checklist-items.store';
import {
  LOCKED_MESSAGE,
  syncEntryChecklist,
  useEntryChecklistStore,
  type DamageInput,
  type EntryChecklistDraft,
} from '@/stores/entry-checklist.store';
import { usePhotoStore } from '@/stores/photo.store';

// Checklist de entrada em 7 paradas (spec 5.2). Assinatura e mudança de status ficam na conferência web.

const EMPTY_DRAFT: EntryChecklistDraft = { bodyType: null, stops: {}, damages: [], belongings: [] };
const ITEM_CATEGORIES = ['tires', 'accessories', 'interior', 'mechanical'];
const BELONGING_SLOT = 'pertence';
const SENT_MESSAGE = 'Checklist enviado. Finalize e colha a assinatura na conferência (iPad ou monitor).';

const missingLabel = (m: string): string =>
  m === 'dano_ou_sem_dano' ? 'um dano ou "Sem dano aqui"' : `foto ${SLOT_LABELS[m] ?? m}`;

type RouteParams = { osId: string; stop?: string; photoId?: string };

export default function EntryChecklistRoute(): React.JSX.Element {
  const { osId = '', stop, photoId } = useLocalSearchParams<RouteParams>();
  // a aba mantém a tela montada: o estado local zera ao trocar de OS
  return <EntryChecklistScreen key={osId} osId={osId} stopParam={stop} photoId={photoId} />;
}

function EntryChecklistScreen({
  osId,
  stopParam,
  photoId,
}: {
  osId: string;
  stopParam: string | undefined;
  photoId: string | undefined;
}): React.JSX.Element {
  const router = useRouter();
  const { order, isLoading } = useServiceOrder(osId);
  const stateQuery = useEntryChecklistState(osId);
  const state = stateQuery.data;
  const draft = useEntryChecklistStore((s) => s.byOs[osId]) ?? EMPTY_DRAFT;
  const allowNcModels = useEntryChecklistStore((s) => s.allowNcModels);
  const queue = usePhotoStore((s) => s.queue);

  const [index, setIndex] = useState(() => Math.max(0, STOPS.findIndex((s) => s.key === stopParam)));
  const [noDamage, setNoDamage] = useState<Partial<Record<string, boolean>>>({});
  const [picking, setPicking] = useState<{ panel: PanelKey; point: Vec3 | null } | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; itemsLocked: boolean } | null>(null);

  // volta da câmera: `?stop=` reabre a parada de onde ela foi chamada
  useEffect(() => {
    const i = STOPS.findIndex((s) => s.key === stopParam);
    if (i >= 0) setIndex(i);
  }, [stopParam]);

  const stop = STOPS[index];

  // ── Carroceria e modelo 3D ────────────────────────────────────────────────
  const suggested = state?.body_type ?? state?.suggested_body_type ?? null;
  const bodyType = draft.bodyType ?? suggested;
  // o escolhido no picker vale até o PATCH aceitar; valor copiado acompanha o servidor (correção da web).
  // Servidor sem body_type: o do rascunho (sugestão ou rascunho antigo) vai no PATCH, senão o finalize cobra a carroceria.
  useEffect(() => {
    if (!state || draft.bodyTypeFromPicker) return;
    const set = useEntryChecklistStore.getState().setBodyType;
    if (state.body_type == null) {
      if (draft.bodyTypeSent) return; // GET anterior ao PATCH aceito

      const pick = draft.bodyType ?? state.suggested_body_type;
      if (pick) set(osId, pick, true);
    } else if (draft.bodyType !== state.body_type) {
      set(osId, state.body_type, false);
    }
  }, [state, draft.bodyType, draft.bodyTypeFromPicker, draft.bodyTypeSent, osId]);
  // guarda o que o GET trouxe para resolver o mesmo modelo 3D offline
  useEffect(() => {
    if (state) {
      useEntryChecklistStore
        .getState()
        .rememberServer(osId, { make: state.vehicle_make, family: state.vehicle_family }, state.allow_nc_models);
    }
  }, [state, osId]);

  // espera o GET de estado (ou a falha dele, sem rede) para não baixar o modelo errado
  const vehicle = draft.vehicle;
  const entry = useMemo(
    () =>
      bodyType && !stateQuery.isPending
        ? resolveEntryModel(state, vehicle, allowNcModels, bodyType)
        : null,
    [bodyType, stateQuery.isPending, state, vehicle, allowNcModels],
  );
  const carQuery = useQuery({
    queryKey: ['car-3d', entry?.key] as const,
    queryFn: async (): Promise<CarAsset> => {
      if (!entry) throw new Error('car-3d: sem modelo');
      const t0 = Date.now();
      const modelUri = await ensureModel(entry);
      const regions = await loadRegions(entry);
      console.info(`[car3d] ${entry.key}: data: URI de ${Math.round(modelUri.length / 1024)} KB em ${Date.now() - t0} ms`);
      return { modelUri, regions };
    },
    enabled: entry != null,
    staleTime: Infinity,
    networkMode: 'always', // lê do cache em disco sem rede
    retry: 1,
  });

  // ── Derivados ─────────────────────────────────────────────────────────────
  const highlights = useMemo(() => highlightsFor(draft.damages), [draft.damages]);
  const photos = useMemo(() => (stop ? stopPhotos(queue, osId, stop) : []), [queue, osId, stop]);
  const entryPhotos = useMemo(() => queue.filter((p) => p.osId === osId && p.folder === FOLDER), [queue, osId]);
  const check = stop ? checkStop(stop, draft, photos, !!noDamage[stop.key]) : null;
  const stopDamageCount = stop ? draft.damages.filter((d) => stop.panels.includes(d.panelKey)).length : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCamera = useCallback(
    (slot: string): void => {
      if (!stop) return;
      router.push({
        pathname: '/(app)/camera',
        params: {
          osId,
          slot,
          folder: FOLDER,
          checklistType: CHECKLIST_TYPE,
          returnTo: `/(app)/vistoria/entrada/${osId}?stop=${stop.key}`,
        },
      });
    },
    [router, osId, stop],
  );

  const handlePanelPick = useCallback((panel: PanelKey, point: Vec3 | null): void => setPicking({ panel, point }), []);

  const handleSaveDamage = (input: DamageInput): void => {
    if (!stop) return;
    const store = useEntryChecklistStore.getState();
    store.addDamage(osId, input);
    if (draft.stops[stop.key] === 'sem_dano') store.markStop(osId, stop.key, 'done');
    setPicking(null);
  };

  const handleNext = (): void => {
    if (!stop || !check?.ok) return;
    const value = stop.panels.length > 0 && stopDamageCount === 0 ? 'sem_dano' : 'done';
    useEntryChecklistStore.getState().markStop(osId, stop.key, value);
    setIndex(index + 1);
  };

  const handleSend = async (): Promise<void> => {
    setSending(true);
    try {
      const sync = await syncEntryChecklist(osId);
      // finalizado na conferência: o backend recusaria os itens (409)
      let itemsLocked = !!state?.finalized_at;
      let itemsOk = !itemsLocked;
      if (!itemsLocked) {
        try {
          itemsLocked = (await syncChecklistItems(osId)) === 'locked';
          itemsOk = !itemsLocked;
        } catch (err: unknown) {
          itemsOk = false;
          console.warn(`[entry checklist] osId=${osId} itens erro=${err instanceof ApiError ? err.status : 'rede'}`);
        }
      }
      const photosOk = usePhotoStore
        .getState()
        .queue.every((p) => p.osId !== osId || p.folder !== FOLDER || p.uploadStatus === 'done');
      setResult({ ok: sync.ok && itemsOk && photosOk, itemsLocked });
    } catch (err: unknown) {
      console.warn(`[entry checklist] osId=${osId} envio falhou: ${err instanceof Error ? err.message : 'desconhecido'}`);
      setResult({ ok: false, itemsLocked: false });
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const records = [...draft.damages, ...draft.belongings];
  const pendingRecords = records.filter((x) => x.syncStatus === 'pending').length;
  const pendingPhotos = entryPhotos.filter((p) => p.uploadStatus !== 'done').length;
  const errors = records.filter((x) => x.syncStatus === 'error');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.replace(`/(app)/os/${osId}`)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          <Text variant="label">{order ? `OS #${order.number}` : 'OS'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.brand} />
          ) : order ? (
            <>
              <Text variant="label" numberOfLines={1}>
                {order.plate}
              </Text>
              <Text variant="caption" color={Colors.textTertiary} numberOfLines={1}>
                {order.make} {order.model}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.back} />
      </View>

      {state?.finalized_at && (
        <View style={styles.lockedBanner}>
          <Ionicons name="lock-closed-outline" size={16} color={SemanticColors.warning.color} />
          <Text variant="bodySmall" style={{ flex: 1, color: SemanticColors.warning.color }}>
            Checklist já finalizado na conferência. Alterações daqui não serão aceitas.
          </Text>
        </View>
      )}

      {!bodyType ? (
        stateQuery.isPending ? (
          <ActivityIndicator style={{ marginTop: Spacing.xxl }} color={Colors.brand} />
        ) : (
          <BodyTypePicker onPick={(b) => useEntryChecklistStore.getState().setBodyType(osId, b, true)} />
        )
      ) : (
        <>
          <StopProgress current={index} stops={draft.stops} onSelect={setIndex} />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {/* mesma posição nas paradas 1–5: o carro 3D não remonta, só gira até a nova vista */}
            {stop && stop.panels.length > 0 && (
              <StopScreen
                stop={stop}
                photos={photos}
                damages={draft.damages}
                car={carQuery.data ?? null}
                carFailed={carQuery.isError}
                color={state?.vehicle_color_hex ?? NEUTRAL_PAINT}
                highlights={highlights}
                onSlotPress={openCamera}
                onPanelPick={handlePanelPick}
              />
            )}
            {stop?.key === 'interior_itens' && (
              <View style={{ gap: Spacing.lg }}>
                <SlotCards slots={stop.slots} photos={photos} onSlotPress={openCamera} />
                <ItemChecklistGrid osId={osId} checklistType={CHECKLIST_TYPE} categories={ITEM_CATEGORIES} />
              </View>
            )}
            {stop?.key === 'pertences' && (
              <BelongingsStop
                belongings={draft.belongings}
                photos={entryPhotos}
                capturedPhotoId={photoId}
                onTakePhoto={() => openCamera(BELONGING_SLOT)}
                onAdd={(description, id) =>
                  useEntryChecklistStore.getState().addBelonging(osId, { description, photoClientUuid: id })
                }
              />
            )}
            {!stop && (
              <View style={{ gap: Spacing.md }}>
                {result?.ok ? (
                  <View style={styles.sent}>
                    <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                    <Text variant="heading3" style={{ textAlign: 'center' }}>
                      {SENT_MESSAGE}
                    </Text>
                  </View>
                ) : (
                  STOPS.map((s, i) => (
                    <TouchableOpacity key={s.key} style={styles.reviewRow} onPress={() => setIndex(i)}>
                      <Ionicons
                        name={draft.stops[s.key] ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={draft.stops[s.key] ? Colors.success : Colors.textTertiary}
                      />
                      <Text variant="body" style={{ flex: 1 }}>
                        {i + 1}. {s.label}
                      </Text>
                      {!draft.stops[s.key] && (
                        <Text variant="caption" color={Colors.warning}>
                          pendente
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
                <Text variant="bodySmall" color={Colors.textSecondary}>
                  {draft.damages.length} dano(s) · {draft.belongings.length} pertence(s)
                </Text>
                {result && (pendingRecords > 0 || pendingPhotos > 0) && (
                  <Text variant="bodySmall" color={Colors.warning}>
                    Pendentes na fila: {pendingRecords} registro(s) e {pendingPhotos} foto(s). Ficam guardados no
                    aparelho; toque em Enviar de novo quando houver rede.
                  </Text>
                )}
                {result?.itemsLocked && (
                  <Text variant="bodySmall" color={Colors.error}>
                    {LOCKED_MESSAGE}: itens não enviados
                  </Text>
                )}
                {errors.map((e) => (
                  <Text key={e.clientUuid} variant="bodySmall" color={Colors.error}>
                    {e.errorMessage ?? 'Erro ao enviar'}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {stop ? (
              <>
                {check && !check.ok && (
                  <Text variant="caption" color={Colors.textSecondary}>
                    Falta: {check.missing.map(missingLabel).join(', ')}
                  </Text>
                )}
                <View style={styles.footerRow}>
                  {stop.panels.length > 0 && (
                    <Button
                      label="Sem dano aqui"
                      variant={noDamage[stop.key] || draft.stops[stop.key] === 'sem_dano' ? 'primary' : 'secondary'}
                      disabled={stopDamageCount > 0}
                      onPress={() => setNoDamage((n) => ({ ...n, [stop.key]: true }))}
                      style={{ flex: 1 }}
                    />
                  )}
                  <Button label="Próximo →" disabled={!check?.ok} onPress={handleNext} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Button
                label={result ? 'Enviar de novo' : 'Enviar para conferência'}
                fullWidth
                loading={sending}
                onPress={() => void handleSend()}
              />
            )}
          </View>
        </>
      )}

      {picking && stop && (
        <DamageSheet
          panelKey={picking.panel}
          point={picking.point}
          photos={photos}
          capturedPhotoId={photoId}
          onTakePhoto={() => openCamera(damageSlot(stop.key))}
          onSave={handleSaveDamage}
          onClose={() => setPicking(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 72 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    marginBottom: 0,
    padding: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: SemanticColors.warning.bg,
    borderWidth: 1,
    borderColor: SemanticColors.warning.border,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
  sent: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerRow: { flexDirection: 'row', gap: Spacing.sm },
});
