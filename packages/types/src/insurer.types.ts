/**
 * @paddock/types — Insurer (Seguradora pública)
 * Entidade do schema público (compartilhada entre todos os tenants).
 */

/** Retornada pelo InsurerMinimalSerializer (list e nested em OS). */
export interface Insurer {
  id: string;
  code: string | null;   // código interno (porto, azul...); null em seguradora sem seed
  cnpjs: string[];       // todos os CNPJs, só dígitos, incluindo o principal
  name: string;
  trade_name: string;
  cnpj: string;
  abbreviation: string;
  brand_color: string;   // hex, ex: "#E8092E"
  logo: string | null;   // URL resolvida (logo_url ou fallback Person)
  logo_url: string;      // URL armazenada no campo Insurer.logo_url
  display_name: string;  // trade_name ou name
  uses_cilia: boolean;
  is_active: boolean;
}

/** Retornada pelo InsurerSerializer (create/update/retrieve). */
export interface InsurerFull {
  id: string;
  code: string | null;
  name: string;
  trade_name: string;
  trade_names: string[]; // nomes que as importações usam para esta seguradora
  cnpj: string;
  cnpjs: string[];       // todos os CNPJs, só dígitos, incluindo o principal
  susep_code: string | null;
  abbreviation: string;
  brand_color: string;
  logo_url: string;
  is_active: boolean;
  uses_cilia: boolean;
}
