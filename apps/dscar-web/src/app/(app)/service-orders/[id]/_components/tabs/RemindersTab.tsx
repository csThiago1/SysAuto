"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bell, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api"

interface ActivityLog {
  id: string
  activity_type: string
  description: string
  user_name: string
  created_at: string
}

interface RemindersTabProps {
  orderId?: string
}

export function RemindersTab({ orderId }: RemindersTabProps) {
  const [text, setText] = useState("")
  const qc = useQueryClient()

  const { data: allLogs, isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["service-order-history", orderId],
    queryFn: () => apiFetch<ActivityLog[]>(`/api/proxy/service-orders/${orderId}/history/`),
    enabled: !!orderId,
  })

  const reminders = (allLogs ?? []).filter((l) => l.activity_type === "reminder")

  const mutation = useMutation({
    mutationFn: (message: string) =>
      apiFetch(`/api/proxy/service-orders/${orderId}/history/`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      setText("")
      toast.success("Lembrete adicionado.")
      return qc.invalidateQueries({ queryKey: ["service-order-history", orderId] })
    },
    onError: () => toast.error("Erro ao adicionar lembrete."),
  })

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40">
        <Bell className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">Salve a OS para adicionar lembretes.</p>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-5 max-w-2xl mx-auto">

      {/* Formulário de novo lembrete */}
      <div className="bg-white/5 border border-white/10 rounded-lg shadow-sm p-4 space-y-3">
        <label htmlFor="reminder-text" className="text-sm font-semibold text-white/70">
          Novo lembrete
        </label>
        <Textarea
          id="reminder-text"
          placeholder="Ex: Ligar para cliente após aprovação da seguradora..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[72px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
              mutation.mutate(text.trim())
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Ctrl+Enter para salvar</span>
          <Button
            size="sm"
            disabled={!text.trim() || mutation.isPending}
            onClick={() => mutation.mutate(text.trim())}
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Lista de lembretes */}
      <div className="bg-white/5 border border-white/10 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/[0.03]">
          <Bell className="h-4 w-4 text-white/50" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Lembretes
            {reminders.length > 0 && (
              <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/70">
                {reminders.length}
              </span>
            )}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="py-10 text-center text-white/40">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum lembrete registrado.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {reminders.map((r) => (
              <li key={r.id} className="px-5 py-4 flex gap-3">
                <div className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-full bg-amber-50 ring-2 ring-amber-100 shrink-0">
                  <Bell className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 whitespace-pre-wrap">{r.description}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {r.user_name} ·{" "}
                    {format(new Date(r.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
