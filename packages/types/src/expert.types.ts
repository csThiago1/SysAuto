/**
 * @paddock/types — Expert (Perito)
 */

export interface Expert {
  id: string;
  name: string;
  registration_number: string;
  phone: string;
  insurer?: string | null; // FK para Insurer
}
