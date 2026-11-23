"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Pencil, Power, Users, ShieldCheck, Copy, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch, fetchList } from "@/lib/api"
import { useHasPermission } from "@/hooks/usePermission"

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string
  name: string
  email_hash: string
  role: string
  role_display: string
  job_title: string
  job_title_display: string
  is_active: boolean
  email_verified: boolean
  created_at: string
}

type RoleKey = "OWNER" | "ADMIN" | "MANAGER" | "CONSULTANT" | "STOREKEEPER"

const ROLE_LABELS: Record<RoleKey, string> = {
  OWNER: "Proprietario",
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  CONSULTANT: "Consultor",
  STOREKEEPER: "Almoxarife",
}

const ROLE_COLORS: Record<RoleKey, string> = {
  OWNER: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  ADMIN: "bg-primary/10 text-primary border-primary/20",
  MANAGER: "bg-info-500/10 text-info-400 border-info-500/20",
  CONSULTANT: "bg-success-500/10 text-success-400 border-success-500/20",
  STOREKEEPER: "bg-warning-500/10 text-warning-400 border-warning-500/20",
}

const JOB_TITLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Nenhum" },
  { value: "reception", label: "Recepcao" },
  { value: "painting", label: "Pintura" },
  { value: "mechanical", label: "Mecanica" },
  { value: "admin", label: "Administracao" },
  { value: "inventory", label: "Estoque" },
  { value: "sales", label: "Vendas" },
  { value: "purchasing", label: "Compras" },
]

const ALL_ROLES: RoleKey[] = ["OWNER", "ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"]

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const inviteCreatedSchema = z.object({
  id: z.string(),
  token: z.string(),
  role: z.string(),
  expires_at: z.string(),
})

const pendingInviteSchema = z.array(
  z.object({
    id: z.string(),
    role: z.string(),
    role_display: z.string(),
    expires_at: z.string(),
  })
)

type PendingInvite = z.infer<typeof pendingInviteSchema>[number]

const editSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "CONSULTANT", "STOREKEEPER"]),
  job_title: z.string(),
})

type EditFormValues = z.infer<typeof editSchema>

// ─── Query Keys ─────────────────────────────────────────────────────────────

