# Histórico por Cliente e por Veículo — Design

**Data:** 2026-08-17 · **Status:** aprovado em brainstorming
**Pedido do cliente:** "Controle de OS por cliente e carros por cliente."
**Objetivo:** consultar o histórico de OS de um cliente e de um veículo em um clique,
a partir de qualquer ponto — inclusive de dentro da OS aberta.

## Situação atual

A aba de histórico já existe em `/cadastros/[id]` (`ClientHistoryTab.tsx`): agrega
veículos por placa a partir das OS, calcula total gasto, ticket médio, nº de OS e
"cliente desde", e permite filtrar as OS por placa.

**Ela está com dado errado.** `useClientOrders` chama
`/api/proxy/service-orders/?customer=<id>`, mas `ServiceOrderViewSet`
(`backend/core/apps/service_orders/views/orders.py:167`) não tem `customer` no
`filterset_fields`. `DjangoFilterBackend` ignora parâmetros desconhecidos em silêncio,
então a tela devolve as últimas 100 OS **da oficina inteira**. `plate` também não é
filtrável — só via `search`.

Isso explica o feedback do cliente ("não sabe que existe", "deveria ser mais fácil
verificar"): a tela existe, mas mostra a coisa errada e só é alcançável pelo cadastro.

## Decisões de escopo (aprovadas)

| Decisão | Escolha |
|---|---|
| Cadastro de veículo com dono | **Não.** Histórico continua derivado da OS. `Vehicle.owner` exigiria migrar ~10k OS legadas e modelar troca de dono — fora do que foi pedido |
| Correção do filtro | No `filterset_fields`, não no chamador — qualquer tela que filtre OS por cliente/placa está errada hoje |
| Componente | Um só, parametrizado por cliente **ou** placa; três pontos de entrada |
| Teto de paginação | 200 OS por cliente/veículo, com comentário `ponytail:` marcando o teto |

## 1. Backend — filtros de OS

`backend/core/apps/service_orders/views/orders.py`, `filterset_fields`:

```python
"customer": ["exact"],
"plate": ["exact", "iexact"],
```

Nada mais muda no backend. `VehicleHistoryView`
(`service_orders/views/vehicle_history.py`) continua servindo o autofill por placa na
abertura de OS — é outro caso de uso (resumo do último atendimento), não a listagem.

**Teste:** `test_service_order_filters.py` — cria OS de dois clientes e duas placas,
verifica que `?customer=` e `?plate=` devolvem só as certas. Um teste que hoje falha e
passa depois da mudança.

## 2. Frontend — componente compartilhado

`ClientHistoryTab.tsx` sai de `app/(app)/cadastros/[id]/_components/` para
`src/components/historico/HistoricoAtendimentos.tsx`, com props:

```ts
interface HistoricoAtendimentosProps {
  customerId?: string   // histórico do cliente (todos os veículos dele)
  plate?: string        // histórico do veículo (todos os donos/OS da placa)
}
```

Exatamente um dos dois é obrigatório. A lógica de agregação (KPIs, agrupamento por
placa, filtro) é a que já existe — muda só a origem dos dados.

`useClientOrders` vira `useHistoricoOrders({ customerId, plate })`, montando a query
`?customer=` ou `?plate=` com `page_size=200` e `ordering=-opened_at`.

Quando a busca é por placa, o bloco "Veículos" dá lugar a um bloco "Clientes" (donos
que já trouxeram aquele carro), com a mesma UI de cartão.

## 3. Pontos de entrada

**a) Cadastro do cliente** — `/cadastros/[id]`, aba existente. Só troca o import.

**b) Dentro da OS** — nova seção **"Histórico"** no rail lateral do `OSWorkspaceV2`
(`app/(app)/os/[numero]/_v2/OSWorkspaceV2.tsx`), em `NAV_SECONDARY`, ao lado de
Atividade e Arquivos. Carregada com `lazy()` como as demais. Mostra, para a OS aberta,
duas abas internas: **Este veículo** (`plate={order.plate}`) e **Este cliente**
(`customerId={order.customer}`), com a OS atual destacada na lista.

Este é o "mais fácil de verificar" que o cliente pediu: consultar o passado do carro
sem sair da OS.

**c) Página por placa** — `/veiculos/[placa]/page.tsx`, um arquivo, renderizando
`<HistoricoAtendimentos plate={placa} />` com cabeçalho de veículo. A busca de OS já
aceita placa (`search_fields` inclui `plate`), então o caminho existente
busca → OS → seção Histórico já leva até aqui; a rota dá URL direta e compartilhável.

## Responsividade

O componente segue o padrão do projeto em 390px: KPIs em `grid-cols-2 lg:grid-cols-4`,
cartões de veículo/cliente em coluna única no mobile, lista de OS com rodapé em grid de
colunas fixas (nunca `justify-between`). Testar em 390px antes de mergear.

## Erros e estados

- Sem OS para o cliente/placa: estado vazio com texto único, sem cartões zerados.
- Falha de fetch: `ErrorBoundary` já existente na página de cadastro; na seção da OS,
  mensagem inline com botão de tentar de novo.
- Cliente sem `customer` na OS (OS de seguradora sem `Person` vinculada): a aba
  "Este cliente" fica desabilitada, só "Este veículo" aparece.

## Fora de escopo

- `Vehicle.owner` e histórico de troca de dono.
- Relatório gerencial / exportação de OS por cliente ou por período.
- Alterar `VehicleHistoryView` ou o autofill de placa na abertura de OS.
