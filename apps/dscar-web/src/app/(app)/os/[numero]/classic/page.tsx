import { redirect } from "next/navigation"
import { ServiceOrderForm } from "../_components/ServiceOrderForm"
import { auth } from "@/lib/auth"
import type { ServiceOrder } from "@paddock/types"

// ponytail: fallback temporário durante a migração pra v2 — remover
// junto com o ServiceOrderForm shell quando a v2 estabilizar.

interface PageProps {
  params: Promise<{ numero: string }>
}

async function getServiceOrder(numero: string, token: string, tenant: string): Promise<ServiceOrder> {
  const baseUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  const defaultDomain = process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost"
  const domainSuffix = defaultDomain.split(".").slice(1).join(".")
  const res = await fetch(`${baseUrl}/api/v1/service-orders/${numero}/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Domain": `${tenant}.${domainSuffix}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`OS #${numero} não encontrada (${res.status})`)
  }
  return res.json() as Promise<ServiceOrder>
}

export default async function ServiceOrderClassicPage({ params }: PageProps) {
  const { numero } = await params
  if (numero === "nova") redirect("/os?nova=1")

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
  return { title: `OS #${numero} (clássica) — DS Car` }
}
