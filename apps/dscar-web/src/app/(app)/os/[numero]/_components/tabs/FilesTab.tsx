"use client"

import { useRef, useState } from "react"
import { Camera, CheckCircle2, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Download, Images, Loader2, Plus, RefreshCw, Square, Trash2, Upload } from "lucide-react"
import * as LucideIcons from "lucide-react"
import type { OSPhotoFolder, ServiceOrder, ServiceOrderPhoto } from "@paddock/types"
import { OS_PHOTO_FOLDERS, OS_PHOTO_FOLDER_ORDER } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { usePermission } from "@/hooks/usePermission"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useOSPhotos, useSoftDeletePhoto, useBulkDeletePhotos, useDownloadPhotosZip } from "../../_hooks/useOSItems"
import { useUploadQueue } from "../../_hooks/useUploadQueue"
import { CameraCapture } from "@/components/camera/CameraCapture"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilesTabProps {
  order: ServiceOrder
}

// ─── Upload Dialog ────────────────────────────────────────────────────────────

interface UploadDialogProps {
  orderId: string
  folder: OSPhotoFolder
  onClose: () => void
}

function UploadDialog({ orderId, folder, onClose }: UploadDialogProps) {
  const folderCfg = OS_PHOTO_FOLDERS[folder]
  const { items, enqueue, retry, reset, isUploading, doneCount } = useUploadQueue(orderId, folder)
  const [caption, setCaption] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) enqueue(files, caption)
    e.target.value = "" // permite re-selecionar os mesmos arquivos
  }

  function handleClose() {
    if (isUploading) return
    reset()
    onClose()
  }

  const acceptTypes = folder === "orcamentos" ? "image/*,application/pdf" : "image/*"

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className={cn("px-4 py-3 border-b", folderCfg.bgColor, folderCfg.borderColor)}>
          <div className="flex items-center gap-2">
            <Camera className={cn("h-4 w-4", folderCfg.color)} />
            <DialogTitle className={cn("text-sm", folderCfg.color)}>
              Adicionar fotos — {folderCfg.label}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors hover:opacity-80",
                folderCfg.borderColor,
                folderCfg.bgColor,
              )}
            >
              <Upload className={cn("h-6 w-6", folderCfg.color)} />
              <span className={cn("text-sm font-medium", folderCfg.color)}>Arquivos</span>
              <span className="text-xs text-muted-foreground">seleção múltipla</span>
            </button>
            <button
              onClick={() => setCameraOpen(true)}
              className={cn(
                "h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors hover:opacity-80",
                folderCfg.borderColor,
                folderCfg.bgColor,
              )}
            >
              <Camera className={cn("h-6 w-6", folderCfg.color)} />
              <span className={cn("text-sm font-medium", folderCfg.color)}>Câmera</span>
              <span className="text-xs text-muted-foreground">com marca d&apos;água</span>
            </button>
          </div>

          <Input
            placeholder="Legenda opcional (aplicada às próximas fotos)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />

          {items.length > 0 && (
            <ul className="max-h-52 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
                >
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <Images className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground/80">{item.fileName}</p>
                    {item.error && <p className="truncate text-xs text-error-400">{item.error}</p>}
                  </div>
                  {item.status === "uploading" && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {item.status === "pending" && (
                    <span className="shrink-0 text-xs text-muted-foreground">na fila</span>
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-400" />
                  )}
                  {item.status === "error" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5 text-xs"
                      onClick={() => retry(item.id)}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Reenviar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => enqueue([file], caption)}
            watermarkLines={[`Pasta: ${folderCfg.label}`]}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />
        </div>

        <DialogFooter className="px-4 pb-4">
          {items.length > 0 && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              {doneCount}/{items.length} enviada{items.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button onClick={handleClose} disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              "Concluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────

interface PhotoThumbProps {
  photo: ServiceOrderPhoto
  orderId: string
  canDelete: boolean
  onOpen: () => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
}

function PhotoThumb({
  photo, orderId, canDelete, onOpen, selectionMode, selected, onToggleSelect,
}: PhotoThumbProps) {
  const deleteMutation = useSoftDeletePhoto(orderId)
  const [showDelete, setShowDelete] = useState(false)

  if (!photo.url) return null

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden border aspect-square bg-muted/30",
        selected ? "border-primary ring-2 ring-primary/50" : "border-border",
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        type="button"
        onClick={selectionMode ? onToggleSelect : onOpen}
        className={cn("block h-full w-full", selectionMode ? "cursor-pointer" : "cursor-zoom-in")}
        aria-label={
          selectionMode
            ? (selected ? "Desmarcar foto" : "Selecionar foto")
            : (photo.caption ? `Ampliar: ${photo.caption}` : "Ampliar foto")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || "Foto OS"}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </button>
      {selectionMode && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-background/80 p-0.5 shadow">
          {selected
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <Square className="h-4 w-4 text-foreground/50" />}
        </span>
      )}
      {photo.caption && (
        <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
          <p className="text-xs text-white truncate">{photo.caption}</p>
        </div>
      )}
      {canDelete && showDelete && !selectionMode && (
        <button
          onClick={() => deleteMutation.mutate(photo.id)}
          className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-error-500/20 rounded-full p-1 shadow transition-colors"
          aria-label="Remover foto"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Trash2 className="h-3 w-3 text-error-400" />
          )}
        </button>
      )}
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  photos: ServiceOrderPhoto[]
  index: number
  onNavigate: (index: number) => void
  onClose: () => void
}

function PhotoLightbox({ photos, index, onNavigate, onClose }: LightboxProps) {
  const photo = photos[index]
  if (!photo) return null
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-5xl border-border bg-background/95 p-0 backdrop-blur"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1)
          if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1)
        }}
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-2.5">
          <DialogTitle className="text-sm font-medium text-foreground/80">
            {photo.caption || "Foto da OS"}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {index + 1}/{photos.length}
            </span>
          </DialogTitle>
          <a
            href={photo.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mr-6 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Abrir original
          </a>
        </DialogHeader>

        <div className="relative flex max-h-[75vh] min-h-[320px] items-center justify-center bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url ?? ""}
            alt={photo.caption || "Foto OS"}
            className="max-h-[75vh] w-auto max-w-full object-contain"
          />
          {hasPrev && (
            <button
              type="button"
              onClick={() => onNavigate(index - 1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground/80 transition-colors hover:bg-background"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 text-foreground/80 transition-colors hover:bg-background"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Folder Section ───────────────────────────────────────────────────────────

interface FolderSectionProps {
  folder: OSPhotoFolder
  photos: ServiceOrderPhoto[]
  orderId: string
  isOpen: boolean
  onToggle: () => void
  canUpload: boolean
  canDelete: boolean
  selectionMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (photoId: string) => void
  onSelectFolder: (photoIds: string[]) => void
}

function FolderSection({
  folder, photos, orderId, isOpen, onToggle, canUpload, canDelete,
  selectionMode, selectedIds, onToggleSelect, onSelectFolder,
}: FolderSectionProps) {
  const cfg = OS_PHOTO_FOLDERS[folder]
  const [showUpload, setShowUpload] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const count = photos.length

  const IconComponent =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[cfg.icon]
    ?? Camera

  return (
    <div className={cn("rounded-xl border overflow-hidden", cfg.borderColor)}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 hover:opacity-90 transition-opacity cursor-pointer",
          cfg.bgColor
        )}
      >
        <div className="flex items-center gap-2.5">
          <IconComponent className={cn("h-4 w-4 shrink-0", cfg.color)} />
          <div className="text-left">
            <p className={cn("text-sm font-semibold leading-none", cfg.color)}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-none">{cfg.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {count} {count === 1 ? "foto" : "fotos"}
          </Badge>
          {selectionMode && count > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelectFolder(photos.map((p) => p.id)) }}
              className="text-xs font-semibold px-2 py-1 rounded-md bg-background/70 hover:bg-muted/60 border border-border"
            >
              Selecionar todas
            </button>
          )}
          {canUpload && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowUpload(true) }}
              className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors",
                cfg.color,
                "bg-background/70 hover:bg-muted/60 border border-border"
              )}
            >
              <Plus className="h-3 w-3" />
              Foto
            </button>
          )}
          {isOpen
            ? <ChevronDown className={cn("h-4 w-4", cfg.color)} />
            : <ChevronRight className={cn("h-4 w-4", cfg.color)} />
          }
        </div>
      </div>

      {isOpen && (
        <div className="p-3 bg-muted/50">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Images className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma foto nesta pasta</p>
              {canUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpload(true)}
                  className={cn("mt-1 gap-1.5", cfg.color)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Adicionar primeira foto
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {photos.map((photo, i) => (
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  orderId={orderId}
                  canDelete={canDelete}
                  onOpen={() => setLightboxIndex(i)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(photo.id)}
                  onToggleSelect={() => onToggleSelect(photo.id)}
                />
              ))}
              {canUpload && !selectionMode && (
                <button
                  onClick={() => setShowUpload(true)}
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors hover:opacity-80",
                    cfg.borderColor, cfg.bgColor
                  )}
                >
                  <Plus className={cn("h-5 w-5", cfg.color)} />
                  <span className={cn("text-xs font-medium", cfg.color)}>Foto</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          orderId={orderId}
          folder={folder}
          onClose={() => setShowUpload(false)}
        />
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

// ─── Main FilesTab ────────────────────────────────────────────────────────────

export function FilesTab({ order }: FilesTabProps) {
  const { data: photos = [], isLoading } = useOSPhotos(order.id)
  const isManager = usePermission("MANAGER")
  const bulkDelete = useBulkDeletePhotos(order.id)
  const { download, downloading } = useDownloadPhotosZip(order.id, order.number)

  const [openFolders, setOpenFolders] = useState<Set<OSPhotoFolder>>(
    () => new Set<OSPhotoFolder>(["vistoria_inicial"])
  )
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  function toggleFolder(folder: OSPhotoFolder) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  function selectFolder(photoIds: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = photoIds.every((id) => next.has(id))
      photoIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds))
      exitSelection()
    } catch {
      // toast já exibido no onError do hook
    }
  }

  const canUpload = !["delivered", "cancelled"].includes(order.status)
  const canDelete = canUpload && isManager

  const photosByFolder = OS_PHOTO_FOLDER_ORDER.reduce<Record<string, ServiceOrderPhoto[]>>(
    (acc, f) => {
      acc[f] = photos.filter((p: ServiceOrderPhoto) => p.folder === f && p.is_active)
      return acc
    },
    {}
  )

  const totalPhotos = photos.filter((p: ServiceOrderPhoto) => p.is_active).length
  const foldersWithPhotos = OS_PHOTO_FOLDER_ORDER.filter(
    (f) => (photosByFolder[f]?.length ?? 0) > 0
  ).length
  const selectedCount = selectedIds.size

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5 border border-border">
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <Images className="h-4 w-4 text-muted-foreground" />
          <span>
            <strong className="text-foreground/90">{totalPhotos}</strong>{" "}
            foto{totalPhotos !== 1 ? "s" : ""} em{" "}
            <strong className="text-foreground/90">{foldersWithPhotos}</strong>{" "}
            pasta{foldersWithPhotos !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-1">
          {totalPhotos > 0 && (
            <Button
              variant={selectionMode ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
              {selectionMode ? "Cancelar seleção" : "Selecionar"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setOpenFolders(new Set(OS_PHOTO_FOLDER_ORDER))}
          >
            Expandir tudo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setOpenFolders(new Set())}
          >
            Recolher tudo
          </Button>
        </div>
      </div>

      {/* Folder sections */}
      <div className="space-y-2">
        {OS_PHOTO_FOLDER_ORDER.map((folder) => (
          <FolderSection
            key={folder}
            folder={folder}
            photos={photosByFolder[folder] ?? []}
            orderId={order.id}
            isOpen={openFolders.has(folder)}
            onToggle={() => toggleFolder(folder)}
            canUpload={canUpload && !selectionMode}
            canDelete={canDelete}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectFolder={selectFolder}
          />
        ))}
      </div>

      {/* Barra de ações da seleção */}
      {selectionMode && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <span className="text-sm text-foreground/70">
            <strong className="text-foreground/90">{selectedCount}</strong> selecionada
            {selectedCount !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedCount === 0 || downloading}
              onClick={() => void download(Array.from(selectedIds))}
            >
              {downloading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Baixar ({selectedCount})
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedCount === 0 || bulkDelete.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                {bulkDelete.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Excluir ({selectedCount})
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remover ${selectedCount} foto${selectedCount !== 1 ? "s" : ""}?`}
        description="As fotos saem da galeria, mas permanecem arquivadas como evidência (não são apagadas do storage)."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => void handleBulkDelete()}
      />
    </div>
  )
}
