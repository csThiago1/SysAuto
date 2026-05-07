import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, getTenantDomain } from '@/lib/constants';
import { api } from '@/lib/api';

interface EmployeeProfile {
  id: string;
  signature_url: string | null;
}

export function useEmployeeSignature() {
  const queryClient = useQueryClient();

  const profile = useQuery<EmployeeProfile>({
    queryKey: ['employee', 'me'],
    queryFn: () => api.get<EmployeeProfile>('/hr/employees/me'),
  });

  const upload = useMutation({
    mutationFn: async (base64Png: string) => {
      const { token, activeCompany } = useAuthStore.getState();
      const employeeId = profile.data?.id;
      if (!employeeId) throw new Error('Employee ID not available');

      const formData = new FormData();
      formData.append('signature_image', {
        uri: `data:image/png;base64,${base64Png}`,
        type: 'image/png',
        name: 'signature.png',
      } as unknown as Blob);

      const url = `${API_BASE_URL}/api/v1/hr/employees/${employeeId}/upload-signature/`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Domain': getTenantDomain(activeCompany),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return response.json() as Promise<EmployeeProfile>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employee', 'me'] });
    },
  });

  return {
    signatureUrl: profile.data?.signature_url ?? null,
    isLoading: profile.isLoading,
    uploadSignature: upload.mutateAsync,
    isUploading: upload.isPending,
  };
}
