import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

type DocumentType =
  | 'BUDGET_APPROVAL'
  | 'OS_OPEN'
  | 'OS_DELIVERY'
  | 'COMPLEMENT_APPROVAL'
  | 'INSURANCE_ACCEPTANCE'
  | 'VISTORIA_ENTRADA';

interface CapturePayload {
  service_order_id: number;
  document_type: DocumentType;
  signer_name: string;
  signature_png_base64: string;
  signer_cpf?: string;
  notes?: string;
}

interface CaptureResponse {
  id: number;
  document_type: string;
  signer_name: string;
  signed_at: string;
}

export function useSignatureCapture() {
  return useMutation({
    mutationFn: (payload: CapturePayload) =>
      api.post<CaptureResponse>('/signatures/capture', {
        ...payload,
        method: 'CANVAS_TABLET',
      }),
  });
}
