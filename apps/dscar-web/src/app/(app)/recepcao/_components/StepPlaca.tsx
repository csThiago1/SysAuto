"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePlateLookup } from "../../os/[numero]/_hooks/useVehicleCatalog";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { VehicleFipeFields } from "@/components/vehicle/VehicleFipeFields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewOSInput } from "../../os/_components/new-os.schema";
import { formatPlate } from "@paddock/utils"

const TERMINAL_STATUS = new Set(["delivered", "cancelled"]);

const FUEL_TYPE_PT: Record<string, string> = {
  gasoline: "Gasolina", Gasoline: "Gasolina",
  ethanol: "Etanol", Ethanol: "Etanol",
  diesel: "Diesel", Diesel: "Diesel",
  flex: "Flex", Flex: "Flex",
  electric: "Elétrico", Electric: "Elétrico",
  hybrid: "Híbrido", Hybrid: "Híbrido",
  gas: "GNV", Gas: "GNV",
};

/** Passo 1 — placa com consulta automática e fallback FIPE manual. */
export function StepPlaca(): React.ReactElement {
  const { watch, setValue, formState } = useFormContext<NewOSInput>();
  const [plateQuery, setPlateQuery] = useState("");
  const plate = watch("plate");
  const make = watch("make");
  const model = watch("model");

  const { data: plateData, isFetching, isError } = usePlateLookup(plateQuery);

  // OS aberta com a mesma placa → aviso com link
  const dup = useServiceOrders({ search: plate ?? "" }, 1, 5, (plate ?? "").length >= 7);
  const osAberta = (dup.data?.results ?? []).find(
    (os) => os.plate === plate && !TERMINAL_STATUS.has(os.status)
  );

  useEffect(() => {
    if (!plateData || isFetching) return;
    if (!watch("make") && plateData.make) {
      setValue("make", plateData.make, { shouldValidate: true });
      setValue("model", plateData.model ?? "", { shouldValidate: true });
      if (plateData.year) setValue("year", plateData.year);
      if (plateData.version) setValue("vehicle_version", plateData.version);
      if (plateData.color) setValue("color", plateData.color);
      if (plateData.fuel_type)
        setValue("fuel_type", FUEL_TYPE_PT[plateData.fuel_type] ?? plateData.fuel_type);
      if (plateData.chassis && !plateData.chassis.includes("*")) {
        setValue("chassis", plateData.chassis);
      }
      toast.success("Dados do veículo preenchidos pela placa.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, isFetching]);

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    setValue("plate", val, { shouldValidate: true });
    if (val.length >= 7) setPlateQuery(val);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="rec-plate">Placa</Label>
        <div className="relative">
          <Input
            id="rec-plate"
            value={formatPlate(plate ?? "")}
            onChange={handlePlateChange}
            placeholder="ABC-1D23"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono text-lg tracking-widest"
            inputMode="text"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {formState.errors.plate && (
          <p className="text-xs text-error-400">{formState.errors.plate.message}</p>
        )}
        {isError && plateQuery && (
          <p className="text-xs text-muted-foreground">
            Placa não encontrada — preencha o veículo manualmente.
          </p>
        )}
      </div>

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

      <VehicleFipeFields
        allowFreeText
        initialMake={make}
        initialModel={model}
        initialYear={watch("year") ?? null}
        initialVersion={watch("vehicle_version")}
        initialFuelType={watch("fuel_type")}
        onFieldChange={(fields) => {
          setValue("make", fields.make, { shouldValidate: true });
          setValue("model", fields.model, { shouldValidate: true });
          if (fields.vehicle_version !== undefined)
            setValue("vehicle_version", fields.vehicle_version);
          if (fields.year !== undefined) setValue("year", fields.year);
          if (fields.fuel_type !== undefined) setValue("fuel_type", fields.fuel_type);
        }}
      />
      {(formState.errors.make || formState.errors.model) && (
        <p className="text-xs text-error-400">
          {formState.errors.make?.message ?? formState.errors.model?.message}
        </p>
      )}
    </div>
  );
}
