"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Search, Square } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import {
  useApontamentosGlobais,
  useApontamentoManual,
  useEncerrarApontamento,
  useIniciarApontamento,
  useStaff,
} from "@/hooks/useApontamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManualDialog } from "./_components/ManualDialog";
import { TimerRing } from "./_components/TimerRing";
import { formatHoras } from "./_lib/time";

const TECNICO_KEY = "apontamento.tecnico";

export default function ApontamentoPage(): React.ReactElement {
  const [tecnicoId, setTecnicoId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 300);

  const { data: staff, isLoading: staffLoading } = useStaff();
  const abertos = useApontamentosGlobais(
    tecnicoId ? { tecnico: tecnicoId, status: "iniciado" } : {}
  );
  const hoje = useApontamentosGlobais(tecnicoId ? { tecnico: tecnicoId, hoje: "1" } : {});
  const osResults = useServiceOrders(
    { search: buscaDebounced },
    1,
    8,
    buscaDebounced.length >= 2
  );
  const iniciar = useIniciarApontamento();
  const encerrar = useEncerrarApontamento();
  const manual = useApontamentoManual();

  // técnico memorizado no device
  useEffect(() => {
    const saved = localStorage.getItem(TECNICO_KEY);
    if (saved) setTecnicoId(saved);
  }, []);
  useEffect(() => {
    if (tecnicoId) localStorage.setItem(TECNICO_KEY, tecnicoId);
  }, [tecnicoId]);

  const timerAberto = abertos.data?.[0];
  const encerradosHoje = useMemo(
    () => (hoje.data ?? []).filter((a) => a.status !== "iniciado"),
    [hoje.data]
  );

  async function handleIniciar(osId: string): Promise<void> {
    try {
      await iniciar.mutateAsync({ osId, tecnicoId });
      setBusca("");
    } catch {
      toast.error("Erro ao iniciar apontamento. Tente novamente.");
    }
  }

  async function handleEncerrar(): Promise<void> {
    if (!timerAberto) return;
    try {
      await encerrar.mutateAsync({
        osId: timerAberto.os_id,
        apontamentoId: timerAberto.id,
      });
      toast.success("Apontamento encerrado.");
    } catch {
      toast.error("Erro ao encerrar. Tente novamente.");
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-0 md:max-w-2xl">
      <PageHeader title="Apontamento" description="Horas dos técnicos por OS" />

      {/* Técnico */}
      <Select value={tecnicoId} onValueChange={setTecnicoId}>
        <SelectTrigger aria-label="Técnico">
          <SelectValue
            placeholder={staffLoading ? "Carregando técnicos..." : "Selecione o técnico"}
          />
        </SelectTrigger>
        <SelectContent>
          {(staff ?? [])
            .filter((s) => s.is_active)
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.job_title_display ? ` · ${s.job_title_display}` : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {tecnicoId && (
        <>
          {timerAberto ? (
            <div className="flex flex-col items-center gap-4 rounded-[11px] bg-card px-3 py-6">
              <TimerRing startIso={timerAberto.iniciado_em} />
              <div className="text-center">
                <p className="font-mono text-sm tabular-nums text-muted-foreground">
                  {timerAberto.os_plate} · OS {timerAberto.os_numero}
                </p>
                <p className="text-sm font-medium">{timerAberto.os_model}</p>
              </div>
              <Button
                className="w-full"
                variant="destructive"
                disabled={encerrar.isPending}
                onClick={() => void handleEncerrar()}
              >
                {encerrar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Finalizar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-[11px] bg-card px-3 py-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar OS por placa ou número"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar OS"
                />
              </div>
              {buscaDebounced.length >= 2 && (
                <ul className="flex flex-col divide-y divide-border/50">
                  {osResults.isLoading && (
                    <li className="py-3 text-sm text-muted-foreground">Buscando…</li>
                  )}
                  {(osResults.data?.results ?? []).map((os) => (
                    <li key={os.id}>
                      <button
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1fr)_44px] items-center gap-2 py-2 text-left"
                        disabled={iniciar.isPending}
                        onClick={() => void handleIniciar(os.id)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm tabular-nums">
                            {os.plate} · OS {os.number}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {os.model}
                          </span>
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Play className="h-4 w-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                  {!osResults.isLoading && osResults.data?.results?.length === 0 && (
                    <li className="py-3 text-sm text-muted-foreground">
                      Nenhuma OS encontrada.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Hoje</h2>
            <ManualDialog
              tecnicoId={tecnicoId}
              onSubmit={async (payload) => {
                try {
                  await manual.mutateAsync(payload);
                  toast.success("Apontamento registrado.");
                  return true;
                } catch {
                  toast.error("Erro ao registrar. Tente novamente.");
                  return false;
                }
              }}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {hoje.isLoading && (
              <li className="text-sm text-muted-foreground">Carregando…</li>
            )}
            {encerradosHoje.map((a) => (
              <li
                key={a.id}
                className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2 rounded-[11px] bg-card px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm tabular-nums">
                    {a.os_plate} · OS {a.os_numero}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.os_model}
                  </span>
                </span>
                <span className="text-right font-mono text-sm tabular-nums text-success-400">
                  {formatHoras(a.horas_apontadas)}
                </span>
              </li>
            ))}
            {!hoje.isLoading && encerradosHoje.length === 0 && (
              <li className="rounded-[11px] bg-card px-3 py-2.5 text-sm text-muted-foreground">
                Nenhum apontamento hoje.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
