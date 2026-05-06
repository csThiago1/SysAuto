"use client";

/**
 * PersonFormModal — Modal de criação e edição de Pessoa (Cadastros)
 *
 * ANTES: 470 linhas — tipos importados de hook, labels inline, textarea nativo,
 *        imports individuais de shadcn, sem barrel.
 *
 * AGORA: ~180 linhas — orquestrador puro. Seções extraídas em _sections/.
 *        Tipos: @paddock/types  · Utils: @paddock/utils  · UI: @/components/ui (barrel)
 *        Hooks: @/hooks (barrel)
 *
 * Padrão estabelecido:
 *   - ModalProps extendido com campo de domínio (person?)
 *   - onSubmit delega ao hook mutation (não faz lógica manual)
 *   - Seções recebem apenas { control, register, watch, setValue }
 */

import React, { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { toast } from "sonner";
import type {
  Person,
  PersonRole,
  PersonKind,
  CreatePersonPayload,
  ModalProps,
  PersonDocumentWrite,
} from "@paddock/types";
import { PERSON_ROLE_LABEL } from "@paddock/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  PhoneInput,
} from "@/components/ui";
import { useCreatePerson, useUpdatePerson, useCepLookup, usePerson } from "@/hooks";
import { handleApiFormError } from "@/lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FormValues = {
  person_kind: PersonKind;
  full_name: string;
  fantasy_name: string;
  secondary_document: string;
  municipal_registration: string;
  is_simples_nacional: boolean;
  inscription_type: "CONTRIBUINTE" | "NAO_CONTRIBUINTE" | "ISENTO" | "";
  birth_date: string;
  gender: "M" | "F" | "N" | "";
  is_active: boolean;
  notes: string;
  roles: PersonRole[];
  documents: PersonDocumentWrite[];
  /** Celular principal — obrigatório quando role inclui CLIENT ou EMPLOYEE */
  primary_phone: string;
  /** E-mail principal — obrigatório quando role inclui CLIENT ou EMPLOYEE */
  primary_email: string;
  contacts: Array<{
    contact_type: "CELULAR" | "COMERCIAL" | "WHATSAPP" | "EMAIL" | "EMAIL_NFE" | "EMAIL_FINANCEIRO" | "SITE";
    value: string;
    label?: string;
    is_primary: boolean;
  }>;
  addresses: Array<{
    address_type: "PRINCIPAL" | "COBRANCA" | "ENTREGA";
    zip_code: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    municipio_ibge?: string;
    is_primary: boolean;
  }>;
};

