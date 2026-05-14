# Parts Catalog — Frontend Integration Spec

**Date:** 2026-05-14
**Goal:** Integrar o catálogo shared de peças (19k+ referências) no frontend do ERP, com autocomplete no CompraFormModal e fallback com compatibilidade veicular no EstoqueBuscaModal.

---

## Decisões de design

1. **Onde:** Autocomplete no CompraFormModal + fallback no EstoqueBuscaModal
2. **CompraFormModal:** Preenche campos + mostra card de contexto (categoria, fornecedores, aplicação veicular)
3. **EstoqueBuscaModal fallback:** Quando estoque retorna vazio, mostra resultados do catálogo em duas seções — "Compatíveis com [veículo]" em cima, "Outros" embaixo. Ao selecionar, redireciona pro CompraFormModal pré-preenchido.
4. **Compatibilidade:** Filtro no backend via query params `vehicle_make` e `vehicle_model`, retorna `is_compatible` annotado em cada resultado.

---

## 1. Backend — Endpoint com filtro de compatibilidade

### Alteração em `PartReferenceViewSet`

Adicionar query params opcionais `vehicle_make` e `vehicle_model` ao list action. Quando presentes:

- Annotate cada resultado com `is_compatible` (boolean) via `Exists(PartApplication.objects.filter(part_ref=OuterRef('pk'), make_id=vehicle_make))`
- Se `vehicle_model` também informado, filtrar por model também
- Ordenar: compatíveis primeiro (`-is_compatible`), depois por `description`

### Alteração no serializer

Adicionar campo condicional `is_compatible` ao `PartReferenceListSerializer`:

```python
is_compatible = serializers.BooleanField(read_only=True, default=False)
```

O campo só existe quando o queryset tem a annotation (quando vehicle_make está nos params).

### Incluir applications e suppliers no list quando vehicle_make presente

Quando `vehicle_make` está nos params, incluir `applications` e `suppliers` no list serializer (usar o DetailSerializer). Isso evita N+1 requests do frontend pra montar o card de contexto.

### Exemplo de request/response

```
GET /api/v1/parts-catalog/references/?search=para-choque&vehicle_make=23

{
  "count": 42,
  "results": [
    {
      "id": "uuid-1",
      "manufacturer_code": "52058207",
      "description": "PARA-CHOQUE DIANTEIRO",
      "category": 1,
      "category_name": "Carroceria",
      "ncm": "87081000",
      "unit": "PC",
      "is_compatible": true,
      "applications": [
        {"make": 23, "make_nome": "GM - Chevrolet", "model": 456, "model_nome": "ONIX", "year_start": 2020, "year_end": 2024, ...}
      ],
      "suppliers": [
        {"supplier_name": "PMZ DISTRIBUIDORA", "supplier_code": ""},
        {"supplier_name": "FORTBRAS", "supplier_code": ""}
      ]
    },
    {
      "id": "uuid-2",
      "manufacturer_code": "86610BX000",
      "description": "PARA-CHOQUE TRASEIRO",
      "is_compatible": false,
      "applications": [],
      "suppliers": [{"supplier_name": "JG RODRIGUES", "supplier_code": ""}]
    }
  ]
}
```

---

## 2. Frontend — Tipos

### `packages/types/src/parts-catalog.types.ts`

```typescript
export interface PartCatalogApplication {
  id: string
  make: number
  make_nome: string
  model: number | null
  model_nome: string | null
  year_start: number | null
  year_end: number | null
  source: "seed" | "os_auto" | "api_external" | "manual"
  confidence_score: number
}

export interface PartCatalogSupplier {
  id: string
  supplier_name: string
  supplier_code: string
}

export interface PartCatalogCategory {
  id: number
  code: string
  name: string
}

export interface PartCatalogReference {
  id: string
  manufacturer_code: string
  description: string
  description_original: string
  category: number
  category_name: string
  ncm: string
  unit: string
  ean: string
  is_active: boolean
  is_compatible?: boolean
  applications?: PartCatalogApplication[]
  suppliers?: PartCatalogSupplier[]
}
```

