"use client";

import { useEffect, useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker";
import {
  ChassiHint,
  RestricaoAlert,
  SinespHint,
  keepYearManufacture,
  placaPrefill,
  useVehicleLookup,
} from "@/components/vehicle/PlacaLookup";
import { applyIfEmpty } from "@/lib/prefill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorSelect } from "../../os/[numero]/_components/shared/ColorSelect";
import type { NewOSInput } from "../../os/_components/new-os.schema";

const TERMINAL_STATUS = new Set(["delivered", "cancelled"]);

interface StepPlacaProps {
  /** Carro conhecido (veículo e cliente vieram da última OS): pula direto para confirmar. */
  onAbrirDireto?: () => void;
}

/** Passo 1 — placa (consulta no blur ou no botão) e veículo pelo seletor do catálogo. */
export function StepPlaca({ onAbrirDireto }: StepPlacaProps): React.ReactElement {
  const form = useFormContext<NewOSInput>();
  const { watch, setValue, control, formState } = form;
  const plate = watch("plate");

  const placa = useVehicleLookup("placa", (fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")));
    toast.success("Dados do veículo preenchidos pela placa.");
  });
  const chassiLookup = useVehicleLookup("chassi", (fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")));
    toast.success("Dados do veículo preenchidos pelo chassi.");
  });
  const chassis = watch("chassis");

  // OS aberta com a mesma placa → aviso com link
  const dup = useServiceOrders({ search: plate ?? "" }, 1, 5, (plate ?? "").length >= 7);
  const osAberta = (dup.data?.results ?? []).find(
    (os) => os.plate === plate && !TERMINAL_STATUS.has(os.status)
  );

  // Carro que já passou aqui: o cliente da última OS da placa vem preenchido (só se vazio)
  const ultima = (dup.data?.results ?? []).find(
    (os) => os.plate === plate && os.customer_person_id != null
  );
  const preenchido = useRef<{ plate: string; id: number } | null>(null);
  useEffect(() => {
    // Placa corrigida: o cliente que a placa anterior trouxe sai (se ninguém trocou à mão)
    const antes = preenchido.current;
    if (antes && antes.plate !== plate && form.getValues("customer_id") === antes.id) {
      setValue("customer_id", null);
      setValue("customer_name", "");
      preenchido.current = null;
    }
    if (!ultima?.customer_person_id || form.getValues("customer_id")) return;
    setValue("customer_id", ultima.customer_person_id);
    setValue("customer_name", ultima.customer_name);
    preenchido.current = { plate: plate ?? "", id: ultima.customer_person_id };
    toast.info(`Cliente da última OS: ${ultima.customer_name}`);
  }, [plate, ultima?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carro que já passou aqui: a consulta veio das OS (source "os") e o cliente da última OS entrou.
  const selection = watch("catalog_selection");
  const customerName = watch("customer_name");
  const conhecido =
    placa.result?.found === true &&
    placa.result.source === "os" &&
    selection?.family != null &&
    !!watch("customer_id") &&
    !osAberta;

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    setValue("plate", val, { shouldValidate: true });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="rec-plate" className="label-mono">Placa</Label>
        {/* A placa é desenhada como placa Mercosul: o campo É a placa. */}
        <div className="relative overflow-hidden rounded-md border-[3px] border-white bg-white focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background">
          <span aria-hidden className="flex h-4 items-center justify-center bg-[#1d3a8a] text-[9px] font-bold tracking-[0.3em] text-white">
            BRASIL
          </span>
          <input
            id="rec-plate"
            value={plate ?? ""}
            onChange={handlePlateChange}
            onBlur={() => placa.lookup(plate)}
            placeholder="Digite a placa"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            aria-invalid={formState.errors.plate ? true : undefined}
            className="block h-16 w-full bg-white text-center font-plate text-[44px] font-bold uppercase tracking-[0.08em] text-neutral-950 outline-none placeholder:font-sans placeholder:text-lg placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-500"
          />
          {placa.isFetching && (
            <Loader2 className="absolute bottom-5 right-3 h-5 w-5 animate-spin text-neutral-500" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={placa.isFetching || (plate ?? "").length < 7}
          onClick={() => placa.lookup(plate)}
        >
          {placa.isFetching ? "Consultando…" : "Consultar placa"}
        </Button>
        {formState.errors.plate && (
          <p className="text-xs text-error-400">{formState.errors.plate.message}</p>
        )}
        {placa.notFound && (
          <p className="text-xs text-muted-foreground">
            Placa não encontrada — escolha o veículo na lista.
          </p>
        )}
      </div>

      {conhecido && selection && (
        <div className="space-y-3 border-y border-border py-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
            <Check className="row-span-2 h-8 w-8 text-success-500" strokeWidth={3} aria-hidden />
            <p className="font-cond text-[22px] font-bold uppercase leading-tight">
              {selection.make.label} {selection.family?.label}
            </p>
            <p className="text-sm text-muted-foreground">
              Já veio{ultima ? ` na OS #${ultima.number}` : ""} · {customerName}
            </p>
          </div>
          <Button type="button" size="lg" className="w-full" onClick={onAbrirDireto}>
            Abrir OS para este carro
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ou confira os dados abaixo e siga pelos passos.
          </p>
        </div>
      )}

      <RestricaoAlert restricao={placa.result?.fields.restricao} />

      <SinespHint searched={placa.searched} />

      <div className="space-y-1.5">
        <Label htmlFor="rec-chassis">Chassi (opcional)</Label>
        <div className="relative">
          <Input
            id="rec-chassis"
            value={chassis ?? ""}
            onChange={(e) =>
              setValue("chassis", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
            }
            onBlur={() => chassiLookup.lookup(chassis)}
            placeholder="17 caracteres"
            maxLength={17}
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono tracking-widest"
          />
          {chassiLookup.isFetching && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {chassiLookup.notFound && (
          <p className="text-xs text-muted-foreground">
            Chassi não encontrado — escolha o veículo na lista.
          </p>
        )}
        <ChassiHint result={chassiLookup.result} />
      </div>

      {osAberta && (
        <Link
          href={`/os/${osAberta.number}`}
          className="flex items-start gap-2 rounded-md bg-warning-500/10 px-3 py-2.5 text-sm text-warning-400"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Já existe a OS <span className="font-mono">{osAberta.number}</span> aberta para
            esta placa. Abrir a OS.
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
              setValue(
                "year_manufacture",
                keepYearManufacture(field.value, sel, form.getValues("year_manufacture")),
              );
              field.onChange(sel);
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