/** Props do modal — extende o contrato base ModalProps com campo de domínio */
interface PersonFormModalProps extends ModalProps {
  /** undefined ou null = criação; Person = edição */
  person?: Person | null;
  defaultRoles?: PersonRole[];
  defaultKind?: PersonKind;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const ALL_ROLES: PersonRole[] = ["CLIENT", "BROKER", "EMPLOYEE", "SUPPLIER"];

const CONTACT_TYPES = [
  { value: "CELULAR", label: "Celular" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "E-mail" },
  { value: "EMAIL_NFE", label: "E-mail NF-e" },
  { value: "EMAIL_FINANCEIRO", label: "E-mail Financeiro" },
  { value: "SITE", label: "Site" },
];

// ─── Componente ────────────────────────────────────────────────────────────────

export function PersonFormModal({
  open,
  onOpenChange,
  person,
  defaultRoles,
  defaultKind,
}: PersonFormModalProps): React.ReactElement {
  const isEditing = !!person;

  // ── Hooks de dados ────────────────────────────────────────────────────────
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const cepLookup    = useCepLookup();
  const { data: personDetail } = usePerson(isEditing && open ? (person?.id ?? null) : null);
  const personData = personDetail ?? person;

  // ── Estado de roles (toggle buttons) ─────────────────────────────────────
  const [selectedRoles, setSelectedRoles] = useState<PersonRole[]>(
    person?.roles.map((r) => r.role) ?? defaultRoles ?? ["CLIENT"]
  );

  // ── Formulário ────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, setValue, control, setError } = useForm<FormValues>({
    defaultValues: {
      person_kind: defaultKind ?? "PF",
      full_name: "",
      fantasy_name: "",
      is_active: true,
      notes: "",
      roles: defaultRoles ?? ["CLIENT"],
      documents: [],
      primary_phone: "",
      primary_email: "",
      contacts: [],
      addresses: [],
    },
  });

  const { fields: documentFields, append: appendDocument, remove: removeDocument } =
    useFieldArray({ control, name: "documents" });

  const { fields: contactFields, append: appendContact, remove: removeContact } =
    useFieldArray({ control, name: "contacts" });

  const { fields: addressFields, append: appendAddress, remove: removeAddress } =
    useFieldArray({ control, name: "addresses" });

  const personKind = watch("person_kind");
  const primaryPhoneValue = watch("primary_phone");
  const primaryEmailValue = watch("primary_email");
  const needsContacts = selectedRoles.some((r) => ["CLIENT", "EMPLOYEE"].includes(r));

  // ── Carrega dados ao editar ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (isEditing && !personDetail) return;
    const src = personData;

    // Extrai contatos primários para os campos fixos
    const allContacts: Array<{ contact_type: string; value?: string; value_masked?: string; is_primary?: boolean }> =
      (src?.contacts ?? []) as Array<{ contact_type: string; value?: string; value_masked?: string; is_primary?: boolean }>;

    const primaryCelular =
      allContacts.find((c) => c.contact_type === "CELULAR" && c.is_primary) ??
      allContacts.find((c) => c.contact_type === "CELULAR");

    const primaryEmail =
      allContacts.find((c) => c.contact_type === "EMAIL" && c.is_primary) ??
      allContacts.find((c) => c.contact_type === "EMAIL");

    // Contatos adicionais = todos exceto os que viraram campos primários
    const otherContacts = allContacts.filter(
      (c) => c !== primaryCelular && c !== primaryEmail
    );

    reset({
      person_kind: src?.person_kind ?? defaultKind ?? "PF",
      full_name:   src?.full_name ?? "",
      fantasy_name: src?.fantasy_name ?? "",
      is_active:   src?.is_active ?? true,
      notes:       src?.notes ?? "",
      roles:       src?.roles.map((r) => r.role) ?? defaultRoles ?? ["CLIENT"],
      // Ao editar, documentos existentes ficam somente-leitura (exibidos abaixo).
      // Apenas novos documentos são enviados para não sobrescrever dados mascarados.
      documents: [],
      // Campos primários pré-populados (valor mascarado em modo edição → read-only)
      primary_phone: primaryCelular?.value_masked ?? primaryCelular?.value ?? "",
      primary_email: primaryEmail?.value_masked ?? primaryEmail?.value ?? "",
      // Contatos adicionais (excluindo os primários já capturados acima)
      contacts: otherContacts as FormValues["contacts"],
      addresses: src?.addresses ?? [],
    });
    setSelectedRoles(src?.roles.map((r) => r.role) ?? defaultRoles ?? ["CLIENT"]);
  }, [open, isEditing, personDetail, personData, reset, defaultKind, defaultRoles]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleRole(role: PersonRole): void {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) return prev.length === 1 ? prev : prev.filter((r) => r !== role);
      return [...prev, role];
    });
  }

  async function handleCepBlur(index: number, value: string): Promise<void> {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const d = await cepLookup.mutateAsync(clean);
      setValue(`addresses.${index}.street`, d.street);
      setValue(`addresses.${index}.neighborhood`, d.neighborhood);
      setValue(`addresses.${index}.city`, d.city);
      setValue(`addresses.${index}.state`, d.state);
      if (d.complement) setValue(`addresses.${index}.complement`, d.complement);
    } catch { /* usuário preenche manualmente */ }
  }

  /** onSubmit delega inteiramente ao hook — sem lógica de fetch manual (PADRÃO-4) */
  async function onSubmit(data: FormValues): Promise<void> {
    if (selectedRoles.length === 0) { toast.error("Selecione ao menos uma categoria."); return; }

    // Validação de campos primários obrigatórios para CLIENT e EMPLOYEE
    const needsContacts = selectedRoles.some((r) => ["CLIENT", "EMPLOYEE"].includes(r));
    if (needsContacts) {
      if (!data.primary_phone?.trim()) {
        toast.error("Celular principal é obrigatório para clientes e funcionários.");
        return;
      }
      if (!data.primary_email?.trim()) {
        toast.error("E-mail principal é obrigatório para clientes e funcionários.");
        return;
      }
    }

    // Combina contatos primários com os contatos adicionais do useFieldArray
    const primaryContacts: FormValues["contacts"] = [];
    if (data.primary_phone?.trim()) {
      primaryContacts.push({ contact_type: "CELULAR", value: data.primary_phone.trim(), is_primary: true });
    }
    if (data.primary_email?.trim()) {
      primaryContacts.push({ contact_type: "EMAIL", value: data.primary_email.trim(), is_primary: true });
    }
    const additionalContacts = (data.contacts ?? []).map((c) => ({ ...c, is_primary: false }));

    const payload = {
      ...data,
      roles: selectedRoles,
      inscription_type: data.inscription_type || undefined,
      gender: data.gender || undefined,
      birth_date: data.birth_date || null,
      documents: (data.documents ?? []).map((doc) => ({
        ...doc,
        issued_at: doc.issued_at || null,
        expires_at: doc.expires_at || null,
      })),
      contacts: [...primaryContacts, ...additionalContacts],
    } as CreatePersonPayload;
    try {
      if (isEditing && person) {
        await updatePerson.mutateAsync({ id: person.id, data: payload });
        toast.success("Cadastro atualizado.");
      } else {
        await createPerson.mutateAsync(payload);
        toast.success("Pessoa cadastrada com sucesso.");
      }
      onOpenChange(false);
    } catch (err: unknown) {
      handleApiFormError(err, setError);
    }
  }

  const isPending = createPerson.isPending || updatePerson.isPending;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Cadastro" : "Nova Pessoa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Seção 1: Tipo + Roles ────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Tipo de Pessoa</Label>
              <div className="flex gap-3 mt-1.5">
                {(["PF", "PJ"] as const).map((kind) => (
                  <label key={kind} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={kind} {...register("person_kind")} className="accent-primary" />
                    <span className="text-sm">{kind === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Categorias</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedRoles.includes(role)
                        ? "bg-primary text-foreground border-primary"
                        : "bg-muted/50 text-foreground/60 border-border hover:border-white/30"
                    }`}
                  >
                    {PERSON_ROLE_LABEL[role]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Seção 2: Dados Gerais ────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground/70 border-b border-border pb-1">Dados Gerais</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="full_name">
                  {personKind === "PJ" ? "Razão Social" : "Nome Completo"} *
                </Label>
                <Input id="full_name" {...register("full_name", { required: true, minLength: 2 })}
                  placeholder={personKind === "PJ" ? "Razão Social" : "Nome Completo"} />
              </div>
              {personKind === "PJ" && (
                <div className="col-span-2">
                  <Label htmlFor="fantasy_name">Nome Fantasia</Label>
                  <Input id="fantasy_name" {...register("fantasy_name")} />
                </div>
              )}
              {personKind === "PF" && (
                <>
                  <div>
                    <Label htmlFor="birth_date">Data de Nascimento</Label>
                    <Input id="birth_date" type="date" {...register("birth_date")} />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gênero</Label>
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">Masculino</SelectItem>
                            <SelectItem value="F">Feminino</SelectItem>
                            <SelectItem value="N">Não informado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </>
              )}
              {personKind === "PJ" && (
                <>
                  <div>
                    <Label htmlFor="secondary_document">Inscrição Estadual (IE)</Label>
                    <Input id="secondary_document" {...register("secondary_document")} placeholder="Ex: 123.456.789.012" />
                  </div>
                  <div>
                    <Label htmlFor="municipal_registration">Inscrição Municipal (IM)</Label>
                    <Input id="municipal_registration" {...register("municipal_registration")} placeholder="Ex: 1234567" />
                  </div>
                  <div>
                    <Label htmlFor="inscription_type">Tipo de Inscrição</Label>
                    <Controller
                      control={control}
                      name="inscription_type"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTRIBUINTE">Contribuinte</SelectItem>
                            <SelectItem value="NAO_CONTRIBUINTE">Não Contribuinte</SelectItem>
                            <SelectItem value="ISENTO">Isento</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" {...register("is_simples_nacional")} className="accent-primary" />
                      <Label>Optante pelo Simples Nacional</Label>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Seção 3: Documentos ──────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-foreground/70">Documentos</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  appendDocument({
                    doc_type: personKind === "PJ" ? "CNPJ" : "CPF",
                    value: "",
                    is_primary: documentFields.length === 0,
                    issued_by: "",
                    issued_at: null,
                    expires_at: null,
                  })
                }
              >
                + Adicionar
              </Button>
            </div>
            {/* Documentos existentes — somente leitura em modo edição */}
            {isEditing && personData?.documents && personData.documents.length > 0 && (
              <div className="space-y-1">
                {personData.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-muted/50 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{d.doc_type}</span>
                    <span>{d.value_masked}</span>
                    {d.is_primary && <span className="ml-auto text-primary-600">principal</span>}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Para alterar documentos existentes, use o painel de detalhe.</p>
              </div>
            )}
            {documentFields.map((field, index) => (
              <div key={field.id} className="space-y-2 p-3 border border-border rounded-md bg-muted/50">
                <div className="flex items-center justify-between">
                  <Controller
                    control={control}
                    name={`documents.${index}.doc_type`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {personKind === "PF" ? (
                            <>
                              <SelectItem value="CPF">CPF</SelectItem>
                              <SelectItem value="RG">RG</SelectItem>
                              <SelectItem value="CNH">CNH</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="CNPJ">CNPJ</SelectItem>
                              <SelectItem value="IE">Inscrição Estadual</SelectItem>
                              <SelectItem value="IM">Inscrição Municipal</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                    onClick={() => removeDocument(index)}
                  >
                    ✕
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Número *</Label>
                    <Input
                      {...register(`documents.${index}.value`, { required: true })}
                      placeholder={watch(`documents.${index}.doc_type`) === "CPF" ? "000.000.000-00" : ""}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Órgão emissor</Label>
                    <Input {...register(`documents.${index}.issued_by`)} placeholder="Ex: SSP/AM" />
                  </div>
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input type="date" {...register(`documents.${index}.expires_at`)} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    {...register(`documents.${index}.is_primary`)}
                    className="accent-primary"
                  />
                  Principal
                </label>
              </div>
            ))}
          </div>

          {/* ── Seção 4: Contatos ────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-foreground/70">Contatos</h3>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => appendContact({ contact_type: "CELULAR", value: "", label: "", is_primary: false })}>
                + Adicionar
              </Button>
            </div>

            {/* Campos primários fixos — celular e e-mail obrigatórios */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md border border-border bg-muted/30">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                  Celular principal{needsContacts ? " *" : ""}
                </Label>
                <PhoneInput
                  {...register("primary_phone")}
                  placeholder="(92) 99999-1234"
                  className="mt-1"
                  readOnly={isEditing && !!primaryPhoneValue}
                  title={isEditing && !!primaryPhoneValue ? "Para alterar, use o painel de detalhe da pessoa" : undefined}
                />
                {isEditing && !!primaryPhoneValue && (
                  <p className="text-xs text-muted-foreground mt-0.5">Dado encriptado — edite via painel de detalhe.</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
                  E-mail principal{needsContacts ? " *" : ""}
                </Label>
                <Input
                  {...register("primary_email")}
                  type="email"
                  placeholder="cliente@email.com"
                  className="mt-1"
                  readOnly={isEditing && !!primaryEmailValue}
                  title={isEditing && !!primaryEmailValue ? "Para alterar, use o painel de detalhe da pessoa" : undefined}
                />
                {isEditing && !!primaryEmailValue && (
                  <p className="text-xs text-muted-foreground mt-0.5">Dado encriptado — edite via painel de detalhe.</p>
                )}
              </div>
            </div>

            {/* Contatos adicionais via useFieldArray */}
            {contactFields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <Controller
                  control={control}
                  name={`contacts.${index}.contact_type`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTACT_TYPES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {["CELULAR", "COMERCIAL", "WHATSAPP"].includes(watch(`contacts.${index}.contact_type`)) ? (
                  <PhoneInput {...register(`contacts.${index}.value`)} placeholder="(00) 00000-0000" className="flex-1" />
                ) : (
                  <Input {...register(`contacts.${index}.value`)} placeholder="Valor" className="flex-1" />
                )}
                <Input {...register(`contacts.${index}.label`)} placeholder="Rótulo (opcional)" className="w-28" />
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => removeContact(index)}>
                  ✕
                </Button>
              </div>
            ))}
          </div>

          {/* ── Seção 5: Endereços ───────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-foreground/70">Endereços</h3>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => appendAddress({
                  address_type: "PRINCIPAL", zip_code: "", street: "",
                  number: "", complement: "", neighborhood: "", city: "", state: "",
                  municipio_ibge: "",
                  is_primary: addressFields.length === 0,
                })}>
                + Adicionar
              </Button>
            </div>
            {addressFields.map((field, index) => (
              <div key={field.id} className="space-y-2 p-3 border border-border rounded-md bg-muted/50">
                <div className="flex items-center justify-between">
                  <Controller
                    control={control}
                    name={`addresses.${index}.address_type`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRINCIPAL">Principal</SelectItem>
                          <SelectItem value="COBRANCA">Cobrança</SelectItem>
                          <SelectItem value="ENTREGA">Entrega</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                    onClick={() => removeAddress(index)}>✕</Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <Label className="text-xs">CEP</Label>
                    <Input {...register(`addresses.${index}.zip_code`)} placeholder="00000-000"
                      onBlur={(e) => handleCepBlur(index, e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Logradouro</Label>
                    <Input {...register(`addresses.${index}.street`)} placeholder="Rua, Av..." />
                  </div>
                  <div><Label className="text-xs">Número</Label>
                    <Input {...register(`addresses.${index}.number`)} placeholder="Nº" /></div>
                  <div><Label className="text-xs">Complemento</Label>
                    <Input {...register(`addresses.${index}.complement`)} placeholder="Apto..." /></div>
                  <div><Label className="text-xs">Bairro</Label>
                    <Input {...register(`addresses.${index}.neighborhood`)} /></div>
                  <div><Label className="text-xs">Cidade</Label>
                    <Input {...register(`addresses.${index}.city`)} /></div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input {...register(`addresses.${index}.state`)} maxLength={2} className="w-16" placeholder="AM" />
                  </div>
                  <div>
                    <Label className="text-xs" title="Código IBGE do município (7 dígitos). Obrigatório para NFS-e.">
                      Cód. IBGE
                    </Label>
                    <Input
                      {...register(`addresses.${index}.municipio_ibge`, {
                        maxLength: { value: 7, message: "Máximo 7 dígitos" },
                        pattern: { value: /^\d{0,7}$/, message: "Apenas dígitos" },
                      })}
                      maxLength={7}
                      placeholder="1302603"
                      title="Código IBGE do município (7 dígitos). Ex: 1302603 para Manaus. Obrigatório para NFS-e."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" {...register("notes")} rows={2} placeholder="Observações internas..." />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="is_active" {...register("is_active")} className="accent-primary" />
              <Label htmlFor="is_active">Ativo</Label>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
