"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Search, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { useCreateCustomer, ApiError } from "@/hooks/useCreateCustomer";
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

interface OSApiFieldError {
  [field: string]: string[];
}

export default function NovaOSPage(): React.ReactElement {
  return (
    <ErrorBoundary>
      <NovaOSContent />
    </ErrorBoundary>
  );
}

function NovaOSContent(): React.ReactElement {
  const router = useRouter();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineCpf, setInlineCpf] = useState("");
  const [inlineLgpd, setInlineLgpd] = useState(false);
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const { mutate: createCustomer, isPending: creatingCustomer } = useCreateCustomer();

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
          customer_id: data.customer_id,
          customer_name: selectedCustomer?.name ?? "",
          plate: data.plate.toUpperCase(),
          make: data.make,
          model: data.model,
          year: data.year ?? null,
        }),
      });

      if (response.ok) {
        const os = (await response.json()) as { id: string };
        router.push(`/os/${os.id}`);
      } else {
        const errs = (await response.json()) as OSApiFieldError;
        let hasFieldError = false;
        Object.entries(errs).forEach(([field, msgs]) => {
          if (
            field === "customer_id" ||
            field === "customer_name" ||
            field === "plate" ||
            field === "make" ||
            field === "model" ||
            field === "year"
          ) {
            const key = field === "customer_name" ? "customer_id" : (field as keyof NovaOSFormData);
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
                        <>
                          <div className="px-4 py-3 text-sm text-neutral-500">
                            Nenhum cliente encontrado
                          </div>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-primary-600 hover:bg-primary-50 border-t border-neutral-100 font-medium"
                            onClick={() => {
                              setInlineName(debouncedSearch);
                              setShowInlineCreate(true);
                              setShowDropdown(false);
                            }}
                          >
                            <UserPlus className="h-4 w-4" />
                            Cadastrar &quot;{debouncedSearch}&quot; como novo cliente
                          </button>
                        </>
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

            {/* Inline create form */}
            {showInlineCreate && !selectedCustomer && (
              <div className="rounded border border-primary-200 bg-primary-50 p-4 space-y-3">
                <p className="text-sm font-medium text-primary-800 flex items-center gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar novo cliente
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="inline-name">Nome</Label>
                  <Input
                    id="inline-name"
                    value={inlineName}
                    onChange={(e) => {
                      setInlineName(e.target.value);
                      if (inlineErrors.name) setInlineErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    placeholder="Nome completo"
                    className={cn("bg-white", inlineErrors.name ? "border-error-400" : "")}
                  />
                  {inlineErrors.name && (
                    <p className="text-xs text-error-600">{inlineErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inline-phone">Telefone</Label>
                  <Input
                    id="inline-phone"
                    value={inlinePhone}
                    onChange={(e) => {
                      setInlinePhone(e.target.value);
                      if (inlineErrors.phone) setInlineErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    placeholder="92991234567"
                    inputMode="numeric"
                    className={cn("bg-white", inlineErrors.phone ? "border-error-400" : "")}
                  />
                  {inlineErrors.phone && (
                    <p className="text-xs text-error-600">{inlineErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inline-cpf">CPF (opcional)</Label>
                  <Input
                    id="inline-cpf"
                    value={inlineCpf}
                    onChange={(e) => setInlineCpf(e.target.value)}
                    placeholder="00000000000"
                    inputMode="numeric"
                    maxLength={11}
                    className="bg-white"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <input
                    id="inline-lgpd"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    checked={inlineLgpd}
                    onChange={(e) => {
                      setInlineLgpd(e.target.checked);
                      if (inlineErrors.lgpd_consent) setInlineErrors((prev) => ({ ...prev, lgpd_consent: "" }));
                    }}
                  />
                  <Label
                    htmlFor="inline-lgpd"
                    className="text-xs text-neutral-700 leading-snug cursor-pointer"
                  >
                    Autorizo o armazenamento e uso dos meus dados pessoais
                    conforme a LGPD (Lei 13.709/2018).
                  </Label>
                </div>
                {inlineErrors.lgpd_consent && (
                  <p className="text-xs text-error-600">{inlineErrors.lgpd_consent}</p>
                )}

                {inlineErrors.general && (
                  <p className="text-xs text-error-600">{inlineErrors.general}</p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowInlineCreate(false);
                      setInlineErrors({});
                      setInlineName("");
                      setInlinePhone("");
                      setInlineCpf("");
                      setInlineLgpd(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={creatingCustomer}
                    onClick={() => {
                      const name = inlineName.trim();
                      const errs: Record<string, string> = {};
                      if (!name || name.length < 2) errs.name = "Nome obrigatório";
                      if (!inlinePhone || inlinePhone.length < 10) errs.phone = "Telefone inválido";
                      else if (!/^\d+$/.test(inlinePhone)) errs.phone = "Apenas números";
                      if (!inlineLgpd) errs.lgpd_consent = "Consentimento LGPD obrigatório";
                      if (Object.keys(errs).length > 0) {
                        setInlineErrors(errs);
                        return;
                      }
                      createCustomer(
                        {
                          name,
                          phone: inlinePhone,
                          cpf: inlineCpf || undefined,
                          lgpd_consent: true,
                        },
                        {
                          onSuccess: (created) => {
                            handleSelectCustomer({
                              id: created.id,
                              name: created.name,
                              document_masked: created.cpf_masked ?? "",
                              phone_masked: created.phone_masked,
                            });
                            setShowInlineCreate(false);
                            setInlineErrors({});
                            setInlineName("");
                            setInlinePhone("");
                            setInlineCpf("");
                            setInlineLgpd(false);
                          },
                          onError: (err) => {
                            if (err instanceof ApiError && err.fieldErrors) {
                              const mapped: Record<string, string> = {};
                              Object.entries(err.fieldErrors).forEach(([f, msgs]) => {
                                mapped[f] = msgs[0] ?? "";
                              });
                              setInlineErrors(mapped);
                            } else {
                              setInlineErrors({ general: (err as Error).message });
                            }
                          },
                        }
                      );
                    }}
                  >
                    {creatingCustomer && <Loader2 className="h-3 w-3 animate-spin" />}
                    Cadastrar
                  </Button>
                </div>
              </div>
            )}
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
