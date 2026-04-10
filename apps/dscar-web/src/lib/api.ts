import { signOut } from "next-auth/react";
import { toast } from "sonner";

export class ApiError extends Error {
  public status: number;
  public fieldErrors?: Record<string, string[]>;
  public nonFieldErrors?: string[];

  constructor(message: string, status: number, rawBody?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    
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
    toast.error("Sessão expirada. Fazendo logout...");
    await signOut({ callbackUrl: "/login" });
    throw new Error("unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const e = err as Record<string, unknown>;

    const message =
      (e.detail as string | undefined) ??
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
export function handleApiFormError(error: unknown, setError?: any): void {
  if (error instanceof ApiError) {
    if (error.fieldErrors && setError) {
      Object.entries(error.fieldErrors).forEach(([field, messages]) => {
        setError(field, { type: "server", message: messages[0] });
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
