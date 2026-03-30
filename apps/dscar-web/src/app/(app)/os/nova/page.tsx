"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

const novaOSSchema = z.object({
  customer_id: z.string().min(1, "Selecione um cliente"),
  plate: z
    .string()
    .min(7, "Placa inválida")
    .max(8, "Placa inválida")
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i, "Formato de placa inválido"),
  make: z.string().min(1, "Informe a marca do veículo"),
  model: z.string().min(1, "Informe o modelo do veículo"),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  description: z.string().optional(),
});

type NovaOSFormData = z.infer<typeof novaOSSchema>;

interface ApiError {
  [field: string]: string[];
}

export default function NovaOSPage(): React.ReactElement {
  const router = useRouter();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const debouncedSearch = useDebounce(customerSearch, 300);
  const { data: customersData, isFetching: fetchingCustomers } =
    useCustomers(debouncedSearch);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NovaOSFormData>({
    resolver: zodResolver(novaOSSchema),
  });

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setCustomerSearch(customer.name);
      setValue("customer_id", customer.id);
      setShowDropdown(false);
    },
    [setValue]
  );

  const onSubmit = async (data: NovaOSFormData): Promise<void> => {
    setSubmitError("");
    try {
      const response = await fetch("/api/proxy/service-orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: data.customer_id,
          plate: data.plate.toUpperCase(),
          make: data.make,
          model: data.model,
          year: data.year ?? null,
          description: data.description ?? "",
        }),
      });

      if (response.ok) {
        const os = (await response.json()) as { id: string };
        router.push(`/os/${os.id}`);
      } else {
        const errs = (await response.json()) as ApiError;
        let hasFieldError = false;
        Object.entries(errs).forEach(([field, msgs]) => {
          if (
            field === "customer" ||
            field === "plate" ||
            field === "make" ||
            field === "model" ||
            field === "year" ||
            field === "description"
          ) {
            const key =
              field === "customer" ? "customer_id" : (field as keyof NovaOSFormData);
            setError(key, { message: msgs[0] });
            hasFieldError = true;
          }
        });
        if (!hasFieldError) {
          setSubmitError("Erro ao criar OS. Tente novamente.");
        }
      }
    } catch {
      setSubmitError("Erro de conexão. Verifique sua rede e tente novamente.");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/os">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Nova OS</h2>
          <p className="text-sm text-neutral-500">Abrir nova ordem de serviço</p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6">
        {/* Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-search">Buscar cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                <Input
                  id="customer-search"
                  placeholder="Digite o nome ou documento..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomer(null);
                    setValue("customer_id", "");
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="pl-9"
                  autoComplete="off"
                />
                {fetchingCustomers && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
                )}

                {/* Customer dropdown */}
                {showDropdown &&
                  debouncedSearch.length >= 2 &&
                  !selectedCustomer &&
                  customersData && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded border border-neutral-200 bg-white shadow-dropdown">
                      {customersData.results.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-neutral-500">
                          Nenhum cliente encontrado
                        </div>
                      ) : (
                        customersData.results.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-neutral-50 transition-colors"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <span className="text-sm font-medium text-neutral-900">
                              {customer.name}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {customer.document_masked} · {customer.phone_masked}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
              </div>
              {errors.customer_id && (
                <p className="text-xs text-error-600">{errors.customer_id.message}</p>
              )}
              {selectedCustomer && (
                <div className="flex items-center gap-2 rounded bg-success-50 border border-success-200 px-3 py-2 text-sm text-success-800">
                  <span className="font-medium">{selectedCustomer.name}</span>
                  <span className="text-success-600">
                    · {selectedCustomer.document_masked}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Veículo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plate">Placa</Label>
              <Input
                id="plate"
                placeholder="ABC1D23"
                className={cn(
                  "text-plate uppercase font-plate tracking-widest",
                  errors.plate && "border-error-400 focus-visible:ring-error-400"
                )}
                {...register("plate")}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("plate").onChange(e);
                }}
              />
              {errors.plate && (
                <p className="text-xs text-error-600">{errors.plate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="make">Marca</Label>
                <Input
                  id="make"
                  placeholder="Toyota"
                  {...register("make")}
                  className={errors.make ? "border-error-400" : ""}
                />
                {errors.make && (
                  <p className="text-xs text-error-600">{errors.make.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  placeholder="Corolla"
                  {...register("model")}
                  className={errors.model ? "border-error-400" : ""}
                />
                {errors.model && (
                  <p className="text-xs text-error-600">{errors.model.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="year">Ano (opcional)</Label>
              <Input
                id="year"
                type="number"
                placeholder={String(new Date().getFullYear())}
                min={1900}
                max={new Date().getFullYear() + 1}
                {...register("year")}
              />
              {errors.year && (
                <p className="text-xs text-error-600">{errors.year.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Descrição */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descrição do Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className={cn(
                "flex min-h-24 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm",
                "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                "disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              )}
              placeholder="Descreva o serviço a ser realizado..."
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-error-600 mt-1">
                {errors.description.message}
              </p>
            )}
          </CardContent>
        </Card>

        {submitError && (
          <p className="text-sm text-error-600 text-center">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" asChild>
            <Link href="/os">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Abrir OS
          </Button>
        </div>
      </form>
    </div>
  );
}
