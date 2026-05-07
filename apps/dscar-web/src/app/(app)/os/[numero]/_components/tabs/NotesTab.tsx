"use client"

import { useState, useEffect } from "react"
import { Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateOSNotes } from "../../_hooks/useOSItems"

interface NotesTabProps {
  orderId?: string
  initialNotes?: string
}

export function NotesTab({ orderId, initialNotes = "" }: NotesTabProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [isDirty, setIsDirty] = useState(false)
  const updateNotes = useUpdateOSNotes(orderId ?? "")

  useEffect(() => {
    setNotes(initialNotes)
    setIsDirty(false)
  }, [initialNotes])

  function handleChange(value: string) {
    setNotes(value)
    setIsDirty(value !== initialNotes)
  }

  async function handleSave() {
    if (!orderId) return
    await updateNotes.mutateAsync(notes)
    setIsDirty(false)
  }

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">Salve a OS antes de adicionar observações.</p>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Observações Gerais</h2>
        <Button
          size="sm"
          disabled={!isDirty || updateNotes.isPending}
          onClick={handleSave}
        >
          {updateNotes.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Salvar
        </Button>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg shadow-sm p-4">
        <Textarea
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          rows={12}
          placeholder="Adicione observações gerais sobre a OS, orientações ao cliente, informações adicionais..."
          className="resize-none border-0 p-0 text-sm text-foreground/70 placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>

      {isDirty && (
        <p className="text-xs text-amber-600">Há alterações não salvas.</p>
      )}
    </div>
  )
}
