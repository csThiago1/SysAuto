import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleApiFormError } from "@/lib/api";

import { createOSSchema, type CreateOSFormData } from "./create-os.schema";
import { useCreateOS } from "./useCreateOS";
import { CustomerPicker } from "./CustomerPicker";
import { PlateInput } from "./PlateInput";
import { CiliaImportPanel } from "./CiliaImportPanel";

interface CreateOSFormProps {
  onSuccess?: (os: { id: string; number: number }) => void;
  onCancel?: () => void;
}

export function CreateOSForm({ onSuccess, onCancel }: CreateOSFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { mutate: createOS, isPending } = useCreateOS();

  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    setError,
    formState: { errors },
  } = useForm<CreateOSFormData>({
    resolver: zodResolver(createOSSchema),
    defaultValues: {
      customer_id: 0,
      plate: "",
      make: "",
      model: "",
      color: "",
      year: new Date().getFullYear(),
      description: "",
    },
  });

  const nextStep = async (targetStep: 1 | 2 | 3) => {
    // Validate current step before advancing
    let valid = true;
    if (step === 1) {
      valid = await trigger("customer_id");
    } else if (step === 2) {
      valid = await trigger(["plate", "make", "model", "year", "color"]);
    }
    if (valid) setStep(targetStep);
  };

  const onSubmit = (data: CreateOSFormData) => {
    createOS({
       ...data,
       customer_name: "", // handled in backend ideally or we pass it
    }, {
      onSuccess: (res) => {
        toast.success(`OS #${res.number} criada com sucesso!`);
        onSuccess?.(res);
      },
      onError: (err) => {
        handleApiFormError(err, setError);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between relative px-2">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-neutral-100 -z-10 -translate-y-1/2">
          <div 
            className="h-full bg-primary-500 transition-all duration-300" 
            style={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
          />
        </div>
        
        {[
          { num: 1, label: "Cliente" },
          { num: 2, label: "Veículo" },
          { num: 3, label: "Serviço" }
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div key={s.num} className="flex flex-col items-center gap-2 bg-white px-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                isActive ? "border-primary-600 bg-primary-600 text-white" :
                isDone ? "border-primary-500 bg-primary-100 text-primary-700" :
                "border-neutral-200 bg-white text-neutral-400"
              )}>
                {s.num}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-primary-700" : isDone ? "text-primary-600" : "text-neutral-500"
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <form id="create-os-form" onSubmit={handleSubmit(onSubmit)} className="min-h-[300px]">
        {/* STEP 1: Cliente */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-1.5">
              <Label>Cliente da OS <span className="text-error-500">*</span></Label>
              <Controller
                control={control}
                name="customer_id"
                render={({ field }) => (
                  <CustomerPicker 
                    value={field.value} 
                    onChange={field.onChange} 
                    error={errors.customer_id?.message}
                  />
                )}
              />
            </div>
            
            <div className="pt-4 border-t border-neutral-100">
              <CiliaImportPanel 
                onImportSuccess={(data) => {
                  if (data.plate) setValue("plate", data.plate, { shouldValidate: true });
                  if (data.make) setValue("make", data.make, { shouldValidate: true });
                  if (data.model) setValue("model", data.model, { shouldValidate: true });
                  if (data.color) setValue("color", data.color);
                  if (data.year) setValue("year", data.year, { shouldValidate: true });
                  
                  toast.info(`Veículo ${data.make} ${data.model} importado. Selecione o cliente!`);
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 2: Veículo */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-1.5">
              <Label>Placa <span className="text-error-500">*</span></Label>
              <Controller
                control={control}
                name="plate"
                render={({ field }) => (
                  <PlateInput
                    value={field.value}
                    onValueChange={field.onChange}
                    error={errors.plate?.message}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <Label>Marca <span className="text-error-500">*</span></Label>
                 <Input {...register("make")} placeholder="Ex: Toyota" className={cn(errors.make && "border-error-400")} />
                 {errors.make && <p className="text-xs text-error-600">{errors.make.message}</p>}
              </div>
              <div className="space-y-1.5">
                 <Label>Modelo <span className="text-error-500">*</span></Label>
                 <Input {...register("model")} placeholder="Ex: Corolla" className={cn(errors.model && "border-error-400")} />
                 {errors.model && <p className="text-xs text-error-600">{errors.model.message}</p>}
              </div>
              <div className="space-y-1.5">
                 <Label>Cor</Label>
                 <Input {...register("color")} placeholder="Ex: Prata" />
              </div>
              <div className="space-y-1.5">
                 <Label>Ano <span className="text-error-500">*</span></Label>
                 <Input 
                   type="number" 
                   {...register("year", { valueAsNumber: true })} 
                   className={cn(errors.year && "border-error-400")} 
                 />
                 {errors.year && <p className="text-xs text-error-600">{errors.year.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Serviço */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
             <div className="space-y-1.5">
               <Label>Descrição Inicial (Opcional)</Label>
               <Textarea 
                 {...register("description")} 
                 className="min-h-32 resize-none" 
                 placeholder="Descreva o problema relatado pelo cliente ou observações ao receber o veículo..."
               />
             </div>
          </div>
        )}
      </form>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center pt-4 border-t border-neutral-100">
        {step > 1 ? (
          <Button variant="outline" type="button" onClick={() => setStep((s) => (s - 1) as 1|2)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        ) : (
          <Button variant="ghost" type="button" onClick={onCancel} className="text-neutral-500">
            Cancelar
          </Button>
        )}

        {step < 3 ? (
          <Button type="button" onClick={() => nextStep((step + 1) as 2|3)}>
            Próximo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" form="create-os-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Concluir e Abrir OS
          </Button>
        )}
      </div>
    </div>
  );
}
