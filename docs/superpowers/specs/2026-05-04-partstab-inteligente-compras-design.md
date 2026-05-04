# PartsTab Inteligente + Módulo de Compras

**Data:** 2026-05-04
**Módulo:** `apps.service_orders` (PartsTab reescrita) + `apps.purchasing` (novo app)
**Escopo:** Redesign da aba Peças da OS com integração ao estoque, pedido de compra automático, ordem de compra com aprovação financeira, tipagem de peça, e análise de margem inline.

---

## 1. Contexto e Problema

### 1.1 — Situação atual
- PartsTab é um formulário inline manual: consultor digita descrição, código, preço, quantidade
- Zero integração com estoque — não sabe se a peça está disponível
- Zero integração com compras — se não tem, avisa verbalmente o setor de compras
- Sem tipagem (genuína, reposição, usada)
- Sem visibilidade de custo real vs valor cobrado (margem)

### 1.2 — O que o usuário precisa
- **Consultor:** adicionar peça na OS sabendo se tem em estoque, e se não tem, gerar pedido de compra automaticamente
- **Setor de Compras:** receber pedidos, cotar via WhatsApp, montar Ordem de Compra com fornecedor e valores
- **Financeiro:** ver OC completa da OS (todos os fornecedores) e aprovar/rejeitar
- **Todos:** ver status de cada peça em tempo real na OS

### 1.3 — Fluxos reais da DS Car

**Fluxo A — Peça em estoque:**
```
Consultor busca na OS → Tem em estoque → Seleciona → Bloqueia imediatamente
```

**Fluxo B — Precisa comprar:**
```
Consultor solicita na OS → Pedido de Compra criado → Compras cota → Monta OC → Financeiro aprova → Peça comprada → Chega → Entrada no estoque → Vincula à OS → Bloqueada
```

**Fluxo C — Seguradora fornece:**
```
Consultor registra na OS → Status "Aguardando Recebimento" → Peça chega → Entrada no estoque → Vincula → Bloqueada
```

**Fluxo D — Misto numa mesma OS:**
```
OS #1234 — Gol G5 2018
├── Parabrisa      → Compra: Autoglass
├── Farol          → Compra: AM Auto Peças
├── Para-choque    → Compra: Lumi Auto Peças
└── Paralama       → Estoque próprio ✓ Bloqueado
```

---

## 2. Tipagem de Peça

Toda peça na OS e na OC tem uma tipagem obrigatória:

| Tipo | Código | Descrição |
|---|---|---|
| Genuína | `genuina` | Original do fabricante do veículo (VW, Fiat) |
| Reposição Original | `reposicao` | Fabricante OEM alternativo (Arteb, Valeo) |
| Similar/Paralela | `similar` | Fabricante alternativo mais barato |
| Usada/Recondicionada | `usada` | Retirada de outro veículo |

Campo `tipo_qualidade` (CharField choices) em `ServiceOrderPart` e `ItemOrdemCompra`.

---

## 3. Models de Dados

### 3.1 — Alteração em ServiceOrderPart

Campos adicionados ao model existente `ServiceOrderPart`:

| Campo | Tipo | Descrição |
|---|---|---|
| `origem` | CharField choices | `ESTOQUE`, `COMPRA`, `SEGURADORA` |
| `tipo_qualidade` | CharField choices | `genuina`, `reposicao`, `similar`, `usada` |
| `status_peca` | CharField choices | Ver tabela abaixo |
| `unidade_fisica` | FK → UnidadeFisica (nullable, SET_NULL) | Quando vem do estoque ou chega depois |
| `pedido_compra` | FK → PedidoCompra (nullable, SET_NULL) | Quando origem=COMPRA |
| `custo_real` | DecimalField (nullable) | Preenchido quando peça chega (valor_nf) |

**Status da peça na OS:**

| Status | Quando | Cor |
|---|---|---|
| `bloqueada` | Peça do estoque vinculada | Verde |
| `aguardando_cotacao` | Pedido de compra criado, sem cotação | Amarelo |
| `em_cotacao` | Compras iniciou cotação | Azul |
| `aguardando_aprovacao` | OC montada, esperando financeiro | Roxo |
| `comprada` | OC aprovada, aguardando entrega | Azul |
| `recebida` | Peça chegou e foi bloqueada no estoque | Verde |
| `aguardando_seguradora` | Seguradora vai fornecer | Roxo |

