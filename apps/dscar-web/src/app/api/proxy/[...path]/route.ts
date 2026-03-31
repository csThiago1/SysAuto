import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  const session = await auth();
  const backendUrl = `http://localhost:8000/api/v1/${pathSegments.join("/")}${req.nextUrl.search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // X-Tenant-Domain identifica o tenant para o DevTenantMiddleware no Django.
    // Node.js fetch sobrescreve o header Host com o hostname da URL de destino,
    // por isso usamos um header customizado que o middleware lê como fallback.
    "X-Tenant-Domain": "dscar.localhost",
    ...(session?.accessToken
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {}),
  };

  const body = method !== "GET" ? await req.text() : undefined;

  const response = await fetch(backendUrl, { method, headers, body });
  const data = await response.json().catch(() => ({}));

  return NextResponse.json(data, { status: response.status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  return proxyRequest(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  return proxyRequest(req, path, "POST");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  return proxyRequest(req, path, "PATCH");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  return proxyRequest(req, path, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await params;
  return proxyRequest(req, path, "DELETE");
}
