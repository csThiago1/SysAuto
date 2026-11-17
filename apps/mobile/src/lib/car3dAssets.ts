import { Directory, File, Paths } from 'expo-file-system';
import { RegionsSchema, resolveCarModel, type BodyType, type CarModelEntry, type Regions } from '@paddock/car-3d/core';
import type { EntryChecklistState } from '@/hooks/useEntryChecklistState';
import { WEB_BASE_URL } from '@/lib/constants';
import type { EntryChecklistDraft } from '@/stores/entry-checklist.store';

// Cache em Paths.document/car-3d/: baixa do web (/car-3d/, público) e serve offline depois.
// O regions.json é recalibrado com o mesmo nome: com rede, um HEAD compara a ETag guardada
// em `<nome>.etag` e rebaixa se mudou. Sem rede (ou sem ETag), usa o cache.

const HEAD_TIMEOUT_MS = 4000;

async function remoteEtag(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    return res.ok ? res.headers.get('etag') : null;
  } catch {
    return null; // sem rede: o cache vale
  } finally {
    clearTimeout(timer);
  }
}

async function cached(name: string, url: string): Promise<File> {
  const dir = new Directory(Paths.document, 'car-3d');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, name);
  const tag = new File(dir, `${name}.etag`);
  const etag = await remoteEtag(url);
  if (file.exists) {
    if (etag === null || (tag.exists && (await tag.text()) === etag)) return file;
    try {
      // o download só move o arquivo para o destino depois de completo e com status 2xx
      await File.downloadFileAsync(url, file, { idempotent: true });
    } catch (err: unknown) {
      console.warn(`[car3d] revalidação de ${name} falhou, usando cache`, err);
      return file;
    }
  } else {
    await File.downloadFileAsync(url, file);
  }
  if (etag !== null) tag.write(etag);
  return file;
}

/**
 * Garante o .glb e o regions.json do modelo no cache e devolve o .glb como `data:` URI.
 * O spike (Task 1) mostrou que o DOM component não lê `file://` (origem http em dev); `data:` carrega.
 */
export async function ensureModel(entry: CarModelEntry): Promise<string> {
  const glb = await cached(entry.file, `${WEB_BASE_URL}/car-3d/${entry.file}`);
  await cached(entry.regionsFile, `${WEB_BASE_URL}/car-3d/regions/${entry.regionsFile}`);
  const base64 = await glb.base64();
  // um redirect para uma página HTML viria com 200: não deixa lixo no cache
  if (!atob(base64.slice(0, 8)).startsWith('glTF')) {
    glb.delete();
    throw new Error(`car-3d: ${entry.file} não é um .glb`);
  }
  return `data:model/gltf-binary;base64,${base64}`;
}

export async function loadRegions(entry: CarModelEntry): Promise<Regions> {
  const file = await cached(entry.regionsFile, `${WEB_BASE_URL}/car-3d/regions/${entry.regionsFile}`);
  try {
    return RegionsSchema.parse(JSON.parse(await file.text()));
  } catch (err: unknown) {
    file.delete();
    throw err;
  }
}

/** Com o GET do estado usa o servidor; sem ele (offline), o último GET guardado no rascunho e no store. */
export function resolveEntryModel(
  state: EntryChecklistState | undefined,
  saved: EntryChecklistDraft['vehicle'],
  allowNcModels: boolean,
  bodyType: BodyType,
): CarModelEntry {
  return resolveCarModel({
    make: state ? state.vehicle_make : (saved?.make ?? null),
    family: state ? state.vehicle_family : (saved?.family ?? null),
    bodyType,
    allowNc: state ? state.allow_nc_models : allowNcModels,
  });
}
