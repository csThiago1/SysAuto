import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface CreateOSPayload {
  customer_id: number;
  customer_name: string;
  plate: string;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  description?: string;
}

interface CreateOSResponse {
  id: string;
  number: number;
}

export function useCreateOS() {
  const queryClient = useQueryClient();

  return useMutation<CreateOSResponse, Error, CreateOSPayload>({
    mutationFn: async (payload) => {
      const resp = await apiFetch<CreateOSResponse>("/api/proxy/service-orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return resp;
    },
    onSuccess: (data) => {
      // Invalidate service orders queries to refresh Kanbans/Tables
      void queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao abrir Ordem de Serviço.");
    },
  });
}