### 3.2 — Novo app `apps.purchasing`

#### `PedidoCompra` (PaddockBaseModel)

Solicitação individual gerada automaticamente quando consultor pede compra.

| Campo | Tipo | Descrição |
|---|---|---|
| `service_order` | FK → ServiceOrder (CASCADE) | OS que originou |
| `service_order_part` | FK → ServiceOrderPart (CASCADE) | Peça específica |
| `descricao` | CharField(300) | Descrição da peça |
| `codigo_referencia` | CharField(100, blank) | Código fabricante |
| `tipo_qualidade` | CharField choices | genuina/reposicao/similar/usada |
| `quantidade` | DecimalField | |
| `valor_cobrado_cliente` | DecimalField | Valor que será cobrado na OS |
| `observacoes` | TextField(blank) | Notas para o comprador |
| `status` | CharField choices | `solicitado`, `em_cotacao`, `oc_pendente`, `aprovado`, `comprado`, `recebido`, `cancelado` |
| `solicitado_por` | FK → GlobalUser | Consultor |
| `created_at` | auto | |

**Indexes:** `[service_order]`, `[status, created_at]`

#### `OrdemCompra` (PaddockBaseModel)

Documento agrupador para aprovação financeira. **Uma OC por OS**, com múltiplos fornecedores.

| Campo | Tipo | Descrição |
|---|---|---|
| `numero` | CharField(20, unique) | `OC-{year}-{seq:04d}` auto-gerado |
| `service_order` | FK → ServiceOrder (CASCADE) | OS vinculada |
| `status` | CharField choices | `rascunho`, `pendente_aprovacao`, `aprovada`, `rejeitada`, `parcial_recebida`, `concluida` |
| `valor_total` | DecimalField | Soma dos itens (computed no save) |
| `observacoes` | TextField(blank) | |
| `criado_por` | FK → GlobalUser | Quem do setor de compras montou |
| `aprovado_por` | FK → GlobalUser (nullable) | Financeiro que aprovou |
| `aprovado_em` | DateTimeField (nullable) | |
| `rejeitado_por` | FK → GlobalUser (nullable) | |
| `motivo_rejeicao` | TextField(blank) | |

**Indexes:** `[service_order]`, `[status]`, `[numero]`

#### `ItemOrdemCompra` (PaddockBaseModel)

Item individual na OC — vincula peça + fornecedor.

| Campo | Tipo | Descrição |
|---|---|---|
| `ordem_compra` | FK → OrdemCompra (CASCADE) | |
| `pedido_compra` | FK → PedidoCompra (SET_NULL, nullable) | Rastreio ao pedido original |
| `fornecedor` | FK → Fornecedor (SET_NULL, nullable) | Quem vai vender (Person PJ) |
| `fornecedor_nome` | CharField(150) | Desnormalizado (caso fornecedor não cadastrado) |
| `fornecedor_cnpj` | CharField(20, blank) | Desnormalizado |
| `fornecedor_contato` | CharField(100, blank) | Telefone/WhatsApp |
| `descricao` | CharField(300) | Descrição da peça |
| `codigo_referencia` | CharField(100, blank) | |
| `tipo_qualidade` | CharField choices | genuina/reposicao/similar/usada |
| `quantidade` | DecimalField | |
| `valor_unitario` | DecimalField | Preço negociado com fornecedor |
| `valor_total` | DecimalField | qty × unit (computed no save) |
| `prazo_entrega` | CharField(100, blank) | "3 dias úteis" |
| `observacoes` | TextField(blank) | |

**Indexes:** `[ordem_compra]`, `[fornecedor]`

### 3.3 — Fornecedor

Reutilizar `apps.pricing_catalog.Fornecedor` existente (OneToOne → Person PJ) OU permitir fornecedor ad-hoc (campos desnormalizados no ItemOrdemCompra para quando é novo fornecedor sem cadastro).

---

## 4. Services