---

## 3. Frontend — Hook `usePartsCatalog`

### `apps/dscar-web/src/hooks/usePartsCatalog.ts`

```typescript
export function usePartsCatalog(params?: {
  search?: string
  vehicle_make?: string | number
  vehicle_model?: string | number
  category?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set("search", params.search)
  if (params?.vehicle_make) searchParams.set("vehicle_make", String(params.vehicle_make))
  if (params?.vehicle_model) searchParams.set("vehicle_model", String(params.vehicle_model))
  if (params?.category) searchParams.set("category", String(params.category))

  const qs = searchParams.toString()

  return useQuery<PartCatalogReference[]>({
    queryKey: ["parts-catalog", "references", params],
    queryFn: () => fetchList<PartCatalogReference>(`/api/proxy/parts-catalog/references/?${qs}`),
    enabled: !!params?.search && params.search.length >= 2,
    staleTime: 60_000, // 1min — catálogo muda raramente
  })
}
```

Usar `fetchList` (helper DRF que extrai `.results` de paginação).

---

## 4. Componente: `CatalogSearchCombobox`

### Local: `apps/dscar-web/src/components/purchasing/CatalogSearchCombobox.tsx`

**Props:**
```typescript
interface CatalogSearchComboboxProps {
  vehicleMakeId?: number | string  // da OS atual
  vehicleModelId?: number | string
  onSelect: (ref: PartCatalogReference) => void
  placeholder?: string
}
```

**Comportamento:**
- Input de texto com debounce (300ms)
- Após 2 chars, chama `usePartsCatalog({ search, vehicle_make, vehicle_model })`
- Dropdown popover abaixo do input com resultados
- Cada item mostra: `manufacturer_code — description` + badge verde "Compatível" se `is_compatible`
- Compatíveis primeiro na lista
- Ao clicar, chama `onSelect(ref)` e fecha o dropdown
- Loading spinner enquanto busca
- "Nenhum resultado" quando vazio
- Não bloqueia digitação livre — se o usuário não selecionar, o texto fica como está

**UI:** Usar shadcn Popover + Command (combobox pattern) ou um simples div posicionado com resultados. Manter consistência com o projeto (que usa componentes simples, não Combobox complexo).

---

## 5. Componente: `CatalogContextCard`

### Local: `apps/dscar-web/src/components/purchasing/CatalogContextCard.tsx`

**Props:**
```typescript
interface CatalogContextCardProps {
  reference: PartCatalogReference
}
```

**Renderiza** (quando uma peça do catálogo é selecionada no CompraFormModal):

```
┌─────────────────────────────────────────────────────┐
│ 📦 Catálogo: 52058207                                │
│                                                      │
│ Categoria: Carroceria          NCM: 87081000         │
│                                                      │
│ Fornecedores: PMZ DISTRIBUIDORA · FORTBRAS           │
│                                                      │
│ ✅ Compatível: GM - Chevrolet ONIX (2020–2024)       │
│               (ou "Sem dados de compatibilidade")    │
└─────────────────────────────────────────────────────┘
```

- Background `bg-muted/50`, borda `border-border`, texto `text-foreground/70`
- Badge verde "Compatível" se tem aplicação para o veículo da OS
- Lista fornecedores separados por `·`
- Se não tem aplicação: "Sem dados de compatibilidade" em texto neutro
- Botão X no canto para dispensar o card (e limpar a seleção do catálogo)

---

## 6. Componente: `CatalogFallbackSection`

### Local: `apps/dscar-web/src/components/purchasing/CatalogFallbackSection.tsx`

**Props:**
```typescript
interface CatalogFallbackSectionProps {
  searchTerm: string
  vehicleMakeId?: number | string
  vehicleModelId?: number | string
  vehicleLabel: string  // ex: "Onix 2021"
  onSelect: (ref: PartCatalogReference) => void
}
```

