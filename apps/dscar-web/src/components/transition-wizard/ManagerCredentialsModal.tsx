"use client"

import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ManagerCredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onEmailChange: (next: string) => void
  password: string
  onPasswordChange: (next: string) => void
  isAuthorizing: boolean
  onAuthorize: () => void
}

/**
 * Modal de credenciais do gerente. Recebe email/senha como controlled props
 * e dispara onAuthorize quando o gerente confirma. Botão "Cancelar" fecha
 * via onOpenChange(false).
 */
export function ManagerCredentialsModal({
  open,
  onOpenChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isAuthorizing,
  onAuthorize,
}: ManagerCredentialsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Credenciais do Gerente</DialogTitle>
          <DialogDescription>
            O gerente deve digitar suas credenciais para autorizar a transição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="manager-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="manager-email"
              type="email"
              autoComplete="username"
              className="mt-1"
              placeholder="gerente@dscar.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="manager-password" className="text-sm font-medium">
              Senha
            </label>
            <Input
              id="manager-password"
              type="password"
              autoComplete="current-password"
              className="mt-1"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!email || !password || isAuthorizing}
            onClick={onAuthorize}
          >
            {isAuthorizing && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            )}
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
