import { NewOSForm } from "./_components/NewOSForm"

export default function NewServiceOrderPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Nova Ordem de Serviço</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Preencha os dados essenciais — os demais campos ficam disponíveis após a criação.
        </p>
      </div>
      <NewOSForm />
    </div>
  )
}

export const metadata = { title: "Nova OS — DS Car" }
