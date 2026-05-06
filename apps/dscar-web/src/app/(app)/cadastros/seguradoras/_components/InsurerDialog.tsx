"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useInsurerCreate, useInsurerUpdate, useInsurerUploadLogo } from "@/hooks/useInsurers"
import type { Insurer, InsurerFull } from "@paddock/types"

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/

const schema = z.object({
  name: z.string().min(2, "Razão social obrigatória"),
  trade_name: z.string().optional(),
  cnpj: z
    .string()
    .regex(CNPJ_REGEX, "CNPJ inválido (ex: 00.000.000/0000-00)")
    .or(z.literal("")),
  abbreviation: z.string().max(4, "Máx. 4 caracteres").optional(),
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor hex inválida")
    .optional()
    .or(z.literal("")),
  uses_cilia: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Insurer | null
}

const LABEL = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5"

export function InsurerDialog({ open, onOpenChange, editing }: Props) {
  const create = useInsurerCreate()
  const update = useInsurerUpdate(editing?.id ?? "")
  const uploadLogo = useInsurerUploadLogo()
  // InsurerFull not used here; editing is Insurer which has all required fields

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const brandColor = watch("brand_color")

  useEffect(() => {
    if (!open) return
    if (editing) {
      reset({
        name: editing.name,
        trade_name: editing.trade_name,
        cnpj: editing.cnpj,
        abbreviation: editing.abbreviation,
        brand_color: editing.brand_color,
        uses_cilia: editing.uses_cilia,
      })
      setLogoPreview(editing.logo_url || null)
    } else {
      reset({
        name: "", trade_name: "", cnpj: "",
        abbreviation: "", brand_color: "#000000", uses_cilia: false,
      })
      setLogoPreview(null)
    }
    setPendingFile(null)
  }, [open, editing, reset])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    const validTypes = ["image/png", "image/svg+xml"]
    if (!validTypes.includes(file.type) && ext !== "svg" && ext !== "png") {
      toast.error("Formato inválido. Use PNG ou SVG.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2 MB.")
      return
    }
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearLogo() {
    setPendingFile(null)
    setLogoPreview(editing?.logo_url || null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function onSubmit(data: FormData) {
    try {
      let targetId: string

      if (editing) {
        await update.mutateAsync(data)
        targetId = editing.id
      } else {
        const created = await create.mutateAsync(data)
        targetId = created.id
      }

      if (pendingFile) {
        await uploadLogo.mutateAsync({ id: targetId, file: pendingFile })
      }

      toast.success(editing ? "Seguradora atualizada." : "Seguradora criada.")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar seguradora.")
    }
  }

  const saving = isSubmitting || uploadLogo.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{editing ? "Editar Seguradora" : "Nova Seguradora"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Logo */}
          <div>
            <label className={LABEL}>Logo (PNG ou SVG · máx. 2 MB)</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">?</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {logoPreview ? "Trocar logo" : "Enviar logo"}
                </Button>
                {pendingFile && (
                  <>
                    <button
                      type="button"
                      onClick={clearLogo}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-error-400"
                    >
                      <X className="h-3 w-3" />
                      Remover seleção
                    </button>
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {pendingFile.name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,image/png,image/svg+xml"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Razão social */}
          <div>
            <label className={LABEL}>Razão Social *</label>
            <Input className="h-8" placeholder="Ex: Porto Seguro Companhia de Seguros Gerais" {...register("name")} />
            {errors.name && <p className="mt-0.5 text-xs text-error-400">{errors.name.message}</p>}
          </div>

          {/* Nome fantasia */}
          <div>
            <label className={LABEL}>Nome Fantasia</label>
            <Input className="h-8" placeholder="Ex: Porto Seguro" {...register("trade_name")} />
          </div>

          {/* CNPJ */}
          <div>
            <label className={LABEL}>CNPJ *</label>
            <Input
              className="h-8 font-mono"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              value={formatCNPJ(watch("cnpj") ?? "")}
              onChange={(e) => {
                setValue("cnpj", formatCNPJ(e.target.value), { shouldValidate: true })
              }}
            />
            {errors.cnpj && <p className="mt-0.5 text-xs text-error-400">{errors.cnpj.message}</p>}
          </div>

          {/* Abreviação + Cor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Abreviação (máx. 4)</label>
              <Input className="h-8" placeholder="Ex: PS" maxLength={4} {...register("abbreviation")} />
              {errors.abbreviation && (
                <p className="mt-0.5 text-xs text-error-400">{errors.abbreviation.message}</p>
              )}
            </div>
            <div>
              <label className={LABEL}>Cor da Marca</label>
              <div className="flex items-center gap-2">
                {/* Native color picker — syncs to text input */}
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(brandColor ?? "") ? (brandColor ?? "#000000") : "#000000"}
                  onChange={(e) => setValue("brand_color", e.target.value, { shouldValidate: true })}
                  className="h-8 w-10 shrink-0 rounded border border-input cursor-pointer p-0.5"
                />
                {/* Hex text input — syncs back to color picker */}
                <Input
                  className="h-8 font-mono text-xs"
                  placeholder="#000000"
                  maxLength={7}
                  {...register("brand_color")}
                />
                {/* Live preview swatch */}
                {/^#[0-9a-fA-F]{6}$/.test(brandColor ?? "") && (
                  <div
                    className="h-8 w-8 shrink-0 rounded border border-border"
                    style={{ backgroundColor: brandColor ?? undefined }}
                  />
                )}
              </div>
              {errors.brand_color && (
                <p className="mt-0.5 text-xs text-error-400">{errors.brand_color.message}</p>
              )}
            </div>
          </div>

          {/* Usa Cilia */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="uses_cilia"
              className="h-4 w-4 rounded border-border"
              {...register("uses_cilia")}
            />
            <label htmlFor="uses_cilia" className="text-sm text-foreground/70">
              Envia orçamentos via sistema Cilia
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-foreground"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editing ? "Salvar" : "Criar Seguradora"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
