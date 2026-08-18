"use client";

/**
 * Cadastro das regras de retorno.
 *
 * Cada regra define quanto tempo após a entrega o retorno vence, por qual
 * canal e com qual mensagem. Regra inativa não agenda nada — é assim que as
 * duas regras seedadas ficam paradas até alguém ligar a chave.
 */

import React, { useState } from "react";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Textarea,
} from "@/components/ui";
import {
  useCreateFollowupRule,
  useDeleteFollowupRule,
  useFollowupRules,
  useUpdateFollowupRule,
  type FollowUpRule,
  type FollowUpRulePayload,
} from "@/hooks/useFollowups";
import { cn } from "@/lib/utils";

const EMPTY: FollowUpRulePayload = {
  name: "",
  trigger_event: "delivered",
  delay_hours: 48,
  channel: "task",
  message_template: "",
  link: "",
  os_types: [],
  is_active: false,
};

export default function RegrasPage(): React.ReactElement {
  return (
    <ErrorBoundary>
      <RegrasContent />
    </ErrorBoundary>
  );
}

function RegrasContent(): React.ReactElement {
  const { data: rules, isLoading, isError } = useFollowupRules();
  const [editing, setEditing] = useState<FollowUpRule | "new" | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar as regras.
      </p>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Settings2 className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-xl font-bold">Regras de retorno</h1>
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova regra
          </Button>
        </div>
      </div>

      {editing && (
        <RuleForm
          rule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {(rules ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma regra cadastrada.
        </p>
      ) : (
        <div className="space-y-2">
          {(rules ?? []).map((rule) => (
            <RuleCard key={rule.id} rule={rule} onEdit={() => setEditing(rule)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
}: {
  rule: FollowUpRule;
  onEdit: () => void;
}): React.ReactElement {
  const update = useUpdateFollowupRule();
  const remove = useDeleteFollowupRule();

  async function toggleActive(): Promise<void> {
    try {
      await update.mutateAsync({ id: rule.id, data: { is_active: !rule.is_active } });
      toast.success(rule.is_active ? "Regra desativada." : "Regra ativada.");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await remove.mutateAsync(rule.id);
      toast.success("Regra removida.");
    } catch {
      toast.error("Erro ao remover. Tente novamente.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 px-3 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {rule.name}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDelay(rule.delay_hours)} após a entrega ·{" "}
              {rule.channel === "task" ? "tarefa interna" : "WhatsApp"}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              rule.is_active ? "text-success-500" : "text-muted-foreground"
            )}
          >
            {rule.is_active ? "Ativa" : "Inativa"}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {rule.message_template}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={toggleActive}>
            {rule.is_active ? "Desativar" : "Ativar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleForm({
  rule,
  onClose,
}: {
  rule: FollowUpRule | null;
  onClose: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<FollowUpRulePayload>(
    rule
      ? {
          name: rule.name,
          trigger_event: rule.trigger_event,
          delay_hours: rule.delay_hours,
          channel: rule.channel,
          message_template: rule.message_template,
          link: rule.link,
          os_types: rule.os_types,
          is_active: rule.is_active,
        }
      : EMPTY
  );
  const create = useCreateFollowupRule();
  const update = useUpdateFollowupRule();

  function setField<K extends keyof FollowUpRulePayload>(
    key: K,
    value: FollowUpRulePayload[K]
  ): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(): Promise<void> {
    if (!draft.name.trim() || !draft.message_template.trim()) {
      toast.error("Nome e mensagem são obrigatórios.");
      return;
    }
    try {
      if (rule) {
        await update.mutateAsync({ id: rule.id, data: draft });
      } else {
        await create.mutateAsync(draft);
      }
      toast.success("Regra salva.");
      onClose();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 px-3 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Nome</span>
            <Input
              value={draft.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Pesquisa de satisfação"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Horas após a entrega
            </span>
            <Input
              type="number"
              min={1}
              value={draft.delay_hours}
              onChange={(e) => setField("delay_hours", Number(e.target.value))}
            />
          </label>
        </div>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Mensagem — use {"{cliente}"}, {"{placa}"} e {"{os}"}
          </span>
          <Textarea
            value={draft.message_template}
            onChange={(e) => setField("message_template", e.target.value)}
            rows={3}
            placeholder="Olá {cliente}! Como foi a experiência com o {placa}? (OS {os})"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Link (ex: avaliação no Google)
          </span>
          <Input
            value={draft.link}
            onChange={(e) => setField("link", e.target.value)}
            placeholder="https://g.page/..."
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSave} disabled={busy}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDelay(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}
