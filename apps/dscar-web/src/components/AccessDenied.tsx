import { ShieldAlert } from "lucide-react"

interface AccessDeniedProps {
  message?: string
}

export function AccessDenied({ message = "Você não tem permissão para acessar este recurso." }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">Acesso Negado</h2>
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
    </div>
  )
}