**Renderiza** dentro do EstoqueBuscaModal, abaixo dos resultados de estoque:

- Header: "Resultados do catálogo" com ícone de catálogo
- Usa `usePartsCatalog({ search: searchTerm, vehicle_make, vehicle_model })`
- Divide resultados em dois grupos:
  - **"Compatíveis com {vehicleLabel}"** — `is_compatible === true`, badge verde
  - **"Outros resultados"** — restante, sem badge
- Cada item: `código | descrição | categoria | fornecedores`
- Ao clicar: chama `onSelect(ref)`
- Esconde a seção se o catálogo também retorna 0 resultados

---

## 7. Alteração: `CompraFormModal`

### Mudanças no modal existente:

1. **Substituir input "Descrição"** por `CatalogSearchCombobox` no topo
2. **Novo state:** `selectedCatalogRef: PartCatalogReference | null`
3. **Quando `onSelect` é chamado:**
   - `setDescription(ref.description)`
   - `setPartNumber(ref.manufacturer_code)`
   - `setSelectedCatalogRef(ref)`
4. **Mostrar `CatalogContextCard`** abaixo dos campos quando `selectedCatalogRef !== null`
5. **Usuário pode limpar** a seleção e digitar manualmente (card desaparece)
6. **Não mudar nada no submit** — os mesmos campos são enviados (description, part_number, etc.)

### Aceitar pre-fill de props (para fluxo do fallback):

```typescript
interface CompraFormModalProps {
  // ... existing props ...
  prefill?: {
    description?: string
    partNumber?: string
    catalogRef?: PartCatalogReference
  }
}
```

Quando `prefill` é passado, inicializar os states com os valores.

---

## 8. Alteração: `EstoqueBuscaModal`

### Mudanças no modal existente:

1. **Novo state:** `showCompraModal: boolean`, `compraModalPrefill: {...}`
2. **Quando estoque retorna 0 resultados** (ou `data.length === 0`):
   - Mostrar `CatalogFallbackSection` abaixo da mensagem "Nenhuma peça encontrada"
   - Passar `searchTerm`, `vehicleMakeId`, `vehicleModelId`, `vehicleLabel` da OS
3. **Quando usuário seleciona peça do catálogo** (`onSelect`):
   - Fechar EstoqueBuscaModal
   - Abrir CompraFormModal com `prefill` contendo description, partNumber, catalogRef
4. **Dialog encadeado:** EstoqueBuscaModal fecha → CompraFormModal abre. Usar callback no parent (PartsTab).

### Alteração no PartsTab:

Novo handler no PartsTab que recebe a seleção do catálogo e abre o CompraFormModal:

```typescript
const handleCatalogSelect = (ref: PartCatalogReference) => {
  setEstoqueModalOpen(false)
  setCompraModalPrefill({
    description: ref.description,
    partNumber: ref.manufacturer_code,
    catalogRef: ref,
  })
  setCompraModalOpen(true)
}
```

---

## 9. Arquivos por task

| Task | Arquivos | Tipo |
|------|----------|------|
| Backend: filtro compatibilidade | `views.py`, `serializers.py` | Modify |
| Types | `packages/types/src/parts-catalog.types.ts` | Create |
| Hook | `hooks/usePartsCatalog.ts` | Create |
| CatalogSearchCombobox | `components/purchasing/CatalogSearchCombobox.tsx` | Create |
| CatalogContextCard | `components/purchasing/CatalogContextCard.tsx` | Create |
| CatalogFallbackSection | `components/purchasing/CatalogFallbackSection.tsx` | Create |
| CompraFormModal integration | `components/purchasing/CompraFormModal.tsx` | Modify |
| EstoqueBuscaModal + PartsTab | `EstoqueBuscaModal.tsx`, `PartsTab.tsx` | Modify |
