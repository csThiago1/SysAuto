import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

interface CreateCustomerInput {
  name: string;
  cpf?: string;
  phone: string;
  email?: string;
  lgpd_consent: true;
}

export interface CreatedCustomer {
  id: string;
  name: string;
  cpf_masked: string | null;
  phone_masked: string;
}

export type DRFFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: DRFFieldErrors | null = null,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function createCustomer(data: CreateCustomerInput): Promise<CreatedCustomer> {
  let res: Response;
  try {
    res = await fetch("/api/proxy/customers/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    toast.error("Sem conexão com o servidor");
    throw new ApiError("network_error");
  }

  if (res.status === 401) {
    toast.error("Sessão expirada. Fazendo logout...");
    await signOut({ callbackUrl: "/login" });
    throw new ApiError("unauthorized", null, 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    // DRF field-level errors: { name: ["..."], phone: ["..."] }
    const hasFieldErrors = Object.values(body).some((v) => Array.isArray(v));
    if (hasFieldErrors) {
      throw new ApiError(
        `HTTP ${res.status}`,
        body as DRFFieldErrors,
        res.status
      );
    }
    const message = (body as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new ApiError(message, null, res.status);
  }

  return res.json() as Promise<CreatedCustomer>;
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
