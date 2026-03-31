"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Loader2, UserPlus, X, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { useCreateCustomer, ApiError } from "@/hooks/useCreateCustomer";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

const schema = z.object({
  customer_id: z.string().min(1, "Selecione um cliente"),
  plate: z
    .string()
    .min(7, "Placa inválida")
    .max(8, "Placa inválida")
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i, "Formato de placa inválido"),
  make: z.string().min(1, "Informe a marca"),
  model: z.string().min(1, "Informe o modelo"),
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
});

type FormData = z.infer<typeof schema>;

interface OSApiFieldError {
  [field: string]: string[];
}

interface NovaOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaOSModal({ open, onOpenChange }: NovaOSModalProps): React.ReactElement {
  const router = useRouter();

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Inline create state
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineName, setInlineName] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineCpf, setInlineCpf] = useState("");
  const [inlineLgpd, setInlineLgpd] = useState(false);
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutate: createCustomer, isPending: creatingCustomer } = useCreateCustomer();
  const debouncedSearch = useDebounce(customerSearch, 300);
  const { data: customersData, isFetching: fetchingCustomers } = useCustomers(debouncedSearch);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Reset tudo ao fechar
  useEffect(() => {
    if (!open) {
      reset();
      setCustomerSearch("");
      setSelectedCustomer(null);
      setShowDropdown(false);
      setShowInlineCreate(false);
      setInlineName("");
      setInlinePhone("");
      setInlineCpf("");
      setInlineLgpd(false);
      setInlineErrors({});
      setSubmitError("");
    }
  }, [open, reset]);

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setCustomerSearch(customer.name);
      setValue("customer_id", customer.id);
      setShowDropdown(false);
    },
    [setValue]
  );

  const handleInlineCreate = () => {
    const name = inlineName.trim();
    const errs: Record<string, string> = {};
    if (!name || name.length < 2) errs.name = "Nome obrigatório";
    if (!inlinePhone || inlinePhone.length < 10) errs.phone = "Telefone inválido";
    else if (!/^\d+$/.test(inlinePhone)) errs.phone = "Apenas números";
    if (!inlineLgpd) errs.lgpd_consent = "Consentimento LGPD obrigatório";
    if (Object.keys(errs).length > 0) { setInlineErrors(errs); return; }

    createCustomer(
      { name, phone: inlinePhone, cpf: inlineCpf || undefined, lgpd_consent: true },
      {
        onSuccess: (created) => {
          handleSelectCustomer({
            id: created.id,
            name: created.name,
            document_masked: created.cpf_masked ?? "",
            phone_masked: created.phone_masked,
          });
          setShowInlineCreate(false);
          setInlineName("");
          setInlinePhone("");
          setInlineCpf("");
          setInlineLgpd(false);
          setInlineErrors({});
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
  };

  const onSubmit = async (data: FormData): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
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
        onOpenChange(false);
        router.push(`/os/${os.id}`);
      } else {
        const errs = (await response.json()) as OSApiFieldError;
        let hasFieldError = false;
        Object.entries(errs).forEach(([field, msgs]) => {
          if (field === "customer_id" || field === "customer_name") {
            setError("customer_id", { message: msgs[0] });
            hasFieldError = true;
          } else if (field === "plate" || field === "make" || field === "model" || field === "year") {
            setError(field as keyof FormData, { message: msgs[0] });
            hasFieldError = true;
          }
        });
        if (!hasFieldError) setSubmitError("Erro ao criar OS. Tente novamente.");
      }
    } catch {
      setSubmitError("Erro de conexão. Verifique sua rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50">
              <ClipboardList className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Nova OS</h2>
              <p className="text-xs text-neutral-500">Abrir nova ordem de serviço</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-5 max-h-[60vh]">
          <form
            id="nova-os-form"
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            className="space-y-6"
          >
            {/* ─── Seção Cliente ─── */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-700 uppercase tracking-wide">
                Cliente <span className="text-error-500">*</span>
              </h3>

              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                  <Input
                    placeholder="Digite o nome ou documento..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setValue("customer_id", "");
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className={cn("pl-9", errors.customer_id && "border-error-400")}
                    autoComplete="off"
                  />
                  {fetchingCustomers && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-400" />
                  )}

                  {showDropdown && debouncedSearch.length >= 2 && !selectedCustomer && customersData && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg">
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
                            <span className="text-sm font-medium text-neutral-900">{customer.name}</span>
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
                  <div className="flex items-center justify-between rounded-md bg-success-50 border border-success-200 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-success-800">{selectedCustomer.name}</span>
                      <span className="text-success-600 ml-2">· {selectedCustomer.document_masked}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                        setValue("customer_id", "");
                      }}
                      className="text-success-600 hover:text-success-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline create */}
              {showInlineCreate && !selectedCustomer && (
                <div className="rounded-md border border-primary-200 bg-primary-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-primary-800 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Cadastrar novo cliente
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="il-name">Nome <span className="text-error-500">*</span></Label>
                      <Input
                        id="il-name"
                        value={inlineName}
                        onChange={(e) => { setInlineName(e.target.value); setInlineErrors((p) => ({ ...p, name: "" })); }}
                        placeholder="Nome completo"
                        className={cn("bg-white", inlineErrors.name && "border-error-400")}
                      />
                      {inlineErrors.name && <p className="text-xs text-error-600">{inlineErrors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="il-phone">Telefone <span className="text-error-500">*</span></Label>
                      <Input
                        id="il-phone"
                        value={inlinePhone}
                        onChange={(e) => { setInlinePhone(e.target.value); setInlineErrors((p) => ({ ...p, phone: "" })); }}
                        placeholder="92991234567"
                        inputMode="numeric"
                        className={cn("bg-white", inlineErrors.phone && "border-error-400")}
                      />
                      {inlineErrors.phone && <p className="text-xs text-error-600">{inlineErrors.phone}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="il-cpf">CPF <span className="text-neutral-400 text-xs">(opcional)</span></Label>
                    <Input
                      id="il-cpf"
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
                      id="il-lgpd"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      checked={inlineLgpd}
                      onChange={(e) => { setInlineLgpd(e.target.checked); setInlineErrors((p) => ({ ...p, lgpd_consent: "" })); }}
                    />
                    <Label htmlFor="il-lgpd" className="text-xs text-neutral-700 leading-snug cursor-pointer">
                      Autorizo o armazenamento conforme a LGPD. <span className="text-error-500">*</span>
                    </Label>
                  </div>
                  {inlineErrors.lgpd_consent && <p className="text-xs text-error-600">{inlineErrors.lgpd_consent}</p>}
                  {inlineErrors.general && <p className="text-xs text-error-600">{inlineErrors.general}</p>}

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => { setShowInlineCreate(false); setInlineErrors({}); }}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" disabled={creatingCustomer} onClick={handleInlineCreate}>
                      {creatingCustomer && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Cadastrar
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* ─── Seção Veículo ─── */}
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-neutral-700 uppercase tracking-wide">Veículo</h3>

              <div className="space-y-1.5">
                <Label htmlFor="os-plate">
                  Placa <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="os-plate"
                  placeholder="ABC1D23"
                  className={cn(
                    "uppercase font-mono tracking-widest",
                    errors.plate && "border-error-400"
                  )}
                  {...register("plate")}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    void register("plate").onChange(e);
                  }}
                />
                {errors.plate && <p className="text-xs text-error-600">{errors.plate.message}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="os-make">
                    Marca <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="os-make"
                    placeholder="Toyota"
                    {...register("make")}
                    className={cn(errors.make && "border-error-400")}
                  />
                  {errors.make && <p className="text-xs text-error-600">{errors.make.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="os-model">
                    Modelo <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="os-model"
                    placeholder="Corolla"
                    {...register("model")}
                    className={cn(errors.model && "border-error-400")}
                  />
                  {errors.model && <p className="text-xs text-error-600">{errors.model.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="os-year">Ano</Label>
                  <Input
                    id="os-year"
                    type="number"
                    placeholder={String(new Date().getFullYear())}
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    {...register("year")}
                  />
                  {errors.year && <p className="text-xs text-error-600">{errors.year.message}</p>}
                </div>
              </div>
            </section>

            {submitError && (
              <div className="rounded-md bg-error-50 border border-error-200 px-3 py-2 text-xs text-error-700">
                {submitError}
              </div>
            )}
          </form>
        </div>

        {/* Footer fixo */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="nova-os-form" disabled={isSubmitting || creatingCustomer}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Abrir OS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
