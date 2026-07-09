import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

// Garante que apenas um signOut seja disparado, mesmo com múltiplas chamadas 401 paralelas
let signingOut = false;

export class ApiError extends Error {
  public status: number;
  public fieldErrors?: Record<string, string[]>;
  public nonFieldErrors?: string[];
  public body?: Record<string, unknown>;

  constructor(message: string, status: number, rawBody?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = rawBody;

    if (rawBody) {
      if (Array.isArray(rawBody.non_field_errors)) {
         this.nonFieldErrors = rawBody.non_field_errors as string[];
      }

      const fields: Record<string, string[]> = {};
      Object.entries(rawBody).forEach(([k, v]) => {
         if (k !== "detail" && k !== "non_field_errors" && Array.isArray(v)) {
           fields[k] = v as string[];
         }
      });
      if (Object.keys(fields).length > 0) {
        this.fieldErrors = fields;
      }
    }
  }
}

export async function apiFetch<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    toast.error("Sem conexão com o servidor");
    throw new Error("network_error");
  }

  if (res.status === 401) {
    // Retry único: o proxy renova a sessão server-side ao consultar auth(),
    // então repetir a request usa o access token já atualizado. Só desloga
    // se o retry também voltar 401 (refresh de fato expirado/revogado).
    await new Promise((r) => setTimeout(r, 300));
    try {
      res = await fetch(input, init);
    } catch {
      toast.error("Sem conexão com o servidor");
      throw new Error("network_error");
    }
    if (res.status === 401) {
      if (!signingOut) {
        signingOut = true;
        toast.error("Sessão expirada. Fazendo logout...");
        // redirect: false evita que o signOut navegue sozinho e causa loop
        // quando o endpoint /api/auth/signout falha
        signOut({ redirect: false }).finally(() => {
          window.location.href = "/login";
        });
      }
      throw new Error("unauthorized");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const e = err as Record<string, unknown>;

    const message =
      (e.detail as string | undefined) ??
      (e.erro as string | undefined) ??
      (e.non_field_errors as string[] | undefined)?.[0] ??
      "Ocorreu um erro na requisição.";
      
    throw new ApiError(message, res.status, e);
  }

  return res.json() as Promise<T>;
}

/**
 * Utilitário para mapear erros disparados pela apiFetch (ApiError) 
 * diretamente para os campos do React Hook Form.
 */
export function handleApiFormError<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>
): void {
  if (error instanceof ApiError) {
    if (error.fieldErrors && setError) {
      Object.entries(error.fieldErrors).forEach(([field, messages]) => {
        setError(field as Path<T>, { type: "server", message: messages[0] });
      });
    } else {
      toast.error(error.message || "Ocorreu um erro inesperado.");
    }
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error("Erro desconhecido.");
  }
}

// ─── DRF Paginated List Helper ───────────────────────────────────────────────

type PaginatedDRF<T> = {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
};

/**
 * Busca lista DRF e extrai .results automaticamente.
 * Aceita tanto resposta paginada quanto array direto.
 * Aceita init opcional (POST, headers, body) — útil pra endpoints de
 * match/search que mandam payload mas retornam lista.
 */
export async function fetchList<T>(url: string, init?: RequestInit): Promise<T[]> {
  const data = await apiFetch<PaginatedDRF<T> | T[]>(url, init);
  if (data && !Array.isArray(data) && "results" in data) return data.results;
  return data as T[];
}
