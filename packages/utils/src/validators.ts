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

/** Valida CNPJ com algoritmo oficial (aceita com ou sem máscara) */
export function isValidCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calc = (d: string, len: number): number => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(d[len - i]!) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  return calc(d, 12) === parseInt(d[12]!) && calc(d, 13) === parseInt(d[13]!);
}

// ─── Placa ────────────────────────────────────────────────────────────────────

const PLATE_OLD_RE = /^[A-Z]{3}[0-9]{4}$/i;
const PLATE_NEW_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/i;

/** Valida placa no formato Mercosul ou antigo */
export function isValidPlate(plate: string): boolean {
  const p = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return PLATE_OLD_RE.test(p) || PLATE_NEW_RE.test(p);
}

/** Normaliza placa: remove caracteres extras e converte para maiúsculas */
export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

// ─── Telefone ────────────────────────────────────────────────────────────────

/** Valida telefone brasileiro (10 ou 11 dígitos) */
export function isValidPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}
