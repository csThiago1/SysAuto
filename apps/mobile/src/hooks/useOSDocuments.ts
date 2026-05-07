import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { API_BASE_URL, getTenantDomain } from '@/lib/constants';

interface OSDocument {
  id: string;
  document_type: string;
  document_type_display: string;
  version: number;
  download_url: string;
  file_size_bytes: number;
  generated_by_name: string;
  generated_at: string;
}

type GenerateDocType = 'os_report' | 'warranty' | 'settlement' | 'receipt';

export function useOSDocuments(osId: string) {
  const queryClient = useQueryClient();

  const documents = useQuery<OSDocument[]>({
    queryKey: ['os-documents', osId],
    queryFn: () => api.get<OSDocument[]>(`/documents/os/${osId}/history`),
    enabled: !!osId,
  });

  const generate = useMutation({
    mutationFn: (docType: GenerateDocType) =>
      api.post<OSDocument>(`/documents/os/${osId}/generate`, {
        document_type: docType,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['os-documents', osId] });
    },
  });

  return {
    documents: documents.data ?? [],
    isLoading: documents.isLoading,
    refetch: documents.refetch,
    generateDocument: generate.mutateAsync,
    isGenerating: generate.isPending,
  };
}

export async function downloadAndSharePdf(
  downloadUrl: string,
  fileName: string,
): Promise<void> {
  const { token, activeCompany } = useAuthStore.getState();

  const localUri = `${FileSystem.cacheDirectory}${fileName}.pdf`;

  await FileSystem.downloadAsync(
    `${API_BASE_URL}${downloadUrl}`,
    localUri,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Domain': getTenantDomain(activeCompany),
      },
    },
  );

  await Sharing.shareAsync(localUri, {
    mimeType: 'application/pdf',
    dialogTitle: fileName,
  });
}
