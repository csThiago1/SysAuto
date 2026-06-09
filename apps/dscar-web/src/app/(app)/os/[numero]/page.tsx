import { redirect } from "next/navigation"
import { ServiceOrderForm } from "./_components/ServiceOrderForm"
import { auth } from "@/lib/auth"
import type { ServiceOrder } from "@paddock/types"

interface PageProps {
  params: Promise<{ numero: string }>
}

async function getServiceOrder(numero: string, token: string, tenant: string): Promise<ServiceOrder> {
  const baseUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  const defaultDomain = process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost"
  const domainSuffix = defaultDomain.split(".").slice(1).join(".")
  const res = await fetch(
    `${baseUrl}/api/v1/service-orders/${numero}/`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-Domain": `${tenant}.${domainSuffix}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  )
  if (!res.ok) {
    throw new Error(`OS #${numero} não encontrada (${res.status})`)
  }
  return res.json() as Promise<ServiceOrder>
}

export default async function ServiceOrderPage({ params }: PageProps) {
  const { numero } = await params

  // "nova" não é um número de OS — redireciona para lista com drawer de criação
  if (numero === "nova") {
    redirect("/os?nova=1")
  }

  const session = await auth()
  const token = session?.accessToken ?? ""

  const activeCompany = session?.activeCompany ?? "dscar"
  const order = await getServiceOrder(numero, token, activeCompany)

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <ServiceOrderForm order={order} />
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { numero } = await params
  if (numero === "nova") return { title: "Nova OS — DS Car" }
  return { title: `OS #${numero} — DS Car` }
}
