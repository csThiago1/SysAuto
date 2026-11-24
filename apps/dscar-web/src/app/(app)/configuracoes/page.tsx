import { Settings } from "lucide-react"

export const metadata = { title: "Configurações — DS Car" }

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
      <Settings className="h-12 w-12" />
      <h1 className="page-title">Configurações</h1>
      <p className="text-sm">Em breve.</p>
    </div>
  )
}
