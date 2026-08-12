/**
 * Máscaras de entrada — telefone, CPF/CNPJ, CEP, placa, data.
 *
 * REGRA DA CASA: a máscara é APARÊNCIA. O valor guardado e enviado à API é
 * sempre limpo — só dígitos (ou placa sem hífen). O backend indexa `plate` sem
 * separador e normaliza com `.replace("-", "")`; gravar o formatado quebraria
 * a busca por placa. Então: `value={formatX(clean)}` na tela,
 * `onChange={e => setClean(onlyDigits(e.target.value))}` no estado.
 *
 * Elas eram quatro cópias divergentes (masked-input, InsurerDialog,
 * VehiclePlateSearch, PersonFormModal) — e a tela de OS não usava nenhuma.
 */

/** Tudo que não for dígito, fora. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Letras e números, maiúsculo — o "limpo" de placa. */
export function onlyAlnum(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** (92) 99122-2222 — fixo com 10 dígitos vira (92) 3212-2222. */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 123.456.789-00 */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 12.345.678/0001-90 */
export function formatCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Decide pelo comprimento: até 11 dígitos é CPF, acima é CNPJ. */
export function formatCpfCnpj(value: string): string {
  const d = onlyDigits(value);
  return d.length <= 11 ? formatCPF(d) : formatCNPJ(d);
}

/** 69050-000 */
export function formatCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** ABC-1D34 (Mercosul) ou ABC-1234 (antiga) — o hífen cai no mesmo lugar. */
export function formatPlate(value: string): string {
  const p = onlyAlnum(value).slice(0, 7);
  if (p.length <= 3) return p;
  return `${p.slice(0, 3)}-${p.slice(3)}`;
}

/** 31/12/2026 */
export function formatDateBR(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
