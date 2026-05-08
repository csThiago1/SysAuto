import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CreateCustomerPayload {
  name: string;
  cpf?: string;
  phone: string;
  email?: string;
  lgpd_consent: boolean;
}

interface CustomerResponse {
  id: string;
  name: string;
  cpf_masked: string | null;
  phone_masked: string;
}

export function useCreateCustomer() {
  return useMutation<CustomerResponse, Error, CreateCustomerPayload>({
    mutationFn: (payload) =>
      api.post<CustomerResponse>('/customers', payload),
  });
}