### 4.1 — `PedidoCompraService`
- `solicitar(service_order_part_id, descricao, codigo_ref, tipo_qualidade, quantidade, valor_cobrado, observacoes, user_id)` — cria PedidoCompra + atualiza `ServiceOrderPart.status_peca = aguardando_cotacao`
- `iniciar_cotacao(pedido_id, user_id)` — status `em_cotacao`, atualiza peça na OS
- `cancelar(pedido_id, user_id, motivo)` — cancela, reverte status da peça na OS

### 4.2 — `OrdemCompraService`
- `criar_oc(service_order_id, user_id)` — cria OC rascunho para a OS (número auto-gerado)
- `adicionar_item(oc_id, pedido_compra_id, fornecedor_data, valor_unitario, prazo, ...)` — adiciona item à OC, atualiza pedido `oc_pendente`
- `remover_item(item_id)` — remove da OC
- `enviar_para_aprovacao(oc_id, user_id)` — status `pendente_aprovacao`, atualiza peças na OS `aguardando_aprovacao`
- `aprovar(oc_id, user_id)` — MANAGER+: preenche `aprovado_por` + `aprovado_em`, status `aprovada`, pedidos → `aprovado`, peças na OS → `comprada`
- `rejeitar(oc_id, user_id, motivo)` — MANAGER+: status `rejeitada`, pedidos voltam a `em_cotacao`
- `registrar_recebimento_item(item_id, unidade_fisica_id, user_id)` — quando peça chega no estoque, vincula à OS, status `recebida`
- `valor_total(oc_id)` — recomputa soma dos itens

### 4.3 — Adaptação `ServiceOrderPartService`
- `adicionar_do_estoque(os_id, produto_peca_id_ou_unidade_id, tipo_qualidade, valor_cobrado, user_id)` — busca UnidadeFisica disponível, reserva (bloqueia), cria ServiceOrderPart com `origem=ESTOQUE`, `status_peca=bloqueada`, `custo_real=valor_nf`
- `adicionar_compra(os_id, descricao, tipo_qualidade, valor_cobrado, ..., user_id)` — cria ServiceOrderPart com `origem=COMPRA`, `status_peca=aguardando_cotacao` + chama `PedidoCompraService.solicitar()`
- `adicionar_seguradora(os_id, descricao, tipo_qualidade, valor_cobrado, user_id)` — cria ServiceOrderPart com `origem=SEGURADORA`, `status_peca=aguardando_seguradora`

---

## 5. Endpoints REST

### 5.1 — PartsTab (adaptação endpoints existentes)

```
POST   /api/v1/service-orders/{id}/parts/estoque/       Adicionar do estoque
POST   /api/v1/service-orders/{id}/parts/compra/         Solicitar compra
POST   /api/v1/service-orders/{id}/parts/seguradora/     Registrar seguradora fornece
GET    /api/v1/service-orders/{id}/parts/                Lista (já existe — adicionar novos campos)
PATCH  /api/v1/service-orders/{id}/parts/{pk}/           Editar (já existe)
DELETE /api/v1/service-orders/{id}/parts/{pk}/           Remover (já existe — libera estoque se bloqueada)
```

### 5.2 — Busca de peças para estoque

```
GET    /api/v1/inventory/buscar-pecas/?busca=&tipo_peca=&categoria=&veiculo_marca=&veiculo_modelo=&veiculo_ano=
```

Retorna `ProdutoComercialPeca` com campo extra `estoque_disponivel` (count de UnidadeFisica available) e `posicao` (endereço do nível).

### 5.3 — Compras

```
GET    /api/v1/purchasing/pedidos/                       Lista pedidos (filtros: status, os)
GET    /api/v1/purchasing/pedidos/{id}/                  Detalhe
PATCH  /api/v1/purchasing/pedidos/{id}/iniciar-cotacao/  Compras inicia cotação
PATCH  /api/v1/purchasing/pedidos/{id}/cancelar/         Cancelar pedido

GET/POST /api/v1/purchasing/ordens-compra/               Lista OCs / Criar OC
GET      /api/v1/purchasing/ordens-compra/{id}/          Detalhe com itens
POST     /api/v1/purchasing/ordens-compra/{id}/itens/    Adicionar item
DELETE   /api/v1/purchasing/ordens-compra/{id}/itens/{item_id}/  Remover item
POST     /api/v1/purchasing/ordens-compra/{id}/enviar/   Enviar para aprovação
POST     /api/v1/purchasing/ordens-compra/{id}/aprovar/  MANAGER+: Aprovar
POST     /api/v1/purchasing/ordens-compra/{id}/rejeitar/ MANAGER+: Rejeitar
POST     /api/v1/purchasing/ordens-compra/{id}/itens/{item_id}/receber/  Registrar recebimento
```

