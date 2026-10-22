"use client";

import { Controller, useFormContext } from "react-hook-form";
import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker";
import { RestricaoAlert, placaPrefill, usePlacaLookup } from "@/components/vehicle/PlacaLookup";
import { applyIfEmpty } from "@/lib/prefill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorSelect } from "../../os/[numero]/_components/shared/ColorSelect";
import type { NewOSInput } from "../../os/_components/new-os.schema";
import { formatPlate } from "@paddock/utils"

const TERMINAL_STATUS = new Set(["delivered", "cancelled"]);

/** Passo 1 — placa (consulta no blur ou no botão) e veículo pelo seletor do catálogo. */
export function StepPlaca(): React.ReactElement {
  const form = useFormContext<NewOSInput>();
  const { watch, setValue, control, formState } = form;
  const plate = watch("plate");

  const placa = usePlacaLookup((fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")));
    toast.success("Dados do veículo preenchidos pela placa.");
  });

  // OS aberta com a mesma placa → aviso com link
  const dup = useServiceOrders({ search: plate ?? "" }, 1, 5, (plate ?? "").length >= 7);
  const osAberta = (dup.data?.results ?? []).find(
    (os) => os.plate === plate && !TERMINAL_STATUS.has(os.status)
  );

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    setValue("plate", val, { shouldValidate: true });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="rec-plate">Placa</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="rec-plate"
              value={formatPlate(plate ?? "")}
              onChange={handlePlateChange}
              onBlur={() => placa.lookup(plate)}
              placeholder="ABC-1D23"
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono text-lg tracking-widest"
              inputMode="text"
            />
            {placa.isFetching && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={placa.isFetching}
            onClick={() => placa.lookup(plate)}
          >
            Consultar
          </Button>
        </div>
        {formState.errors.plate && (
          <p className="text-xs text-error-400">{formState.errors.plate.message}</p>
        )}
        {placa.notFound && (
          <p className="text-xs text-muted-foreground">
            Placa não encontrada — escolha o veículo na lista.
          </p>
        )}
      </div>

      <RestricaoAlert restricao={placa.restricao} />

      {osAberta && (
        <Link
          href={`/os/${osAberta.number}`}
          className="flex items-start gap-2 rounded-[11px] bg-warning-500/10 px-3 py-2.5 text-sm text-warning-400"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Já existe a OS <span className="font-mono">{osAberta.number}</span> aberta para
            esta placa. Toque para abrir.
          </span>
        </Link>
      )}

      <Controller
        name="catalog_selection"
        control={control}
        render={({ field }) => (
          <VehicleCatalogPicker
            value={field.value ?? null}
            onChange={(sel) => {
              field.onChange(sel);
              // ponytail: o ano de fabricação é do veículo anterior; sem campo para corrigi-lo
              setValue("year_manufacture", null);
            }}
            error={formState.errors.catalog_selection?.message}
          />
        )}
      />

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <Controller
          name="color"
          control={control}
          render={({ field }) => <ColorSelect value={field.value ?? ""} onChange={field.onChange} />}
        />
      </div>
    </div>
  );
}