const staffKeys = {
  all: ["auth", "staff"] as const,
  list: (includeInactive: boolean) => [...staffKeys.all, { includeInactive }] as const,
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const canManage = useHasPermission("admin.users")

  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null)
  const [toggling, setToggling] = useState<StaffUser | null>(null)

  const queryClient = useQueryClient()

  // ─── Queries ────────────────────────────────────────────────────────────

  const { data: users = [], isLoading } = useQuery({
    queryKey: staffKeys.list(showInactive),
    queryFn: () =>
      fetchList<StaffUser>(
        `/api/proxy/auth/staff/${showInactive ? "?include_inactive=true" : ""}`
      ),
  })

  // ─── Mutations ──────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; role: string; job_title: string }) =>
      apiFetch(`/api/proxy/auth/staff/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
      toast.success("Usuario atualizado.")
      setEditTarget(null)
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch(`/api/proxy/auth/staff/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.all })
      toast.success(toggling?.is_active ? "Usuario desativado." : "Usuario reativado.")
      setToggling(null)
    },
  })

  // ─── Filter ─────────────────────────────────────────────────────────────

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.role_display.toLowerCase().includes(search.toLowerCase()) ||
        u.job_title_display.toLowerCase().includes(search.toLowerCase())
      )
    : users

  // ─── Permission guard ──────────────────────────────────────────────────

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Sem permissao para gerenciar usuarios.
        </p>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie acessos, convites e permissoes dos usuarios do sistema.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Convidar Usuario
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={showInactive}
            onCheckedChange={(v) => setShowInactive(v === true)}
          />
          Mostrar inativos
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search ? "Nenhum usuario encontrado." : "Nenhum usuario cadastrado."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Role</TableHead>
                <TableHead className="w-32">Setor</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Criado em</TableHead>
                <TableHead className="w-24 text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow
                  key={user.id}
                  className={!user.is_active ? "opacity-50" : undefined}
                >
                  <TableCell className="py-2">
                    <div>
                      <p className="font-medium text-foreground/90">{user.name}</p>
                      {!user.email_verified && (
                        <span className="text-xs text-warning-400">Email nao verificado</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      className={`text-xs ${ROLE_COLORS[user.role as RoleKey] ?? "bg-muted/50 text-foreground/60 border-border"}`}
                    >
                      {user.role_display || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/70">
                    {user.job_title_display || "—"}
                  </TableCell>
                  <TableCell className="py-2">
                    {user.is_active ? (
                      <Badge className="bg-success-500/10 text-success-400 border-success-500/20 text-xs">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-muted/50 text-muted-foreground border-border text-xs">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-foreground/60 tabular-nums">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditTarget(user)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setToggling(user)}
                        title={user.is_active ? "Desativar" : "Reativar"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" />
        {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}.
      </p>

      {/* ─── Invite Sheet ──────────────────────────────────────────────────── */}
      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* ─── Edit Sheet ────────────────────────────────────────────────────── */}
      <EditSheet
        user={editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        isPending={updateMutation.isPending}
        onSubmit={async (data) => {
          if (!editTarget) return
          try { await updateMutation.mutateAsync({ id: editTarget.id, ...data }) } catch { toast.error("Erro ao atualizar usuario.") }
        }}
      />

      {/* ─── Toggle Active AlertDialog ─────────────────────────────────────── */}
      <AlertDialog open={!!toggling} onOpenChange={(open) => !open && setToggling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggling?.is_active ? "Desativar usuario?" : "Reativar usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggling?.is_active
                ? `O usuario "${toggling?.name}" sera desativado e perdera acesso ao sistema.`
                : `O usuario "${toggling?.name}" sera reativado e podera acessar o sistema novamente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toggling) {
                  toggleActiveMutation.mutate({
                    id: toggling.id,
                    is_active: !toggling.is_active,
                  })
                }
              }}
            >
              {toggling?.is_active ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── InviteSheet ──────────────────────────────────────────────────────────────

const inviteKeys = { pending: ["auth", "invites"] as const }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function InviteSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState<RoleKey>("CONSULTANT")
  const [link, setLink] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<PendingInvite | null>(null)

  const pending = useQuery({
    queryKey: inviteKeys.pending,
    enabled: open,
    queryFn: async () => pendingInviteSchema.parse(await apiFetch<unknown>("/api/proxy/auth/invites/")),
  })

  const create = useMutation({
    mutationFn: async (r: RoleKey) =>
      inviteCreatedSchema.parse(
        await apiFetch<unknown>("/api/proxy/auth/invites/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: r }),
        })
      ),
    onSuccess: (data) => {
      setLink(`${window.location.origin}/convite/${data.token}`)
      queryClient.invalidateQueries({ queryKey: inviteKeys.pending })
    },
    onError: () => toast.error("Nao foi possivel gerar o convite."),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/proxy/auth/invites/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Convite revogado.")
      setRevoking(null)
      queryClient.invalidateQueries({ queryKey: inviteKeys.pending })
    },
    onError: () => toast.error("Nao foi possivel revogar o convite."),
  })

  function close(next: boolean) {
    if (!next) setLink(null)
    onOpenChange(next)
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copiado.")
    } catch {
      toast.error("Nao foi possivel copiar. Selecione o link e copie manualmente.")
    }
  }

  const whatsapp = link
    ? `https://wa.me/?text=${encodeURIComponent(`Seu convite para o sistema da DS Car: ${link}`)}`
    : ""

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Convidar Usuario</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            A pessoa recebe um link de uso unico (vale 7 dias), preenche os proprios dados e vira usuario e
            funcionario com o papel escolhido.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleKey)}>
              <SelectTrigger>
                <span>{ROLE_LABELS[role]}</span>
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate(role)}>
            {create.isPending ? "Gerando..." : "Gerar link de convite"}
          </Button>

          {link && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="text-xs font-medium">Link do convite</Label>
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 gap-1.5" onClick={copy}>
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
                <Button asChild type="button" className="flex-1 gap-1.5">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <Send className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-foreground">Convites pendentes</h3>
            {pending.isLoading ? (
              <TableSkeleton columns={3} rows={2} />
            ) : pending.isError ? (
              <p className="text-xs text-error-400">Nao foi possivel carregar os convites.</p>
            ) : !pending.data?.length ? (
              <p className="text-xs text-muted-foreground">Nenhum convite pendente.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {pending.data.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      {inv.role_display}
                      <span className="ml-2 text-xs text-muted-foreground">vence {formatDate(inv.expires_at)}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setRevoking(inv)}>
                      Revogar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <AlertDialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
              <AlertDialogDescription>
                O link de {revoking?.role_display} para de funcionar. Quem ainda nao se cadastrou vai precisar de
                um novo convite.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={revoke.isPending}
                onClick={() => revoking && revoke.mutate(revoking.id)}
              >
                Revogar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

// ─── EditSheet ────────────────────────────────────────────────────────────────

function EditSheet({
  user,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  user: StaffUser | null
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onSubmit: (data: EditFormValues) => Promise<void>
}) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: user
      ? { role: user.role as RoleKey, job_title: user.job_title || "" }
      : { role: "CONSULTANT", job_title: "" },
  })

  async function handleSave(data: EditFormValues) {
    try {
      await onSubmit(data)
    } catch {
      // error handled by parent
    }
  }

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Editar Usuario</SheetTitle>
        </SheetHeader>
        {user && (
          <form onSubmit={form.handleSubmit(handleSave)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome</Label>
              <p className="text-sm font-medium text-foreground">{user.name}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as RoleKey, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Setor</Label>
              <Select
                value={form.watch("job_title")}
                onValueChange={(v) => form.setValue("job_title", v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || "__none"} value={opt.value || "__none"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar alteracoes"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
