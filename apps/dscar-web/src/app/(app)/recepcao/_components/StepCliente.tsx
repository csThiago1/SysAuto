"use client";

import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  CustomerSearch,
  type SelectedCustomer,
} from "../../os/[numero]/_components/shared/CustomerSearch";
import { InsurerSelect } from "../../os/[numero]/_components/shared/InsurerSelect";
import type { NewOSInput } from "../../os/_components/new-os.schema";
import { cn } from "@/lib/utils";

/** Passo 2 — cliente (busca ou quick-create) e tipo de atendimento. */
export function StepCliente(): React.ReactElement {
  const { watch, setValue, formState } = useFormContext<NewOSInput>();
  const customerType = watch("customer_type");
  const customerId = watch("customer_id");
  const customerName = watch("customer_name");

  const selected: SelectedCustomer | null =
    customerId && customerName ? { id: customerId, name: customerName } : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Tipo de atendimento</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "private", label: "Particular" },
              { value: "insurer", label: "Seguradora" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue("customer_type", opt.value, { shouldValidate: true })}
              className={cn(
                "rounded-[11px] px-3 py-2.5 text-sm font-medium",
                customerType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {customerType === "insurer" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Seguradora</Label>
            <InsurerSelect
              value={watch("insurer") ?? null}
              onChange={(id) => setValue("insurer", id, { shouldValidate: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Segurado</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "insured", label: "Segurado" },
                  { value: "third", label: "Terceiro" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setValue("insured_type", opt.value, { shouldValidate: true })
                  }
                  className={cn(
                    "rounded-[11px] px-3 py-2.5 text-sm font-medium",
                    watch("insured_type") === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {formState.errors.insurer && (
            <p className="text-xs text-error-400">{formState.errors.insurer.message}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <CustomerSearch
          value={selected}
          onChange={(c) => {
            setValue("customer_id", c?.id ?? null);
            setValue("customer_name", c?.name ?? "", { shouldValidate: true });
          }}
        />
        {formState.errors.customer_name && (
          <p className="text-xs text-error-400">
            {formState.errors.customer_name.message}
          </p>
        )}
      </div>
    </div>
  );
}
