"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, isToday, isYesterday, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowRight,
  Calendar,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Edit3,
  FileText,
  GitBranch,
  Loader2,
  MessageSquare,
  Package,
  PackageMinus,
  PackagePlus,
  Paperclip,
  PlusCircle,
  Receipt,
  Shield,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react"
import type { ActivityLog, ActivityType, BudgetSnapshot, ServiceOrder } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useOSBudgetSnapshots } from "../../_hooks/useOSItems"

// ─── Config por tipo de atividade ─────────────────────────────────────────────

interface ActivityConfig {
  icon: React.ReactElement
  ringClass: string
  bgClass: string
  label: string
}

const ACTIVITY_CONFIG: Partial<Record<ActivityType, ActivityConfig>> = {
  created: {
    icon: <PlusCircle className="h-4 w-4 text-success-400" />,
    ringClass: "ring-success-500/20",
    bgClass: "bg-success-500/10",
    label: "OS Aberta",
  },
  status_changed: {
    icon: <GitBranch className="h-4 w-4 text-info-400" />,
    ringClass: "ring-info-500/20",
    bgClass: "bg-info-500/10",
    label: "Status Alterado",
  },
  updated: {
    icon: <Edit3 className="h-4 w-4 text-amber-600" />,
    ringClass: "ring-amber-100",
    bgClass: "bg-amber-50",
    label: "Atualização",
  },
  customer_updated: {
    icon: <UserCheck className="h-4 w-4 text-teal-600" />,
    ringClass: "ring-teal-100",
    bgClass: "bg-teal-50",
    label: "Cliente",
  },
  vehicle_updated: {
    icon: <Car className="h-4 w-4 text-sky-600" />,
    ringClass: "ring-sky-100",
    bgClass: "bg-sky-50",
    label: "Veículo",
  },
  schedule_updated: {
    icon: <Calendar className="h-4 w-4 text-purple-600" />,
    ringClass: "ring-purple-100",
    bgClass: "bg-purple-50",
    label: "Datas/Prazo",
  },
  insurer_updated: {
    icon: <Shield className="h-4 w-4 text-orange-600" />,
    ringClass: "ring-orange-100",
    bgClass: "bg-orange-50",
    label: "Seguradora",
  },
  reminder: {
    icon: <MessageSquare className="h-4 w-4 text-white/60" />,
    ringClass: "ring-white/10",
    bgClass: "bg-white/[0.03]",
    label: "Observação",
  },
  note_added: {
    icon: <MessageSquare className="h-4 w-4 text-white/60" />,
    ringClass: "ring-white/10",
    bgClass: "bg-white/[0.03]",
    label: "Nota",
  },
  file_upload: {
    icon: <Paperclip className="h-4 w-4 text-violet-600" />,
    ringClass: "ring-violet-100",
    bgClass: "bg-violet-50",
    label: "Foto",
  },
  budget_snapshot: {
    icon: <Receipt className="h-4 w-4 text-indigo-400" />,
    ringClass: "ring-indigo-500/20",
    bgClass: "bg-indigo-500/10",
    label: "Orçamento",
  },
  cilia_import: {
    icon: <Download className="h-4 w-4 text-cyan-600" />,
    ringClass: "ring-cyan-100",
    bgClass: "bg-cyan-50",
    label: "Importação Cilia",
  },
  delivery: {
    icon: <Truck className="h-4 w-4 text-success-400" />,
    ringClass: "ring-success-500/20",
    bgClass: "bg-success-500/10",
    label: "Entrega",
  },
  part_added: {
    icon: <PackagePlus className="h-4 w-4 text-info-400" />,
    ringClass: "ring-info-500/20",
    bgClass: "bg-info-500/10",
    label: "Peça",
  },
  part_removed: {
    icon: <PackageMinus className="h-4 w-4 text-error-400" />,
    ringClass: "ring-error-500/20",
    bgClass: "bg-error-500/10",
    label: "Peça",
  },
  labor_added: {
    icon: <Wrench className="h-4 w-4 text-orange-600" />,
    ringClass: "ring-orange-100",
    bgClass: "bg-orange-50",
    label: "Serviço",
  },
  labor_removed: {
    icon: <Wrench className="h-4 w-4 text-error-400" />,
    ringClass: "ring-error-500/20",
    bgClass: "bg-error-500/10",
    label: "Serviço",
  },
  part_updated: {
    icon: <Package className="h-4 w-4 text-info-400" />,
    ringClass: "ring-info-500/20",
    bgClass: "bg-info-500/10",
    label: "Peça",
  },
  labor_updated: {
    icon: <Wrench className="h-4 w-4 text-orange-500" />,
    ringClass: "ring-orange-100",
    bgClass: "bg-orange-50",
    label: "Serviço",
  },
  invoice_issued: {
    icon: <FileText className="h-4 w-4 text-success-400" />,
    ringClass: "ring-success-500/20",
    bgClass: "bg-success-500/10",
    label: "NF Emitida",
  },
}

