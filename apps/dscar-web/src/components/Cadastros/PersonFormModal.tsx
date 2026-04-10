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
import type { Person, PersonRole, CreatePersonPayload, ModalProps } from "@paddock/types";
import { PERSON_ROLE_LABEL, PERSON_JOB_TITLE_OPTIONS, PERSON_DEPARTMENT_OPTIONS, isValidCPF, isValidCNPJ } from "@paddock/utils";
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
  CpfCnpjInput,
} from "@/components/ui";
import { useCreatePerson, useUpdatePerson, useCepLookup, usePerson } from "@/hooks";
import { handleApiFormError } from "@/lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FormValues = Omit<CreatePersonPayload, "roles"> & { roles: PersonRole[] };

/** Props do modal — extende o contrato base ModalProps com campo de domínio */
interface PersonFormModalProps extends ModalProps {
  /** undefined ou null = criação; Person = edição */
  person?: Person | null;
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const ALL_ROLES: PersonRole[] = ["CLIENT", "INSURER", "BROKER", "EMPLOYEE", "SUPPLIER"];

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

export function PersonFormModal({ open, onOpenChange, person }: PersonFormModalProps): React.ReactElement {
  const isEditing = !!person;

  // ── Hooks de dados ────────────────────────────────────────────────────────
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const cepLookup    = useCepLookup();
  const { data: personDetail } = usePerson(isEditing && open ? (person?.id ?? null) : null);
  const personData = personDetail ?? person;

  // ── Estado de roles (toggle buttons) ─────────────────────────────────────
  const [selectedRoles, setSelectedRoles] = useState<PersonRole[]>(
    person?.roles.map((r) => r.role) ?? ["CLIENT"]
  );

  // ── Formulário ────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, setValue, control, setError } = useForm<FormValues>({
    defaultValues: {
      person_kind: "PF", full_name: "", fantasy_name: "", document: "",
      is_active: true, notes: "", logo_url: "", insurer_code: "",
      job_title: "", department: "",
      roles: ["CLIENT"], contacts: [], addresses: [],
    },
  });

  const { fields: contactFields, append: appendContact, remove: removeContact } =
    useFieldArray({ control, name: "contacts" });

  const { fields: addressFields, append: appendAddress, remove: removeAddress } =
    useFieldArray({ control, name: "addresses" });

  const personKind        = watch("person_kind");
  const showInsurerFields  = selectedRoles.includes("INSURER");
  const showEmployeeFields = selectedRoles.includes("EMPLOYEE");

  // ── Carrega dados ao editar ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (isEditing && !personDetail) return;
    const src = personData;
    reset({
      person_kind: src?.person_kind ?? "PF",
      full_name:   src?.full_name ?? "",
      fantasy_name: src?.fantasy_name ?? "",
      document:    src?.document ?? "",
      is_active:   src?.is_active ?? true,
      notes:       src?.notes ?? "",
      logo_url:    src?.logo_url ?? "",
      insurer_code: src?.insurer_code ?? "",
      job_title:   src?.job_title ?? "",
      department:  src?.department ?? "",
      roles:       src?.roles.map((r) => r.role) ?? ["CLIENT"],
      contacts:    src?.contacts ?? [],
      addresses:   src?.addresses ?? [],
    });
    setSelectedRoles(src?.roles.map((r) => r.role) ?? ["CLIENT"]);
  }, [open, isEditing, personDetail, personData, reset]);

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
    const payload: CreatePersonPayload = { ...data, roles: selectedRoles };
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
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
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
            <h3 className="text-sm font-semibold text-neutral-700 border-b pb-1">Dados Gerais</h3>
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
              <div>
                <Label htmlFor="document">{personKind === "PJ" ? "CNPJ" : "CPF"}</Label>
                <CpfCnpjInput id="document" {...register("document", {
                  validate: (v) => {
                    if (!v) return true; // campo não obrigatório
                    const clean = v.replace(/\D/g, "");
                    if (personKind === "PF" && clean.length > 0) return isValidCPF(clean) || "CPF inválido";
                    if (personKind === "PJ" && clean.length > 0) return isValidCNPJ(clean) || "CNPJ inválido";
                    return true;
                  },
                })}
                  placeholder={personKind === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} />
              </div>
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

          {/* ── Seção 3: Contatos ────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-neutral-700">Contatos</h3>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => appendContact({ contact_type: "CELULAR", value: "", label: "", is_primary: contactFields.length === 0 })}>
                + Adicionar
              </Button>
            </div>
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
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-neutral-400 hover:text-red-500"
                  onClick={() => removeContact(index)}>
                  ✕
                </Button>
              </div>
            ))}
          </div>

          {/* ── Seção 4: Endereços ───────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h3 className="text-sm font-semibold text-neutral-700">Endereços</h3>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => appendAddress({
                  address_type: "PRINCIPAL", zip_code: "", street: "",
                  number: "", complement: "", neighborhood: "", city: "", state: "",
                  is_primary: addressFields.length === 0,
                })}>
                + Adicionar
              </Button>
            </div>
            {addressFields.map((field, index) => (
              <div key={field.id} className="space-y-2 p-3 border rounded-md bg-neutral-50">
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
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-neutral-400 hover:text-red-500"
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
                  <div className="col-span-4">
                    <Label className="text-xs">UF</Label>
                    <Input {...register(`addresses.${index}.state`)} maxLength={2} className="w-16" placeholder="AM" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Seção 5: Dados de Seguradora (condicional) ───────────────── */}
          {showInsurerFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700 border-b pb-1">Dados de Seguradora</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="logo_url">URL do Logo</Label>
                  <Input id="logo_url" {...register("logo_url")} placeholder="https://..." />
                </div>
                <div>
                  <Label htmlFor="insurer_code">Código Interno</Label>
                  <Input id="insurer_code" {...register("insurer_code")} />
                </div>
              </div>
            </div>
          )}

          {/* ── Seção 6: Dados de Funcionário (condicional) ──────────────── */}
          {showEmployeeFields && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-700 border-b pb-1">Dados do Funcionário</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cargo</Label>
                  <Controller
                    control={control}
                    name="job_title"
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={f.onChange}>
                        <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                        <SelectContent>
                          {PERSON_JOB_TITLE_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label>Setor</Label>
                  <Controller
                    control={control}
                    name="department"
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={f.onChange}>
                        <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                        <SelectContent>
                          {PERSON_DEPARTMENT_OPTIONS.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="space-y-3 border-t pt-4">
            <div>
              <Label htmlFor="notes">Observações</Label>
              {/* ✅ Usa Textarea do barrel — não mais <textarea> nativo */}
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