### 5.4 — Dashboard de compras

```
GET    /api/v1/purchasing/dashboard-stats/               KPIs: solicitados, em_cotacao, aguardando_aprovacao, aprovadas_hoje
```

---

## 6. Permissões RBAC

| Operação | Mínimo |
|---|---|
| Adicionar peça na OS (qualquer origem) | CONSULTANT |
| Buscar peças no estoque | CONSULTANT |
| Ver pedidos de compra | CONSULTANT |
| Iniciar cotação / Montar OC | STOREKEEPER (Compras) |
| Enviar OC para aprovação | STOREKEEPER (Compras) |
| Aprovar / Rejeitar OC | MANAGER (Financeiro) |
| Registrar recebimento de peça | STOREKEEPER |
| Ver custo real e margem na OS | MANAGER |

---

## 7. Frontend

### 7.1 — PartsTab Reescrita

Substitui completamente a aba Peças da OS.

**Layout:**
1. **3 botões de origem:** "Do Estoque" (verde), "Comprar" (azul), "Seguradora Fornece" (roxo)
2. **Tabela de peças** com colunas:
   - Peça (nome + SKU/posição)
   - Tipo (genuína/reposição/similar/usada) — badge
   - Origem (estoque/compra/seguradora) — badge colorido
   - Status — dot + texto (acompanha fluxo de compra)
   - Custo — valor NF real (MANAGER+ apenas, "—" se não disponível)
   - Cobrado — valor na OS
   - Margem — MargemBadge (MANAGER+ apenas)
3. **4 cards resumo:** Custo Total, Valor Cobrado, Margem, Peças Pendentes

**Modais:**
- "Do Estoque" → busca com filtros (nome/SKU/tipo/categoria) + disponibilidade + posição + selecionar → bloqueia
- "Comprar" → formulário: descrição, código, tipo_qualidade, valor cobrado, quantidade, observações → gera pedido
- "Seguradora Fornece" → formulário mínimo: descrição, tipo_qualidade, valor cobrado → registra

### 7.2 — Página /compras (Painel do Setor de Compras)

**Layout:**
1. **4 KPIs:** Solicitados, Em Cotação, Aguardando Aprovação, Aprovadas Hoje
2. **Tabela de pedidos:** OS, Peça, Veículo, Tipo, Status, Data, Ações (Iniciar Cotação / Montar OC)
3. **Filtros:** Status, período

### 7.3 — Página /compras/ordens/[id] (Detalhe da OC)

**Layout:**
1. **Header:** Número OC + OS vinculada + status badge + datas
2. **Itens agrupados por fornecedor:**
   - Bloco por fornecedor (nome, CNPJ, contato)
   - Tabela de itens: peça, tipo_qualidade, quantidade, valor unitário, total, prazo
3. **Resumo:** Total da OC
4. **Botões:** Aprovar (MANAGER+) / Rejeitar (MANAGER+)

### 7.4 — Sidebar

Adicionar seção "COMPRAS" na sidebar:
- Pedidos de Compra (ShoppingCart)
- Ordens de Compra (FileCheck)

### 7.5 — Componentes

| Componente | Descrição |
|---|---|
| `EstoqueBuscaModal` | Modal de busca no estoque com filtros e disponibilidade |
| `CompraFormModal` | Modal para solicitar compra de peça |
| `SeguradoraFormModal` | Modal mínimo para peça de seguradora |
| `TipoQualidadeBadge` | Badge: genuína (info), reposição (success), similar (warning), usada (white/40) |
| `OrigemBadge` | Badge: estoque (verde), compra (azul), seguradora (roxo) |
| `StatusPecaBadge` | Dot + texto com cor conforme status |
| `OrdemCompraDetail` | Componente da OC com itens agrupados por fornecedor |

---

## 8. Integração com Estoque

