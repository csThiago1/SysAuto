"use client";

/**
 * Página de detalhe de Pessoa / Cadastro
 *
 * Exibe dados completos do cadastro com:
 * - Dados gerais (nome, documento, tipo)
 * - Contatos e endereços
 * - Histórico de OS vinculadas
 * - Botão de edição (abre o PersonFormModal)
 */

import React, { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileText,
  Pencil,
  User,
  Building2,
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Skeleton,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Avatar,
} from "@/components/ui";
import { usePerson, useClientOrders } from "@/hooks";
import {
  PERSON_ROLE_LABEL,
  PERSON_KIND_LABEL,
  CONTACT_TYPE_LABEL,
  ADDRESS_TYPE_LABEL,
  PERSON_ROLE_BADGE,
  formatDate,
  formatOSNumber,
} from "@paddock/utils";
import type {
  PersonRole,
  PersonContact,
  PersonAddress,
  ServiceOrderStatus,
} from "@paddock/types";
import { cn } from "@/lib/utils";
import { PersonFormModal } from "@/components/Cadastros/PersonFormModal";

// ─── Page wrapper ─────────────────────────────────────────────────────────────

interface CadastroDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CadastroDetailPage({ params }: CadastroDetailPageProps): React.ReactElement {
  return (
    <ErrorBoundary>
      <CadastroDetailContent params={params} />
    </ErrorBoundary>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function CadastroDetailContent({ params }: CadastroDetailPageProps): React.ReactElement {
  const { id } = use(params);
  const { data: person, isLoading, isError } = usePerson(id);
  const { data: ordersData, isLoading: ordersLoading } = useClientOrders(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !person) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <User className="h-12 w-12 text-white/30 mb-4" />
        <p className="text-lg font-medium">Cadastro não encontrado</p>
        <Button variant="ghost" className="mt-4" asChild>
          <Link href="/cadastros">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para Cadastros
          </Link>
        </Button>
      </div>
    );
  }

  const roles = person.roles.map((r) => r.role);
  const orders = ordersData?.results ?? [];
  const isPF = person.person_kind === "PF";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cadastros">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <Avatar name={person.full_name} className="h-12 w-12" />

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">
                {person.full_name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-white/60">
                {isPF ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                {PERSON_KIND_LABEL[person.person_kind]}
              </span>
            </div>
            {person.fantasy_name && (
              <p className="text-sm text-white/50 mt-0.5">{person.fantasy_name}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    PERSON_ROLE_BADGE[role]
                  )}
                >
                  {PERSON_ROLE_LABEL[role]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2">
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {(person.documents ?? []).map((doc) => (
                  <InfoItem
                    key={doc.id}
                    label={doc.doc_type}
                    value={`${doc.value_masked}${doc.is_primary ? " · Principal" : ""}`}
                  />
                ))}
                {isPF && <InfoItem label="Data de Nascimento" value={formatDate(person.birth_date)} />}
                {!isPF && person.fantasy_name && (
                  <InfoItem label="Nome Fantasia" value={person.fantasy_name} />
                )}
                {!isPF && person.secondary_document && (
                  <InfoItem label="Inscrição Estadual" value={person.secondary_document} />
                )}
                {!isPF && person.municipal_registration && (
                  <InfoItem label="Inscrição Municipal" value={person.municipal_registration} />
                )}
                <InfoItem
                  label="Status"
                  value={person.is_active ? "Ativo" : "Inativo"}
                  valueClassName={person.is_active ? "text-emerald-600" : "text-red-500"}
                />
                <InfoItem label="Cadastrado em" value={formatDate(person.created_at)} />
              </div>
              {person.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wide mb-1">Observações</p>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{person.notes}</p>
                </div>
              )}
              {person.client_profile && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-2xs font-medium text-white/40 uppercase tracking-wide mb-2">LGPD</p>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem
                      label="Consentimento"
                      value={person.client_profile.lgpd_consent_date
                        ? new Date(person.client_profile.lgpd_consent_date).toLocaleDateString("pt-BR")
                        : "Não registrado"}
                    />
                    <InfoItem
                      label="Compartilhamento no grupo"
                      value={person.client_profile.group_sharing_consent ? "Autorizado" : "Não autorizado"}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          {person.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contatos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {person.contacts.map((contact, i) => (
                    <ContactRow key={contact.id ?? i} contact={contact} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Addresses */}
          {person.addresses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereços</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {person.addresses.map((addr, i) => (
                    <AddressRow key={addr.id ?? i} address={addr} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — OS history */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/40" />
                Ordens de Serviço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-8">
                  Nenhuma OS vinculada.
                </p>
              ) : (
                <div className="space-y-2">
                  {orders.map((os) => (
                    <Link
                      key={os.id}
                      href={`/service-orders/${os.id}` as `/service-orders/${string}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-100 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white">
                          OS #{formatOSNumber(os.number)}
                        </span>
                        <span className="text-xs text-white/50 truncate">
                          {os.plate} · {os.make} {os.model}
                        </span>
                      </div>
                      <StatusBadge
                        status={os.status as ServiceOrderStatus}
                        size="sm"
                      />
                    </Link>
                  ))}

                  {(ordersData?.count ?? 0) > orders.length && (
                    <p className="text-xs text-white/40 text-center pt-2">
                      Exibindo {orders.length} de {ordersData?.count} OS
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <PersonFormModal open={editOpen} onOpenChange={setEditOpen} person={person} />
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function InfoItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}): React.ReactElement | null {
  if (!value || value === "—") return null;
  return (
    <div>
      <p className="text-2xs font-medium text-white/40 uppercase tracking-wide">{label}</p>
      <p className={cn("text-sm text-white mt-0.5", valueClassName)}>{value}</p>
    </div>
  );
}

const CONTACT_ICON: Record<string, React.ReactNode> = {
  CELULAR: <Phone className="h-3.5 w-3.5" />,
  COMERCIAL: <Phone className="h-3.5 w-3.5" />,
  WHATSAPP: <Phone className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  EMAIL_NFE: <Mail className="h-3.5 w-3.5" />,
  EMAIL_FINANCEIRO: <Mail className="h-3.5 w-3.5" />,
  SITE: <Globe className="h-3.5 w-3.5" />,
};

function ContactRow({ contact }: { contact: PersonContact }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 shrink-0">
        {CONTACT_ICON[contact.contact_type] ?? <Phone className="h-3.5 w-3.5" />}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-white">{contact.value}</span>
        <span className="text-xs text-white/50">
          {CONTACT_TYPE_LABEL[contact.contact_type]}
          {contact.label ? ` · ${contact.label}` : ""}
          {contact.is_primary ? " · Principal" : ""}
        </span>
      </div>
    </div>
  );
}

function AddressRow({ address }: { address: PersonAddress }): React.ReactElement {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 shrink-0 mt-0.5">
        <MapPin className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="text-sm text-white">
          {address.street}
          {address.number ? `, ${address.number}` : ""}
          {address.complement ? ` — ${address.complement}` : ""}
        </p>
        <p className="text-xs text-white/50">
          {address.neighborhood} · {address.city}/{address.state}
          {address.zip_code ? ` · CEP ${address.zip_code}` : ""}
        </p>
        <span className="text-xs text-white/40 mt-0.5">
          {ADDRESS_TYPE_LABEL[address.address_type]}
          {address.is_primary ? " · Principal" : ""}
        </span>
      </div>
    </div>
  );
}
