/**
 * Activity config map — extracted from HistoryTab.tsx
 *
 * Maps each ActivityType to its icon, ring/bg token classes, and human label.
 * Components that render the history timeline import from here.
 */

import type { ReactElement } from "react"
import {
  Calendar,
  Car,
  CheckCircle,
  ClipboardCheck,
  Download,
  Edit3,
  FileText,
  GitBranch,
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
import type { ActivityType } from "@paddock/types"

export interface ActivityConfig {
  icon: ReactElement
  ringClass: string
  bgClass: string
  label: string
}

export const ACTIVITY_CONFIG: Partial<Record<ActivityType, ActivityConfig>> = {
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

export const DEFAULT_ACTIVITY_CONFIG: ActivityConfig = {
  icon: <ClipboardCheck className="h-4 w-4 text-white/50" />,
  ringClass: "ring-white/10",
  bgClass: "bg-white/[0.03]",
  label: "Atividade",
}

/** Activity types that carry field-level diff data in metadata.field_changes */
export const FIELD_DIFF_TYPES = new Set<ActivityType>([
  "updated",
  "customer_updated",
  "vehicle_updated",
  "schedule_updated",
  "insurer_updated",
  "part_updated",
  "labor_updated",
])

/** Resolve config for a given activity type, with fallback to DEFAULT. */
export function getActivityConfig(activityType: ActivityType): ActivityConfig {
  return ACTIVITY_CONFIG[activityType] ?? DEFAULT_ACTIVITY_CONFIG
}