### 8.1 — Ao adicionar "Do Estoque"
1. Busca `ProdutoComercialPeca` (ou `UnidadeFisica` direto)
2. Chama `ReservaUnidadeService.reservar()` — bloqueia a peça
3. Cria `MovimentacaoEstoque(SAIDA_OS)` automaticamente
4. `ServiceOrderPart.unidade_fisica` = a peça reservada
5. `ServiceOrderPart.custo_real` = `UnidadeFisica.valor_nf`

### 8.2 — Ao remover peça do estoque da OS
1. Chama `ReservaUnidadeService.liberar()` — desbloqueia
2. Cria `MovimentacaoEstoque(ENTRADA_DEVOLUCAO)` automaticamente
3. Limpa `ServiceOrderPart.unidade_fisica`

### 8.3 — Quando peça comprada chega
1. Entrada no estoque via NF-e ou manual → cria `UnidadeFisica`
2. `OrdemCompraService.registrar_recebimento_item()` → vincula `UnidadeFisica` ao `ServiceOrderPart`
3. Bloqueia a peça (`status=reserved`, `ordem_servico` = a OS)
4. `ServiceOrderPart.status_peca` → `recebida`
5. `ServiceOrderPart.custo_real` = `valor_nf` da peça recebida

### 8.4 — Quando peça da seguradora chega
Mesmo fluxo do 8.3 — entrada no estoque + vincula à OS.

---

## 9. Busca de Peças por Veículo

### 9.1 — Fase 1 (agora)
Busca livre por nome/SKU/tipo + filtros por categoria. O filtro "Compatível com {veículo}" usa `CompatibilidadePeca` existente no `pricing_catalog` como **best effort** — se a peça tem compatibilidade cadastrada, aparece como "compatível". Se não tem, aparece normalmente (sem badge).

### 9.2 — Fase 2 (futura)
Catálogo de compatibilidade completo com importação de tabelas de referência (marca/modelo/ano → peças). Fora do escopo desta spec.

---

## 10. Ordem de Compra — Regras

1. **Uma OC por OS** — mesmo com múltiplos fornecedores, tudo numa OC só para o financeiro ter visibilidade total
2. **Itens agrupados por fornecedor** dentro da OC — cada item tem seu fornecedor (nome, CNPJ, contato)
3. **Número sequencial:** `OC-{year}-{seq:04d}` auto-gerado
4. **Aprovação é tudo ou nada** — o financeiro aprova a OC inteira, não item por item
5. **Rejeição volta pra cotação** — compras ajusta e reenvia
6. **Recebimento é por item** — pode chegar em datas diferentes (fornecedores diferentes)
7. **OC concluída** quando todos os itens foram recebidos

---

## 11. Design System

Segue estritamente o design system fintech-red dark existente. Referências da spec WMS anterior aplicam-se aqui.

Cores específicas deste módulo:
- **Estoque:** success-* (verde)
- **Compra:** info-* (azul)
- **Seguradora:** roxo (`#a855f7` / `bg-purple-500/10 text-purple-400`)
- **Tipo Genuína:** info-*
- **Tipo Reposição:** success-*
- **Tipo Similar:** warning-*
- **Tipo Usada:** `bg-white/5 text-white/40`

---

## 12. Armadilhas e Padrões

| Código | Regra |
|---|---|
| PC-1 | ServiceOrderPart.origem é imutável após criação — não muda de ESTOQUE pra COMPRA |
| PC-2 | Bloqueio de estoque é imediato ao adicionar — não espera confirmação |
| PC-3 | Remover peça da OS SEMPRE libera estoque se estava bloqueada |
| PC-4 | OC é uma por OS — não criar múltiplas OCs para a mesma OS |
| PC-5 | Aprovação da OC é atômica — aprova tudo ou rejeita tudo |
| PC-6 | custo_real só é preenchido quando peça física chega — nunca antes |
| PC-7 | Fornecedor pode ser ad-hoc (campos desnormalizados) ou cadastrado (FK Fornecedor) |
| PC-8 | tipo_qualidade é obrigatório em toda peça — na OS e na OC |

---

## 13. Fora do Escopo

- Catálogo de compatibilidade completo (Fase 2)
- Integração WhatsApp para cotação automática
- Relatórios de compras (volume por fornecedor, prazo médio, etc.)
- Workflow de compra para itens que não são de OS (material de escritório, etc.)
- Integração com NF-e de entrada automática (já existe parcialmente)
