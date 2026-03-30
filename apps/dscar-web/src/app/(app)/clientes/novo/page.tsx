"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCreateCustomer, ApiError } from "@/hooks/useCreateCustomer";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve ter 11 dígitos")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .min(10, "Telefone inválido")
    .regex(/^\d+$/, "Apenas números"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  lgpd_consent: z.literal(true, {
    errorMap: () => ({ message: "Consentimento LGPD obrigatório" }),
  }),
});

type FormData = z.infer<typeof schema>;

export default function NovoClientePage(): React.ReactElement {
  return (
    <ErrorBoundary>
      <NovoClienteContent />
    </ErrorBoundary>
  );
}

function NovoClienteContent(): React.ReactElement {
  const router = useRouter();
  const { mutateAsync, isPending } = useCreateCustomer();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      const result = await mutateAsync({
        name: data.name,
        cpf: data.cpf || undefined,
        phone: data.phone,
        email: data.email || undefined,
        lgpd_consent: true,
      });
      toast.success("Cliente cadastrado com sucesso");
      router.push(`/clientes/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const fieldMap: Record<string, keyof FormData> = {
          name: "name",
          cpf: "cpf",
          phone: "phone",
          email: "email",
          lgpd_consent: "lgpd_consent",
        };
        let hasFieldError = false;
        Object.entries(err.fieldErrors).forEach(([field, msgs]) => {
          const key = fieldMap[field];
          if (key) {
            setError(key, { message: msgs[0] });
            hasFieldError = true;
          }
        });
        if (!hasFieldError) {
          setError("root", { message: err.message });
        }
      } else if (err instanceof ApiError) {
        setError("root", { message: err.message });
      }
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <nav className="text-xs text-neutral-500 mb-0.5">
            <Link href="/clientes" className="hover:text-neutral-700">
              Clientes
            </Link>
            {" / "}
            <span className="text-neutral-700">Novo</span>
          </nav>
          <h2 className="text-2xl font-semibold text-neutral-900">
            Novo Cliente
          </h2>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nome <span className="text-error-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Nome completo"
                {...register("name")}
                className={errors.name ? "border-error-400" : ""}
              />
              {errors.name && (
                <p className="text-xs text-error-600">{errors.name.message}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Telefone <span className="text-error-500">*</span>
              </Label>
              <Input
                id="phone"
                placeholder="92991234567"
                inputMode="numeric"
                {...register("phone")}
                className={errors.phone ? "border-error-400" : ""}
              />
              {errors.phone && (
                <p className="text-xs text-error-600">{errors.phone.message}</p>
              )}
            </div>

            {/* CPF (opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF (opcional)</Label>
              <Input
                id="cpf"
                placeholder="00000000000"
                inputMode="numeric"
                maxLength={11}
                {...register("cpf")}
                className={errors.cpf ? "border-error-400" : ""}
              />
              {errors.cpf && (
                <p className="text-xs text-error-600">{errors.cpf.message}</p>
              )}
            </div>

            {/* E-mail (opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@email.com"
                {...register("email")}
                className={errors.email ? "border-error-400" : ""}
              />
              {errors.email && (
                <p className="text-xs text-error-600">{errors.email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LGPD */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <input
                id="lgpd_consent"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                {...register("lgpd_consent")}
              />
              <Label
                htmlFor="lgpd_consent"
                className="text-sm text-neutral-700 leading-snug cursor-pointer"
              >
                Autorizo o armazenamento e uso dos meus dados pessoais conforme
                a LGPD (Lei 13.709/2018).
              </Label>
            </div>
            {errors.lgpd_consent && (
              <p className="text-xs text-error-600 mt-2">
                {errors.lgpd_consent.message}
              </p>
            )}
          </CardContent>
        </Card>

        {errors.root && (
          <p className="text-sm text-error-600 text-center">
            {errors.root.message}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" asChild>
            <Link href="/clientes">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cadastrar Cliente
          </Button>
        </div>
      </form>
    </div>
  );
}
