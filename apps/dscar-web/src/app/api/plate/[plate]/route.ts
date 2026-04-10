import { NextRequest, NextResponse } from "next/server"

const PLACA_FIPE_URL = "https://placa-fipe.apibrasil.com.br/placa/consulta"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ plate: string }> }
): Promise<NextResponse> {
  const { plate } = await params
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "")

  if (normalized.length < 7 || normalized.length > 8) {
    return NextResponse.json({ detail: "Placa inválida." }, { status: 400 })
  }

  try {
    const res = await fetch(PLACA_FIPE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "*/*" },
      body: JSON.stringify({ placa: normalized }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return NextResponse.json({ detail: "Placa não encontrada." }, { status: 404 })
    }

    const data = await res.json() as Record<string, unknown>

    return NextResponse.json({
      plate: normalized,
      make: (data.marca as string) || "",
      model: (data.modelo as string) || "",
      year: (data.ano as number) ?? null,
      chassis: (data.chassi as string) || "",
      renavam: (data.renavam as string) || "",
      city: (data.municipio as string) || "",
    })
  } catch (err) {
    console.error("[plate] erro ao consultar placa", normalized, err)
    return NextResponse.json(
      { detail: `Erro ao consultar placa: ${String(err)}` },
      { status: 502 }
    )
  }
}
