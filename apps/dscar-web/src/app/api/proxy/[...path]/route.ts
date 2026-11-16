import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

async function proxyRequest(
  req: NextRequest,
  pathSegments: string[],
  method: string,
  session: Session | null
): Promise<NextResponse> {
  if (pathSegments.some((s) => s.includes("..") || s.startsWith("/"))) {
    return NextResponse.json({ detail: "Path inválido" }, { status: 400 });
  }
  const joined = pathSegments.join("/");
  const withSlash = joined.endsWith("/") ? joined : `${joined}/`;
  const backendUrl = `${BACKEND_BASE}/api/v1/${withSlash}${req.nextUrl.search}`;

  const incomingContentType = req.headers.get("Content-Type") ?? ""
  const isMultipart = incomingContentType.startsWith("multipart/form-data")

  // Constrói X-Tenant-Domain a partir da empresa ativa na sessão.
  // DEFAULT_TENANT_DOMAIN define o sufixo (ex: "dscar.localhost" em dev, "dscar.paddock.solutions" em prod).
  const defaultDomain = process.env.DEFAULT_TENANT_DOMAIN ?? "dscar.localhost";
  const activeCompany = session?.activeCompany ?? "";
  const tenantDomain = activeCompany
    ? `${activeCompany}.${defaultDomain.split(".").slice(1).join(".")}`
    : defaultDomain;

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(backendUrl, { method, headers, body, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ detail: "Backend timeout" }, { status: 504 })
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    // Não logar o body do request — pode conter CPF, email, telefone (LGPD)
    // Mas logar o body da RESPOSTA de erro (contém nomes de campo, não PII)
    const errBody = await response.clone().json().catch(() => null)
    // Defesa extra: sem query string (busca por chassi, placa, nome) e nada de lookups/ no log
    const logUrl = backendUrl
      .split("?")[0]
      .replace(/\/api\/v1\/lookups\/.*$/, "/api/v1/lookups/<redacted>")
    console.error(`[proxy] ${method} ${logUrl} → ${response.status}`, errBody)
  }

  // Passthrough binário para PDF/XML/HTML (não parsear como JSON)
  const contentType = response.headers.get("Content-Type") ?? "";
  const isBinaryPassthrough =
    contentType.includes("application/pdf") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/zip") ||
    contentType.includes("application/octet-stream") ||
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

  // 204 No Content — não pode ter body (DELETE do DRF)
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}

/**
 * Handlers embrulhados em auth(): quando o callback jwt renova o token, o
 * wrapper devolve o cookie novo na resposta. Com `await auth()` solto o
 * next-auth descartava o Set-Cookie — o backend já tinha girado o refresh,
 * o cookie ficava com o token revogado e a sessão caía na renovação seguinte.
 */
function handler(method: string) {
  return auth(async (req, ctx) => {
    const { path } = (await ctx.params) as { path: string[] };
    // NextAuthRequest vem tipado contra outra cópia do `next` (mesmo cast do middleware)
    return proxyRequest(req as unknown as NextRequest, path, method, req.auth);
  });
}

export const GET = handler("GET");
export const POST = handler("POST");
export const PATCH = handler("PATCH");
export const PUT = handler("PUT");
export const DELETE = handler("DELETE");
