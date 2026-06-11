import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ plate: string }> }
): Promise<NextResponse> {
  const { plate } = await params
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "")

  if (normalized.length < 7 || normalized.length > 8) {
    return NextResponse.json({ detail: "Placa inválida." }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ detail: "Não autenticado" }, { status: 401 })
  }
  const token = session?.accessToken as string | undefined

  const defaultDomain = process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost"
  const activeCompany = session?.activeCompany ?? ""
  const tenantDomain = activeCompany
    ? `${activeCompany}.${defaultDomain.split(".").slice(1).join(".")}`
    : defaultDomain
  const apiBaseUrl = (
    process.env.BACKEND_URL ??
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  ).replace(/\/$/, "")

  try {
    const res = await fetch(
      `${apiBaseUrl}/api/v1/vehicle-catalog/plate/${normalized}/`,
      {
        headers: {
          "X-Tenant-Domain": tenantDomain,
          "Accept": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(12_000),
      }
    )

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json(
        { detail: (body.detail as string) || "Placa não encontrada." },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error(`[plate] erro ao consultar ${normalized}:`, err)
    return NextResponse.json(
      { detail: "Erro ao consultar placa." },
      { status: 502 }
    )
  }
}
