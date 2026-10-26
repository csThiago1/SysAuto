/**
 * @paddock/utils — Validators
 * Funções puras de validação de documentos brasileiros.
 */

// ─── CPF ─────────────────────────────────────────────────────────────────────

/** Valida CPF com algoritmo oficial (aceita com ou sem máscara) */
export function isValidCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  // Rejeita sequências repetidas (ex: 00000000000)
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9]!)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]!) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]!);
}

// ─── CNPJ ────────────────────────────────────────────────────────────────────

const CNPJ_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Dígito verificador módulo 11; cada caractere vale `ord - 48` (letras A=17 ... Z=42). */
function cnpjDigit(values: number[], weights: number[]): number {
  const rest = values.reduce((sum, v, i) => sum + v * weights[i]!, 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Valida CNPJ numérico ou alfanumérico (mesmo algoritmo do backend), com ou sem máscara. */
export function isValidCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c) || /^(.)\1+$/.test(c)) return false;
  const v = [...c].map((ch) => ch.charCodeAt(0) - 48);
  return (
    cnpjDigit(v.slice(0, 12), CNPJ_WEIGHTS) === v[12] &&
    cnpjDigit(v.slice(0, 13), [6, ...CNPJ_WEIGHTS]) === v[13]
  );
}

// ─── Placa ────────────────────────────────────────────────────────────────────

const PLATE_OLD_RE = /^[A-Z]{3}[0-9]{4}$/i;
const PLATE_NEW_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/i;

/** Valida placa no formato Mercosul ou antigo */
export function isValidPlate(plate: string): boolean {
  const p = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return PLATE_OLD_RE.test(p) || PLATE_NEW_RE.test(p);
}

