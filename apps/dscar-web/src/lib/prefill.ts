import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form"

/** Vazio para o pré-preenchimento: o usuário ainda não escolheu nada. */
function isEmpty(v: unknown): boolean {
  return v === "" || v === null || v === undefined || v === "NAO_INFORMADA"
}

/** Preenche só os campos vazios do form; o que preencher fica dirty (vai no PATCH). */
export function applyIfEmpty<T extends FieldValues>(
  form: UseFormReturn<T>,
  values: Partial<Record<Path<T>, unknown>>,
): void {
  // Lê o proxy para o RHF passar a rastrear dirty mesmo se a tela ainda não leu dirtyFields;
  // sem isso o que foi preenchido não entra no PATCH (Review Focus 4).
  void form.formState.dirtyFields
  for (const [name, v] of Object.entries(values) as [Path<T>, unknown][]) {
    if (isEmpty(v) || !isEmpty(form.getValues(name))) continue
    form.setValue(name, v as PathValue<T, Path<T>>, { shouldDirty: true })
  }
}

/** Mesma regra para estado em useState: devolve cópia com só os vazios preenchidos. */
export function fillEmpty<T extends Record<string, unknown>>(current: T, values: Partial<T>): T {
  const out = { ...current }
  for (const k of Object.keys(values) as (keyof T)[]) {
    const v = values[k]
    if (v !== undefined && !isEmpty(v) && isEmpty(out[k])) out[k] = v
  }
  return out
}

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()

/**
 * {cidade, UF, código IBGE} são um grupo só (o IBGE vai para a NFS-e): preenche os três
 * juntos, e só se o IBGE está vazio e cidade/UF estão vazias ou já batem com a consulta.
 * Caso contrário devolve {} e o grupo fica como o usuário deixou.
 */
export function locationGroup(
  cur: { city?: string | null; state?: string | null; municipio_ibge?: string | null },
  municipio: { id: string; label: string } | null | undefined,
  uf: string | null | undefined,
): { city: string; state: string; municipio_ibge: string } | Record<string, never> {
  if (!municipio || !uf || !isEmpty(cur.municipio_ibge)) return {}
  const same = (a: string | null | undefined, b: string): boolean => isEmpty(a) || norm(a ?? "") === norm(b)
  if (!same(cur.city, municipio.label) || !same(cur.state, uf)) return {}
  return { city: municipio.label, state: uf, municipio_ibge: municipio.id }
}
