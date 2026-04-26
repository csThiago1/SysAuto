"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateCustomer, ApiError } from "@/hooks/useCreateCustomer";
import type { CreatedCustomer } from "@/hooks/useCreateCustomer";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  phone: z.string().min(10, "Telefone inválido").regex(/^\d+$/, "Apenas números"),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter 11 dígitos")
    .optional()
    .or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  lgpd_consent: z.literal(true, {
    errorMap: () => ({ message: "Consentimento LGPD obrigatório" }),
  }),
});

type FormData = z.infer<typeof schema>;

interface NovoClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (customer: CreatedCustomer) => void;
}

export function NovoClienteModal({
  open,
  onOpenChange,
  onSuccess,
}: NovoClienteModalProps): React.ReactElement {
  const { mutateAsync, isPending } = useCreateCustomer();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      const result = await mutateAsync({
        name: data.name,
        phone: data.phone,
        cpf: data.cpf || undefined,
        email: data.email || undefined,
        lgpd_consent: true,
      });
      toast.success(`Cliente ${result.name} cadastrado com sucesso!`);
      onSuccess?.(result);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const map: Record<string, keyof FormData> = {
          name: "name",
          phone: "phone",
          cpf: "cpf",
          email: "email",
          lgpd_consent: "lgpd_consent",
        };
        let hasField = false;
        Object.entries(err.fieldErrors).forEach(([f, msgs]) => {
          const key = map[f];
          if (key) { setError(key, { message: msgs[0] }); hasField = true; }
        });
        if (!hasField) setError("root", { message: err.message });
      } else {
        setError("root", { message: (err as Error).message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary-600" />
            Novo Cliente
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente. Campos com <span className="text-error-500">*</span> são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <form
          id="novo-cliente-form"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="mt-2 space-y-4"
        >
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">
              Nome <span className="text-error-500">*</span>
            </Label>
            <Input
              id="nc-name"
              placeholder="Nome completo"
              autoFocus
              {...register("name")}
              className={cn(errors.name && "border-error-400")}
            />
            {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-phone">
              Telefone <span className="text-error-500">*</span>
            </Label>
            <Input
              id="nc-phone"
              placeholder="92991234567"
              inputMode="numeric"
              {...register("phone")}
              className={cn(errors.phone && "border-error-400")}
            />
            {errors.phone && <p className="text-xs text-error-600">{errors.phone.message}</p>}
          </div>

          {/* CPF + Email em linha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-cpf">CPF <span className="text-white/30 text-xs">(opcional)</span></Label>
              <Input
                id="nc-cpf"
                placeholder="00000000000"
                inputMode="numeric"
                maxLength={11}
                {...register("cpf")}
                className={cn(errors.cpf && "border-error-400")}
              />
              {errors.cpf && <p className="text-xs text-error-600">{errors.cpf.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-email">E-mail <span className="text-white/30 text-xs">(opcional)</span></Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="cliente@email.com"
                {...register("email")}
                className={cn(errors.email && "border-error-400")}
              />
              {errors.email && <p className="text-xs text-error-600">{errors.email.message}</p>}
            </div>
          </div>

          {/* LGPD */}
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="flex items-start gap-2.5">
              <input
                id="nc-lgpd"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/20 text-primary-600 focus:ring-primary-500"
                {...register("lgpd_consent")}
              />
              <Label
                htmlFor="nc-lgpd"
                className="text-xs text-white/70 leading-relaxed cursor-pointer"
              >
                Autorizo o armazenamento e uso dos meus dados pessoais conforme a{" "}
                <strong>LGPD (Lei 13.709/2018)</strong>.{" "}
                <span className="text-error-500">*</span>
              </Label>
            </div>
            {errors.lgpd_consent && (
              <p className="text-xs text-error-600 mt-1.5 ml-6">{errors.lgpd_consent.message}</p>
            )}
          </div>

          {/* Erro geral */}
          {errors.root && (
            <div className="rounded-md bg-error-50 border border-error-200 px-3 py-2 text-xs text-error-700">
              {errors.root.message}
            </div>
          )}
        </form>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="novo-cliente-form"
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Cadastrar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
