"use client"

import { useRef, useState } from "react"
import { Camera, ChevronDown, ChevronRight, Images, Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import * as LucideIcons from "lucide-react"
import type { OSPhotoFolder, ServiceOrder, ServiceOrderPhoto } from "@paddock/types"
import { OS_PHOTO_FOLDERS, OS_PHOTO_FOLDER_ORDER } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useOSPhotos, useSoftDeletePhoto, useUploadPhoto } from "../../_hooks/useOSItems"

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
  const uploadMutation = useUploadPhoto(orderId)
  const [caption, setCaption] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  function handleSubmit() {
    if (!selectedFile) return
    const fd = new FormData()
    fd.append("file", selectedFile)
    fd.append("folder", folder)
    if (caption) fd.append("caption", caption)
    uploadMutation.mutate(fd, { onSuccess: () => onClose() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={cn("flex items-center justify-between px-4 py-3 border-b", folderCfg.bgColor, folderCfg.borderColor)}>
          <div className="flex items-center gap-2">
            <Camera className={cn("h-4 w-4", folderCfg.color)} />
            <span className={cn("text-sm font-semibold", folderCfg.color)}>
              Adicionar foto — {folderCfg.label}
            </span>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
              <button
                onClick={() => { setSelectedFile(null); setPreview(null) }}
                className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-1 shadow"
              >
                <X className="h-3 w-3 text-neutral-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full h-36 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80",
                folderCfg.borderColor,
                folderCfg.bgColor,
              )}
            >
              <Upload className={cn("h-8 w-8", folderCfg.color)} />
              <span className={cn("text-sm font-medium", folderCfg.color)}>
                Clique para selecionar foto
              </span>
              <span className="text-xs text-neutral-400">JPG, PNG ou WEBP</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <Input
            placeholder="Legenda opcional..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-4 pb-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="h-4 w-4 mr-1.5" /> Enviar</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Photo Thumbnail ──────────────────────────────────────────────────────────

interface PhotoThumbProps {
  photo: ServiceOrderPhoto
  orderId: string
  canDelete: boolean
}

function PhotoThumb({ photo, orderId, canDelete }: PhotoThumbProps) {
  const deleteMutation = useSoftDeletePhoto(orderId)
  const [showDelete, setShowDelete] = useState(false)

  if (!photo.url) return null

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-neutral-200 aspect-square bg-neutral-50"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "Foto OS"}
        className="w-full h-full object-cover"
      />
      {photo.caption && (
        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
          <p className="text-[10px] text-white truncate">{photo.caption}</p>
        </div>
      )}
      {canDelete && showDelete && (
        <button
          onClick={() => deleteMutation.mutate(photo.id)}
          className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-red-50 rounded-full p-1 shadow transition-colors"
          title="Remover foto"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
          ) : (
            <Trash2 className="h-3 w-3 text-red-500" />
          )}
        </button>
      )}
    </div>
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
}

function FolderSection({ folder, photos, orderId, isOpen, onToggle, canUpload }: FolderSectionProps) {
  const cfg = OS_PHOTO_FOLDERS[folder]
  const [showUpload, setShowUpload] = useState(false)
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
            <p className="text-[11px] text-neutral-500 mt-0.5 leading-none">{cfg.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {count} {count === 1 ? "foto" : "fotos"}
          </Badge>
          {canUpload && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowUpload(true) }}
              className={cn(
                "flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors",
                cfg.color,
                "bg-white/80 hover:bg-white border border-neutral-200"
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
        <div className="p-3 bg-white">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <Images className="h-8 w-8 text-neutral-200" />
              <p className="text-sm text-neutral-400">Nenhuma foto nesta pasta</p>
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
              {photos.map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  orderId={orderId}
                  canDelete={canUpload}
                />
              ))}
              {canUpload && (
                <button
                  onClick={() => setShowUpload(true)}
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors hover:opacity-80",
                    cfg.borderColor, cfg.bgColor
                  )}
                >
                  <Plus className={cn("h-5 w-5", cfg.color)} />
                  <span className={cn("text-[10px] font-medium", cfg.color)}>Foto</span>
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
    </div>
  )
}

// ─── Main FilesTab ────────────────────────────────────────────────────────────

export function FilesTab({ order }: FilesTabProps) {
  const { data: photos = [], isLoading } = useOSPhotos(order.id)

  const [openFolders, setOpenFolders] = useState<Set<OSPhotoFolder>>(
    () => new Set<OSPhotoFolder>(["vistoria_inicial"])
  )

  function toggleFolder(folder: OSPhotoFolder) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  const canUpload = !["delivered", "cancelled"].includes(order.status)

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-neutral-50 rounded-lg px-4 py-2.5 border border-neutral-200">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Images className="h-4 w-4 text-neutral-400" />
          <span>
            <strong className="text-neutral-800">{totalPhotos}</strong>{" "}
            foto{totalPhotos !== 1 ? "s" : ""} em{" "}
            <strong className="text-neutral-800">{foldersWithPhotos}</strong>{" "}
            pasta{foldersWithPhotos !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-1">
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
            canUpload={canUpload}
          />
        ))}
      </div>
    </div>
  )
}
