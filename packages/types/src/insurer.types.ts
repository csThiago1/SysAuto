/**
 * @paddock/types — Insurer (Seguradora pública)
 * Entidade do schema público (compartilhada entre todos os tenants).
 */

export interface Insurer {
  id: string;
  name: string;
  trade_name: string;
  abbreviation: string;
  brand_color: string;  // hex, ex: "#E8092E"
  logo: string | null;  // URL da logo
  display_name: string; // trade_name ou name
  uses_cilia?: boolean;
}
