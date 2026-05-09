/**
 * @paddock/types — Customer
 * Tipo leve para seletores e listas de clientes no frontend.
 */
export interface Customer {
  id: string;
  name: string;
  cpf_cnpj?: string;
  person_id?: string;
  document_masked?: string;
  phone_masked?: string;
}
