import { signOut } from "next-auth/react";
import { toast } from "sonner";

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
    const message = (err as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
