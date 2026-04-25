/**
 * @paddock/types — Expert (Perito / Especialista)
 */

export interface Expert {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes?: string;
  registration_number: string;
  insurer_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
