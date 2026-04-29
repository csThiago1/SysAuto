import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  const session = await auth();
  const joined = pathSegments.join("/");
  const withSlash = joined.endsWith("/") ? joined : `${joined}/`;
  const backendUrl = `http://localhost:8000/api/v1/${withSlash}${req.nextUrl.search}`;

  const incomingContentType = req.headers.get("Content-Type") ?? ""
  const isMultipart = incomingContentType.startsWith("multipart/form-data")

  // Constrói X-Tenant-Domain dinamicamente a partir da empresa ativa na sessão.
  // Fallback para variável de ambiente DEFAULT_TENANT_DOMAIN ou "dscar.localhost".
  const activeCompany = session?.activeCompany ?? "";
  const tenantDomain = activeCompany
    ? `${activeCompany}.localhost`
    : (process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost");

  const headers: HeadersInit = {
    // Preserva Content-Type do client (multipart ou application/json).
    // Para multipart o browser já inclui o boundary correto — não sobreescrever.
    "Content-Type": isMultipart ? incomingContentType : "application/json",
    // X-Tenant-Domain identifica o tenant para o DevTenantMiddleware no Django.
    // Node.js fetch sobrescreve o header Host com o hostname da URL de destino,
    // por isso usamos um header customizado que o middleware lê como fallback.
    "X-Tenant-Domain": tenantDomain,
    ...(session?.accessToken
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {}),
  };

  // Multipart usa ArrayBuffer para preservar bytes do arquivo intactos
  const body =
    method !== "GET"
      ? isMultipart
        ? await req.arrayBuffer()
        : await req.text()
      : undefined;

  const response = await fetch(backendUrl, { method, headers, body });

  if (!response.ok) {
    // Não logar o body do request — pode conter CPF, email, telefone (LGPD)
    console.error(`[proxy] ${method} ${backendUrl} → ${response.status}`)
  }

  // Passthrough binário para PDF/XML/HTML (não parsear como JSON)
  const contentType = response.headers.get("Content-Type") ?? "";
  const isBinaryPassthrough =
    contentType.includes("application/pdf") ||
    contentType.includes("application/xml") ||
    (contentType.includes("text/html") && response.headers.has("Content-Disposition"));
  if (isBinaryPassthrough) {
    const buf = await response.arrayBuffer();
    return new NextResponse(buf, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": response.headers.get("Content-Disposition") ?? "",
      },
    });
  }

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
