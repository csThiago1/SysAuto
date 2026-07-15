"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { datetimeLocalToIso, toDatetimeLocalValue } from "../_lib/time";

interface ManualDialogProps {
  tecnicoId: string;
  onSubmit: (payload: {
    osId: string;
    tecnicoId: string;
    iniciadoEm: string;
    encerradoEm: string;
  }) => Promise<boolean>;
}

/** Lançamento manual de horas — fallback do timer. */
export function ManualDialog({ tecnicoId, onSubmit }: ManualDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [osId, setOsId] = useState("");
  const [osLabel, setOsLabel] = useState("");
  const [inicio, setInicio] = useState(() =>
    toDatetimeLocalValue(new Date(Date.now() - 60 * 60 * 1000))
  );
  const [fim, setFim] = useState(() => toDatetimeLocalValue(new Date()));
  const [saving, setSaving] = useState(false);

  const buscaDebounced = useDebounce(busca, 300);
  const osResults = useServiceOrders(
    { search: buscaDebounced },
    1,
    6,
    buscaDebounced.length >= 2
  );

  const valid = osId && inicio && fim && new Date(fim) > new Date(inicio);

  async function handleSave(): Promise<void> {
    if (!valid) return;
    setSaving(true);
    const ok = await onSubmit({
      osId,
      tecnicoId,
      iniciadoEm: datetimeLocalToIso(inicio),
      encerradoEm: datetimeLocalToIso(fim),
    });
    setSaving(false);
    if (ok) {
      setOpen(false);
      setOsId("");
      setOsLabel("");
      setBusca("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Lançar manual
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader>
          <DialogTitle>Lançamento manual</DialogTitle>
          <DialogDescription>Horas trabalhadas fora do timer.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="manual-os">OS</Label>
            {osId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="font-mono text-sm tabular-nums">{osLabel}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOsId("");
                    setOsLabel("");
                  }}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="manual-os"
                  placeholder="Placa ou número"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {buscaDebounced.length >= 2 && (
                  <ul className="flex flex-col divide-y divide-border/50">
                    {(osResults.data?.results ?? []).map((os) => (
                      <li key={os.id}>
                        <button
                          type="button"
                          className="w-full py-2 text-left font-mono text-sm tabular-nums"
                          onClick={() => {
                            setOsId(os.id);
                            setOsLabel(`${os.plate} · OS ${os.number}`);
                          }}
                        >
                          {os.plate} · OS {os.number}
                          <span className="block truncate font-sans text-xs text-muted-foreground">
                            {os.model}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-inicio">Início</Label>
            <Input
              id="manual-inicio"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-fim">Fim</Label>
            <Input
              id="manual-fim"
              type="datetime-local"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
            {osId && inicio && fim && new Date(fim) <= new Date(inicio) && (
              <p className="text-xs text-error-400">Fim deve ser depois do início.</p>
            )}
          </div>
        </div>
        <Button disabled={!valid || saving} onClick={() => void handleSave()}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
