"use client";

import { TransformControls, useGLTF } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import type { Mesh } from "three";
import {
  CAR_MODELS,
  NEUTRAL_PAINT,
  PANEL_KEYS,
  PANEL_LABELS,
  RegionsSchema,
  SEVERITY_COLORS,
  type CarModelEntry,
  type PanelKey,
  type RegionBox,
  type Regions,
  type Vec3,
} from "@paddock/car-3d";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// WebGL só no navegador
const Car3D = dynamic(() => import("@paddock/car-3d").then((m) => m.Car3D), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

type Mode = "translate" | "scale";

const round = (n: number): number => Math.round(n * 1000) / 1000;
const roundVec = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])];

/** null = o modelo ainda não tem regions.json (começa vazio). */
async function fetchRegions(entry: CarModelEntry): Promise<Regions | null> {
  const res = await fetch(`/car-3d/regions/${entry.regionsFile}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return RegionsSchema.parse(await res.json());
}

/** JSON limpo: 3 casas, sem peça vazia, sem rotationY zero. Valida antes de baixar. */
function toExport(regions: Regions): Regions {
  const panels: Regions["panels"] = {};
  for (const key of PANEL_KEYS) {
    const boxes = regions.panels[key] ?? [];
    if (boxes.length === 0) continue;
    panels[key] = boxes.map((b) => ({
      center: roundVec(b.center),
      size: roundVec(b.size),
      ...(b.rotationY ? { rotationY: round(b.rotationY) } : {}),
    }));
  }
  return RegionsSchema.parse({ ...regions, panels });
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lê os nomes dos materiais do .glb (mesmo cache do useGLTF do Car3D). */
function MaterialLister({ url, onMaterials }: { url: string; onMaterials: (names: string[]) => void }): null {
  const { materials } = useGLTF(url);
  useEffect(() => onMaterials(Object.keys(materials).sort()), [materials, onMaterials]);
  return null;
}

function EditableBox({
  box,
  active,
  mode,
  onChange,
}: {
  box: RegionBox;
  active: boolean;
  mode: Mode;
  onChange: (box: RegionBox) => void;
}): ReactElement {
  const [mesh, setMesh] = useState<Mesh | null>(null);
  return (
    <>
      {/* caixa unitária escalada: scale = size, então o TransformControls mexe direto no tamanho */}
      <mesh ref={setMesh} position={box.center} scale={box.size} rotation-y={box.rotationY ?? 0}>
        <boxGeometry />
        <meshBasicMaterial color={active ? "#ff2bd6" : "#ffb020"} wireframe />
      </mesh>
      {active && mesh && (
        <TransformControls
          object={mesh}
          mode={mode}
          size={0.7}
          onObjectChange={() =>
            onChange({
              center: [mesh.position.x, mesh.position.y, mesh.position.z],
              size: [Math.max(Math.abs(mesh.scale.x), 0.01), Math.max(Math.abs(mesh.scale.y), 0.01), Math.max(Math.abs(mesh.scale.z), 0.01)],
              rotationY: box.rotationY,
            })
          }
        />
      )}
    </>
  );
}

function Editor({ entry, initial }: { entry: CarModelEntry; initial: Regions | null }): ReactElement {
  const [regions, setRegions] = useState<Regions>(initial ?? { model: entry.key, paintMaterials: [], panels: {} });
  const [selected, setSelected] = useState<PanelKey | null>(null);
  const [activeBox, setActiveBox] = useState(0);
  const [mode, setMode] = useState<Mode>("translate");
  const [showRegions, setShowRegions] = useState(true);
  const [materials, setMaterials] = useState<string[]>([]);
  const [tapped, setTapped] = useState<{ panel: PanelKey | null; point: Vec3 } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const modelUrl = `/car-3d/${entry.file}`;
  const boxes = selected ? regions.panels[selected] ?? [] : [];
  const current = boxes[activeBox];

  const setBoxes = (key: PanelKey, next: RegionBox[]): void =>
    setRegions((r) => ({ ...r, panels: { ...r.panels, [key]: next } }));
  const updateBox = (i: number, box: RegionBox): void => {
    if (selected) setBoxes(selected, boxes.map((b, j) => (j === i ? box : b)));
  };
  const addBox = (): void => {
    if (!selected) return;
    const base = current ?? { center: [0, 0.8, 0] as Vec3, size: [0.3, 0.3, 0.3] as Vec3 };
    setBoxes(selected, [...boxes, { center: [base.center[0], base.center[1] + 0.1, base.center[2]], size: base.size }]);
    setActiveBox(boxes.length);
  };
  const removeBox = (): void => {
    if (!selected || !current) return;
    setBoxes(selected, boxes.filter((_, j) => j !== activeBox));
    setActiveBox(0);
  };
  const togglePaint = (name: string): void =>
    setRegions((r) => ({
      ...r,
      paintMaterials: r.paintMaterials.includes(name)
        ? r.paintMaterials.filter((m) => m !== name)
        : [...r.paintMaterials, name],
    }));
  const exportJson = (): void => {
    try {
      download(entry.regionsFile, `${JSON.stringify(toExport(regions), null, 2)}\n`);
      setExportError(null);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "JSON inválido");
    }
  };

  const highlights = useMemo(
    () => (selected ? [{ panel: selected, color: SEVERITY_COLORS.moderada }] : []),
    [selected],
  );
  const onMaterials = useCallback((names: string[]) => setMaterials(names), []);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative h-[60vh] lg:h-[calc(100vh-180px)] rounded-lg border bg-muted/20">
        <Car3D
          className="h-full w-full"
          modelUrl={modelUrl}
          regions={regions}
          color={NEUTRAL_PAINT}
          highlights={highlights}
          showRegions={showRegions}
          onPanelTap={(panel, point) => setTapped({ panel, point })}
        >
          <MaterialLister url={modelUrl} onMaterials={onMaterials} />
          {boxes.map((box, i) => (
            <EditableBox
              key={`${selected}-${i}`}
              box={box}
              active={i === activeBox}
              mode={mode}
              onChange={(b) => updateBox(i, b)}
            />
          ))}
        </Car3D>
        <div className="absolute left-3 top-3 rounded bg-background/90 px-3 py-2 text-xs shadow" data-testid="tapped">
          {tapped ? (
            <>
              <div className="font-medium">
                {tapped.panel ? `${PANEL_LABELS[tapped.panel]} (${tapped.panel})` : "Nenhuma peça"}
              </div>
              <div className="text-muted-foreground">{roundVec(tapped.point).join(", ")}</div>
            </>
          ) : (
            "Toque no carro para ver a peça detectada"
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4 overflow-y-auto lg:max-h-[calc(100vh-180px)]">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportJson}>
            Exportar JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowRegions((v) => !v)}>
            {showRegions ? "Esconder caixas" : "Mostrar caixas"}
          </Button>
        </div>
        {exportError && <p className="text-xs text-destructive">{exportError}</p>}

        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">Materiais de pintura</h3>
          {materials.length === 0 ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            materials.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={regions.paintMaterials.includes(name)} onChange={() => togglePaint(name)} />
                {name}
              </label>
            ))
          )}
        </section>

        {selected && (
          <section className="space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">{PANEL_LABELS[selected]}</h3>
            <div className="flex flex-wrap gap-2">
              {boxes.map((_, i) => (
                <Button key={i} size="sm" variant={i === activeBox ? "default" : "outline"} onClick={() => setActiveBox(i)}>
                  Caixa {i + 1}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={addBox}>
                + Caixa
              </Button>
              {current && (
                <Button size="sm" variant="ghost" onClick={removeBox}>
                  Remover caixa
                </Button>
              )}
            </div>
            {current ? (
              <>
                <div className="flex gap-2">
                  {(["translate", "scale"] as const).map((m) => (
                    <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                      {m === "translate" ? "Mover" : "Escalar"}
                    </Button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  rotationY (graus)
                  <input
                    type="number"
                    step={1}
                    className="w-20 rounded border bg-background px-2 py-1"
                    value={round(((current.rotationY ?? 0) * 180) / Math.PI)}
                    onChange={(e) => updateBox(activeBox, { ...current, rotationY: (Number(e.target.value) * Math.PI) / 180 })}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  centro {roundVec(current.center).join(", ")} · tamanho {roundVec(current.size).join(", ")}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Esta peça não tem caixa neste modelo.</p>
            )}
          </section>
        )}

        <section className="rounded-lg border p-1">
          {PANEL_KEYS.map((key) => {
            const count = regions.panels[key]?.length ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelected(key === selected ? null : key);
                  setActiveBox(0);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted",
                  key === selected && "bg-muted font-medium",
                )}
              >
                <span>{PANEL_LABELS[key]}</span>
                <span className={cn("text-xs", count === 0 ? "text-muted-foreground" : "text-foreground")}>{count}</span>
              </button>
            );
          })}
        </section>
      </aside>
    </div>
  );
}

function Calibrator(): ReactElement {
  const [modelKey, setModelKey] = useState(CAR_MODELS[0]?.key ?? "");
  const entry = CAR_MODELS.find((m) => m.key === modelKey);
  const query = useQuery({
    queryKey: ["car-3d-regions", entry?.regionsFile],
    queryFn: () => (entry ? fetchRegions(entry) : Promise.resolve(null)),
    enabled: Boolean(entry),
  });

  return (
    <div className="flex flex-col gap-4 p-3 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calibração do carro 3D</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste as caixas das peças e exporte o regions.json. Tela interna de desenvolvimento.
          </p>
        </div>
        <div className="w-64">
          <NativeSelect value={modelKey} onChange={(e) => setModelKey(e.target.value)} aria-label="Modelo">
            {CAR_MODELS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {!entry ? (
        <p className="text-sm text-muted-foreground">Nenhum modelo no catálogo.</p>
      ) : query.isLoading ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : query.isError ? (
        <div className="space-y-2 rounded-lg border border-destructive/40 p-4 text-sm">
          <p>Não foi possível carregar o regions.json: {query.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {query.data === null && (
            <p className="text-sm text-muted-foreground">Este modelo ainda não tem regions.json: começando vazio.</p>
          )}
          <Editor key={entry.key} entry={entry} initial={query.data ?? null} />
        </>
      )}
    </div>
  );
}

export function CarCalibrator(): ReactElement {
  return (
    <PermissionGate role="ADMIN" fallback={<p className="p-6 text-sm text-muted-foreground">Acesso restrito a administradores.</p>}>
      <Calibrator />
    </PermissionGate>
  );
}
