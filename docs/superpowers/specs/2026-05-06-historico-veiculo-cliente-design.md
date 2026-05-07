# Histórico de Veículo e Cliente

**Data:** 2026-05-06
**Status:** Aprovado
**Escopo:** Histórico do cliente no cadastro + histórico do veículo na OS

---

## Contexto

Hoje os dados do veículo vivem dentro de cada OS (placa, marca, modelo, ano, etc.), sem entidade "Veículo" separada. Não há forma de ver "todas as OS da placa ABC-1234" ou "quanto o cliente X já gastou total". O card de OS no detalhe do cadastro (`/cadastros/[id]`) mostra uma lista simples sem valores ou métricas.

## Decisões de Design

- Não criar modelo novo de Veículo — queries no ServiceOrder por `plate` e `customer`/`customer_uuid` são suficientes
- Histórico do cliente: aba no cadastro (`/cadastros/[id]`)
- Histórico do veículo: Sheet lateral na OS, acessado por botão na VehicleSection
- Lista de OS no histórico do veículo: apenas dados resumidos (número, status, datas, valor), com link para abrir a OS

---

## 1. Histórico do Cliente — Aba no `/cadastros/[id]`

### Reestruturação da página

A página atual tem layout 2 colunas (dados à esquerda, card de OS à direita). Reestruturar para usar **Tabs**:

- **Aba "Dados"** (default) — conteúdo atual: Dados Gerais, Contatos, Endereços
- **Aba "Histórico"** — nova aba com métricas e histórico completo

O card de OS que hoje fica na coluna direita migra para dentro da aba "Histórico" (sem duplicação).

### Aba "Histórico" — Conteúdo

#### 1.1 Cards de Resumo (topo)

4 cards em grid horizontal:

| Card | Valor | Fonte |
|------|-------|-------|
| Total Gasto | Soma de `parts_total + services_total - discount_total` de todas as OS com status `delivered` | Agregação backend |
| Quantidade de OS | Count total de OS do cliente | Agregação backend |
| Ticket Médio | Total gasto / quantidade de OS entregues | Calculado no frontend |
| Cliente Desde | Data da OS mais antiga (`entry_date`) | Agregação backend |

#### 1.2 Seção "Veículos"

Cards agrupados por placa (derivados das OS do cliente):

- **Placa** (destaque)
- **Marca / Modelo / Ano** (dados da OS mais recente daquela placa)
- **Logo do fabricante** (`make_logo`)
- **Quantidade de OS** com aquela placa
- **Total gasto** naquele veículo

Ordenados pela OS mais recente primeiro.

#### 1.3 Seção "Ordens de Serviço"

Lista enriquecida (substitui o card simples atual):

Cada item mostra:
- Número da OS (link para `/os/{numero}`)
- Placa · Marca Modelo
- Status badge
- Data de entrada (`entry_date`)
- Data de entrega (`delivered_at`)
- Valor total da OS

**Filtro por veículo:** dropdown com as placas do cliente para filtrar a lista.

Ordenada da mais recente para a mais antiga.

---

## 2. Histórico do Veículo — Sheet na OS

### Gatilho

Na `VehicleSection` do formulário da OS, botão **"Histórico"** (ícone `History` do lucide) ao lado dos dados do veículo.

**Condição de visibilidade:** só aparece quando a placa está preenchida e existe pelo menos 1 OS anterior (excluindo a OS atual). Caso contrário, não renderiza o botão.

### Sheet (lado direito)

#### 2.1 Header

- Placa (destaque)
- Marca / Modelo / Ano
- Logo do fabricante (`make_logo`)

#### 2.2 Resumo

3 métricas inline:
- Total de OS
- Total gasto
- Primeira visita (data)

#### 2.3 Lista de OS

Cada item:
- **Número da OS** — link clicável para `/os/{numero}` (abre em nova aba)
- **Status badge**
- **Data de entrada** (`entry_date`)
- **Data de entrega** (`delivered_at`, se existir)
- **Valor total** (`parts_total + services_total - discount_total`)

Ordenada da mais recente para a mais antiga.

---

## 3. Backend

### 3.1 Novo endpoint: histórico do veículo

```
GET /api/v1/service-orders/vehicle-history/?plate={plate}&exclude_id={os_id}
```

**Parâmetros:**
- `plate` (obrigatório) — placa do veículo
- `exclude_id` (opcional) — ID da OS atual para excluir da lista

**Resposta:**
```json
{
  "summary": {
    "os_count": 3,
    "total_spent": "8500.00",
    "first_visit": "2025-03-15"
  },
  "results": [
    {
      "id": "uuid",
      "number": 1234,
      "status": "delivered",
      "entry_date": "2026-01-10",
      "delivered_at": "2026-01-25T14:30:00Z",
      "parts_total": "3000.00",
      "services_total": "2500.00",
      "discount_total": "0.00",
      "total": "5500.00",
      "customer_name": "João Silva"
    }
  ]
}
```

**Implementação:** action customizada no `ServiceOrderViewSet` (`@action(detail=False)`), filtrando `ServiceOrder.objects.filter(plate__iexact=plate, is_active=True)` com agregações via `annotate`/`aggregate`.

**Permissão:** `IsConsultantOrAbove` (leitura).

### 3.2 Enriquecer endpoint de OS do cliente

O hook `useClientOrders` já busca as OS de um `person_id`. Enriquecer a resposta da view existente com campos agregados no response:

```json
{
  "summary": {
    "os_count": 5,
    "total_spent": "15000.00",
    "average_ticket": "3000.00",
    "first_os_date": "2025-03-15"
  },
  "results": [...]
}
```

Adicionar os campos `entry_date`, `delivered_at`, `parts_total`, `services_total`, `discount_total` ao serializer de lista se não estiverem presentes.

---

## 4. Frontend — Componentes

### 4.1 Novos componentes

| Componente | Local | Descrição |
|-----------|-------|-----------|
| `ClientHistoryTab` | `cadastros/[id]/_components/` | Aba de histórico com resumo + veículos + OS |
| `ClientSummaryCards` | `cadastros/[id]/_components/` | 4 cards de métricas |
| `ClientVehicleCards` | `cadastros/[id]/_components/` | Grid de veículos agrupados por placa |
| `ClientOrdersList` | `cadastros/[id]/_components/` | Lista enriquecida de OS com filtro por placa |
| `VehicleHistorySheet` | `os/[numero]/_components/` | Sheet lateral com histórico do veículo |

### 4.2 Hooks

| Hook | Descrição |
|------|-----------|
| `useVehicleHistory(plate, excludeId?)` | Busca `vehicle-history/?plate=...&exclude_id=...` |
| `useClientOrders` (existente) | Já existe, será consumido pela aba de histórico |

### 4.3 Modificações em componentes existentes

- **`/cadastros/[id]/page.tsx`** — reestruturar para Tabs (Dados / Histórico), remover card de OS da coluna direita
- **`VehicleSection`** — adicionar botão "Histórico" que abre o `VehicleHistorySheet`

---

## 5. Fora do Escopo

- Criação de modelo/entidade "Veículo" separado
- Histórico de veículo no mobile (futuro)
- Gráficos ou dashboards de tendência
- Exportação de histórico (PDF/Excel)