const DEFAULT_CONFIG: ActivityConfig = {
  icon: <ClipboardCheck className="h-4 w-4 text-white/50" />,
  ringClass: "ring-white/10",
  bgClass: "bg-white/[0.03]",
  label: "Atividade",
}

const FIELD_DIFF_TYPES = new Set<ActivityType>([
  "updated",
  "customer_updated",
  "vehicle_updated",
  "schedule_updated",
  "insurer_updated",
  "part_updated",
  "labor_updated",
])

// ─── Field Diff ───────────────────────────────────────────────────────────────

function FieldDiff({ log }: { log: ActivityLog }) {
  const changes = log.metadata?.field_changes
  if (!changes?.length) return null

  return (
    <div className="mt-2 space-y-1">
      {changes.map((change, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs">
          <span className="text-white/50 shrink-0 mt-0.5">{change.field_label}:</span>
          {change.old_value !== null && (
            <span className="line-through text-red-400 truncate max-w-[120px]">
              {String(change.old_value)}
            </span>
          )}
          {change.old_value !== null && (
            <ArrowRight className="h-3 w-3 text-white/40 shrink-0 mt-0.5" />
          )}
          <span className="text-success-400 font-medium truncate max-w-[120px]">
            {String(change.new_value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Status Change Display ────────────────────────────────────────────────────

function StatusChangeDisplay({ log }: { log: ActivityLog }) {
  const from = log.metadata?.from_status
  const to = log.metadata?.to_status
  if (!from || !to) return null

  const fromCfg = SERVICE_ORDER_STATUS_CONFIG[from]
  const toCfg = SERVICE_ORDER_STATUS_CONFIG[to]

  return (
    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      <span className={cn("text-xs px-2 py-0.5 rounded-full border", fromCfg?.badge ?? "bg-white/5 text-white/50 border-white/10")}>
        {fromCfg?.label ?? from}
      </span>
      <ArrowRight className="h-3 w-3 text-white/40" />
      <span className={cn("text-xs px-2 py-0.5 rounded-full border", toCfg?.badge ?? "bg-white/5 text-white/50 border-white/10")}>
        {toCfg?.label ?? to}
      </span>
    </div>
  )
}

// ─── Budget Snapshot Viewer ───────────────────────────────────────────────────

function BudgetSnapshotViewer({ snapshot }: { snapshot: BudgetSnapshot }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/15 transition-colors"
      >
        <span className="font-semibold">
          Orçamento v{snapshot.version} — R${" "}
          {snapshot.grand_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && snapshot.items_snapshot.length > 0 && (
        <div className="px-3 pb-3 space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs text-indigo-300/60 font-medium border-b border-indigo-500/20 pb-1 gap-2">
            <span>Item</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Unit.</span>
            <span className="text-right">Total</span>
          </div>
          {snapshot.items_snapshot.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] text-xs gap-2">
              <span className="truncate text-indigo-200">
                <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle", item.type === "part" ? "bg-info-400" : "bg-orange-400")} />
                {item.description}
              </span>
              <span className="text-right text-indigo-300">{item.quantity}</span>
              <span className="text-right text-indigo-300">
                R$ {item.unit_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right font-medium text-indigo-200">
                R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Activity Entry ───────────────────────────────────────────────────────────

interface ActivityEntryProps {
  log: ActivityLog
  snapshots: BudgetSnapshot[]
}

function ActivityEntry({ log, snapshots }: ActivityEntryProps) {
  const cfg = ACTIVITY_CONFIG[log.activity_type] ?? DEFAULT_CONFIG

  // Snapshot associado ao log
  const snapshotVersion = log.metadata?.snapshot_version
  const relatedSnapshot = snapshotVersion
    ? snapshots.find((s) => s.version === snapshotVersion)
    : undefined

  return (
    <div className="relative">
      <span
        className={cn(
          "absolute -left-[25px] top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4 shadow-sm",
          cfg.bgClass,
          cfg.ringClass
        )}
      >
        {cfg.icon}
      </span>

      <div className="ml-2 rounded-lg border border-white/10 bg-white/5 p-3 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-white/90">{log.user_name}</span>
            <Badge
              variant="secondary"
              className={cn("text-xs py-0 px-1.5", cfg.bgClass)}
            >
              {cfg.label}
            </Badge>
          </div>
          <span className="text-white/40 text-xs shrink-0">
            {format(parseISO(log.created_at), "HH:mm")}
          </span>
        </div>

        {/* Description — only show for non-field-diff types */}
        {!FIELD_DIFF_TYPES.has(log.activity_type) && (
          <p className="text-sm text-white/60 mt-1 leading-snug">{log.description}</p>
        )}

        {/* Rich extras */}
        {log.activity_type === "status_changed" && <StatusChangeDisplay log={log} />}
        {FIELD_DIFF_TYPES.has(log.activity_type) && <FieldDiff log={log} />}
        {(log.activity_type === "budget_snapshot" || log.activity_type === "cilia_import") && relatedSnapshot && (
          <BudgetSnapshotViewer snapshot={relatedSnapshot} />
        )}
        {log.activity_type === "delivery" && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-success-400">
            <CheckCircle className="h-3 w-3" />
            <span>Entrega registrada com sucesso</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Date group ───────────────────────────────────────────────────────────────

function DateGroupLabel({ date }: { date: string }) {
  const d = parseISO(date)
  let label = format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  if (isToday(d)) label = "Hoje"
  else if (isYesterday(d)) label = "Ontem"
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

// ─── Main HistoryTab ──────────────────────────────────────────────────────────

interface HistoryTabProps {
  order: ServiceOrder
}

export function HistoryTab({ order }: HistoryTabProps) {
  const [note, setNote] = useState("")
  const qc = useQueryClient()

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["service-order-history", order.id],
    queryFn: () => apiFetch(`/api/proxy/service-orders/${order.id}/history/`),
  })

  const { data: snapshots = [] } = useOSBudgetSnapshots(order.id)

  const addNote = useMutation({
    mutationFn: (message: string) =>
      apiFetch(`/api/proxy/service-orders/${order.id}/history/`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      setNote("")
      toast.success("Nota adicionada ao histórico")
      void qc.invalidateQueries({ queryKey: ["service-order-history", order.id] })
    },
    onError: () => toast.error("Erro ao adicionar nota."),
  })

  // Group logs by date
  const grouped = logs.reduce<Record<string, ActivityLog[]>>((acc, log) => {
    const day = format(parseISO(log.created_at), "yyyy-MM-dd")
    ;(acc[day] ??= []).push(log)
    return acc
  }, {})

  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add note */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 shadow-sm space-y-3">
        <label htmlFor="history-note" className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-white/40" />
          Adicionar observação
        </label>
        <Textarea
          id="history-note"
          placeholder="Ex: Cliente aguarda aprovação da seguradora..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[72px] text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!note.trim() || addNote.isPending}
            onClick={() => addNote.mutate(note)}
          >
            {addNote.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Anotar
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-white/40 text-sm">
          Nenhum registro ainda.
        </div>
      ) : (
        <div>
          {days.map((day) => (
            <div key={day}>
              <DateGroupLabel date={`${day}T12:00:00`} />
              <div className="relative pl-6 border-l-2 border-white/10 space-y-4">
                {(grouped[day] ?? []).map((log) => (
                  <ActivityEntry key={log.id} log={log} snapshots={snapshots} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
