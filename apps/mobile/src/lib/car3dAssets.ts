import { Directory, File, Paths } from 'expo-file-system';
import { RegionsSchema, type CarModelEntry, type Regions } from '@paddock/car-3d/core';
import { WEB_BASE_URL } from '@/lib/constants';

// Cache em Paths.document/car-3d/: baixa do web (/car-3d/, público) uma vez e serve offline depois.

async function cached(name: string, url: string): Promise<File> {
  const dir = new Directory(Paths.document, 'car-3d');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, name);
  // o download só move o arquivo para o destino depois de completo e com status 2xx
  if (!file.exists) await File.downloadFileAsync(url, file);
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
