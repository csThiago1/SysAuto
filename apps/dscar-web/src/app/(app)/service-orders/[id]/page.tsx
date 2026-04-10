import { ServiceOrderForm } from "./_components/ServiceOrderForm"
import { apiFetch } from "@/lib/api"
import { auth } from "@/lib/auth"
import type { ServiceOrder } from "@paddock/types"

interface PageProps {
  params: Promise<{ id: string }>
}

async function getServiceOrder(id: string, token: string): Promise<ServiceOrder> {
  return apiFetch<ServiceOrder>(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/service-orders/${id}/`,
    { headers: { Authorization: `Bearer ${token}`, "X-Tenant-Domain": "dscar.localhost" } }
  )
}

export default async function ServiceOrderPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  const token = session?.accessToken ?? ""

  const order = await getServiceOrder(id, token)

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <ServiceOrderForm order={order} />
    </div>
  )
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return { title: `OS #${id} — DS Car` }
}
