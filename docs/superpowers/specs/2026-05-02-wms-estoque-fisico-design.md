# WMS — Estoque Físico Completo

**Data:** 2026-05-02
**Módulo:** `apps.inventory` (TENANT_APP)
**Escopo:** Hierarquia de localização, produto comercial (peças e insumos separados), entrada manual, movimentação auditável, aprovações, contagem de inventário, análise de margem na OS.

---

## 1. Contexto e Requisitos

### 1.1 — Realidade da DS Car
- 3 galpões + pátio externo
- Organização interna: Rua → Prateleira → Nível
- Hoje tudo em papel, sem código de endereçamento
- Universo de peças amplo e variável (~20+ tipos: para-choques, capôs, vidros, portas, etc.)
- Insumos com custo volátil (preço muda mensalmente, FIFO obrigatório)

### 1.2 — Fluxos de Saída
- **Setor de peças** (estoque/compras) separa e entrega
- **Consultor** reserva peças ao montar orçamento com estoque disponível

### 1.3 — Cenários de Entrada
- NF-e de compra (já existe)
- Entrada manual (sem NF-e: doação, reaproveitamento)
- Devolução de peça (mecânico não usou, volta pro estoque)
- Transferência entre galpões/posições

### 1.4 — Auditoria
- **Completa**: quem, quando, de onde→onde, motivo, vínculo com OS/NF-e
- Foto/evidência obrigatória para perdas e ajustes de inventário
- Aprovação MANAGER+ para perdas e ajustes

### 1.5 — Contagem de Inventário
- **Cíclica**: por rua/prateleira, rotativa, sem parar operação
- **Total**: por armazém inteiro, semestral/anual

---

## 2. Arquitetura — Hierarquia Fixa 4 Níveis

Abordagem escolhida: **4 models Django separados**, cada um com FK pro pai. Espelha exatamente a realidade física. Pátio é um tipo especial de Armazém.

---

## 3. Models de Dados

### 3.1 — Hierarquia de Localização

#### `Armazem` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(80) | "Galpão Principal", "Pátio Externo" |
| `codigo` | CharField(10, unique por tenant) | "G1", "G2", "PT1" |
| `tipo` | CharField choices: `GALPAO`, `PATIO` | Diferenciador visual |
| `endereco` | CharField(200, blank) | Endereço físico se separado |
| `responsavel` | FK → GlobalUser (nullable) | Gestor do armazém |
| `observacoes` | TextField(blank) | |

#### `Rua` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `armazem` | FK → Armazem (CASCADE) | |
| `codigo` | CharField(10) | "R01", "R02" |
| `descricao` | CharField(80, blank) | "Rua de Funilaria" |
| `ordem` | PositiveIntegerField | Ordenação visual |
| **unique_together** | `(armazem, codigo)` | |

#### `Prateleira` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `rua` | FK → Rua (CASCADE) | |
| `codigo` | CharField(10) | "P01", "P02" |
| `descricao` | CharField(80, blank) | |
| `capacidade_kg` | DecimalField(nullable) | Peso máximo suportado |
| `ordem` | PositiveIntegerField | |
| **unique_together** | `(rua, codigo)` | |

#### `Nivel` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `prateleira` | FK → Prateleira (CASCADE) | |
| `codigo` | CharField(10) | "N1", "N2" |
| `descricao` | CharField(80, blank) | |
| `altura_cm` | PositiveIntegerField(nullable) | Altura útil |
| `largura_cm` | PositiveIntegerField(nullable) | |
| `profundidade_cm` | PositiveIntegerField(nullable) | |
| `ordem` | PositiveIntegerField | |
| **unique_together** | `(prateleira, codigo)` | |

**Propriedade computed:** `endereco_completo` → `"G1-R03-P02-N4"` (concatena códigos dos pais)

**`Nivel` é o ponto terminal** — `UnidadeFisica` e `LoteInsumo` apontam aqui via FK.

---

### 3.2 — Classificação de Peças e Insumos

#### `TipoPeca` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(80) | "Para-choque", "Capô", "Vidro de Porta" |
| `codigo` | CharField(10, unique por tenant) | "PCHQ", "CAPO", "VDPT" |
| `ordem` | PositiveIntegerField | |

**Seeds iniciais (~20):** Para-choque, Capô, Tampa Traseira, Porta, Parabrisas, Vigia, Vidro de Porta, Vidro Lateral, Retrovisor, Farol, Lanterna, Roda, Pneu, Amortecedor, Filtro, Coxim, Radiador, Condensador, Eletroventilador, Outros.

**Extensível** pelo MANAGER+ via CRUD — sem migration para novos tipos.

#### `CategoriaInsumo` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(80) | "Tintas", "Vernizes", "Lixas", "Massas" |
| `codigo` | CharField(10, unique por tenant) | "TINT", "VERN", "LIXA" |
| `margem_padrao_pct` | DecimalField | Margem padrão para insumos desta categoria |
| `ordem` | PositiveIntegerField | |

---

### 3.3 — Produto Comercial (Peças e Insumos SEPARADOS)

Peças e insumos são naturezas completamente diferentes. Dois models distintos, sem XOR, sem nullable esquisito.

#### `ProdutoComercialPeca` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| **Identidade** | | |
| `sku_interno` | CharField(30, unique por tenant) | "PC-001" — código DS Car |
| `nome_interno` | CharField(150) | "Para-choque Gol G5 Dianteiro" |
| `codigo_fabricante` | CharField(60, blank) | Código da marca (Fiat, VW) |
| `codigo_ean` | CharField(14, blank) | EAN/GTIN da embalagem |
| `codigo_distribuidor` | CharField(60, blank) | Código no catálogo do distribuidor |
| `nome_fabricante` | CharField(150, blank) | Nome como o fabricante chama |
| **Classificação** | | |
| `tipo_peca` | FK → TipoPeca (nullable) | "Para-choque", "Capô" |
| `posicao_veiculo` | CharField choices | DIANTEIRO, TRASEIRO, LATERAL_ESQ, LATERAL_DIR, SUPERIOR, INFERIOR, N_A |
| `lado` | CharField choices | ESQUERDO, DIREITO, CENTRAL, N_A |
| `categoria` | FK → CategoriaProduto (nullable) | "Funilaria", "Mecânica" |
| **Vínculo catálogo técnico** | | |
| `peca_canonica` | FK → PecaCanonica (nullable, SET_NULL) | Vínculo com motor de precificação |
| **Preço** | | |
| `preco_venda_sugerido` | DecimalField(nullable) | Override manual (prioridade máxima) |
| `margem_padrao_pct` | DecimalField(nullable) | Override por produto (prioridade sobre categoria) |
| `observacoes` | TextField(blank) | |

**Indexes:** `[codigo_ean]`, `[codigo_fabricante]`, `[peca_canonica]`, `[tipo_peca, posicao_veiculo, lado]`

**Propriedade:** `preco_venda_calculado`:
1. Se `preco_venda_sugerido` definido → retorna ele
2. Se `margem_padrao_pct` definido → `custo_base × (1 + margem/100)`
3. Senão → `custo_base × (1 + categoria.margem_padrao_pct/100)`

`custo_base` vem de `CustoPecaService.custo_base()` existente.

#### `ProdutoComercialInsumo` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| **Identidade** | | |
| `sku_interno` | CharField(30, unique por tenant) | "VN-001" — código DS Car |
| `nome_interno` | CharField(150) | "Verniz PU Transparente" |
| `codigo_fabricante` | CharField(60, blank) | Código da marca |
| `codigo_ean` | CharField(14, blank) | EAN/GTIN |
| `nome_fabricante` | CharField(150, blank) | |
| **Classificação** | | |
| `unidade_base` | CharField(10) | "L", "KG", "UN", "M" |
| `categoria_insumo` | FK → CategoriaInsumo (nullable) | "Tintas", "Vernizes" |
| **Vínculo catálogo técnico** | | |
| `material_canonico` | FK → MaterialCanonico (nullable, SET_NULL) | Vínculo com motor de precificação |
| **Preço** | | |
| `preco_venda_sugerido` | DecimalField(nullable) | Override manual |
| `margem_padrao_pct` | DecimalField(nullable) | Override por produto |
| `observacoes` | TextField(blank) | |

**Indexes:** `[codigo_ean]`, `[codigo_fabricante]`, `[material_canonico]`

**Propriedade:** `preco_venda_calculado` — mesma lógica da peça, usando `CustoInsumoService.custo_base()`.

#### `CategoriaProduto` (PaddockBaseModel) — para peças
| Campo | Tipo | Descrição |
|---|---|---|
| `nome` | CharField(80) | "Funilaria", "Mecânica", "Elétrica" |
| `codigo` | CharField(10, unique por tenant) | "FUN", "MEC", "ELE" |
| `margem_padrao_pct` | DecimalField | Ex: 35.00 (+35% sobre custo) |
| `ordem` | PositiveIntegerField | |

---

### 3.4 — Movimentação de Estoque

#### `MovimentacaoEstoque` (PaddockBaseModel) — IMUTÁVEL
Substitui o `StockMovement` existente. Log imutável de toda operação que altera o estoque.

| Campo | Tipo | Descrição |
|---|---|---|
| `tipo` | CharField choices | Ver tabela abaixo |
| `unidade_fisica` | FK → UnidadeFisica (nullable) | Quando é peça |
| `lote_insumo` | FK → LoteInsumo (nullable) | Quando é insumo |
| `quantidade` | DecimalField | 1 para peça, N para insumo |
| `nivel_origem` | FK → Nivel (nullable) | De onde saiu |
| `nivel_destino` | FK → Nivel (nullable) | Para onde foi |
| `ordem_servico` | FK → ServiceOrder (nullable) | Quando vinculada a OS |
| `nfe_entrada` | FK → NFeEntrada (nullable) | Quando via NF-e |
| `motivo` | TextField | Obrigatório para PERDA e AJUSTE |
| `evidencia` | FileField (nullable) | Foto para perda/ajuste |
| `aprovado_por` | FK → GlobalUser (nullable) | PERDA e AJUSTE requerem MANAGER+ |
| `aprovado_em` | DateTimeField (nullable) | |
| `realizado_por` | FK → GlobalUser | SEMPRE obrigatório |

**Tipos de movimentação:**

| Tipo | Direção | Requer aprovação | Evidência |
|---|---|---|---|
| `ENTRADA_NF` | Entrada | Não | Não |
| `ENTRADA_MANUAL` | Entrada | Não | Não |
| `ENTRADA_DEVOLUCAO` | Entrada | Não | Não |
| `SAIDA_OS` | Saída | Não | Não |
| `SAIDA_PERDA` | Saída | Sim (MANAGER+) | Sim (foto) |
| `TRANSFERENCIA` | Neutra | Não | Não |
| `AJUSTE_INVENTARIO` | Entrada ou Saída | Sim (MANAGER+) | Sim (foto) |

**Indexes:** `[tipo, created_at]`, `[unidade_fisica]`, `[lote_insumo]`, `[ordem_servico]`, `[realizado_por]`

**Imutabilidade:** `save()` bloqueia update após criação (mesmo padrão do `CalculoCustoSnapshot`).

**`StockMovement` existente:** mantido para histórico, mas não recebe novos registros.

---

### 3.5 — Contagem de Inventário

#### `ContagemInventario` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `tipo` | CharField: `CICLICA`, `TOTAL` | |
| `status` | CharField: `ABERTA`, `EM_ANDAMENTO`, `FINALIZADA`, `CANCELADA` | |
| `armazem` | FK → Armazem (nullable) | Contagem total = armazém inteiro |
| `rua` | FK → Rua (nullable) | Contagem cíclica = por rua |
| `data_abertura` | DateTimeField | |
| `data_fechamento` | DateTimeField (nullable) | |
| `iniciado_por` | FK → GlobalUser | |
| `fechado_por` | FK → GlobalUser (nullable) | |
| `observacoes` | TextField(blank) | |

#### `ItemContagem` (PaddockBaseModel)
| Campo | Tipo | Descrição |
|---|---|---|
| `contagem` | FK → ContagemInventario (CASCADE) | |
| `nivel` | FK → Nivel | Posição sendo contada |
| `unidade_fisica` | FK → UnidadeFisica (nullable) | Peça encontrada |
| `lote_insumo` | FK → LoteInsumo (nullable) | Insumo contado |
| `quantidade_sistema` | DecimalField | O que o sistema diz |
| `quantidade_contada` | DecimalField | O que o operador contou |
| `divergencia` | DecimalField | Computed: contada - sistema |
| `contado_por` | FK → GlobalUser | |
| `observacao` | CharField(200, blank) | |

**Ao finalizar contagem:** gera `MovimentacaoEstoque(AJUSTE_INVENTARIO)` para cada divergência ≠ 0. Ajustes requerem aprovação MANAGER+.

---

### 3.6 — Alterações em Models Existentes

#### `UnidadeFisica`
- **REMOVE:** `localizacao` (CharField) — deprecar, manter temporariamente para migração
- **ADD:** `nivel` FK → Nivel (nullable, SET_NULL)
- **ADD:** `produto_peca` FK → ProdutoComercialPeca (nullable, SET_NULL)

#### `LoteInsumo`
- **REMOVE:** `localizacao` (CharField) — deprecar, manter temporariamente para migração
- **ADD:** `nivel` FK → Nivel (nullable, SET_NULL)
- **ADD:** `produto_insumo` FK → ProdutoComercialInsumo (nullable, SET_NULL)

#### `StockMovement`
- Mantido para histórico. Não recebe novos registros. `MovimentacaoEstoque` assume.

---

## 4. Services

### 4.1 — `LocalizacaoService`
- `criar_estrutura_completa(armazem, ruas, prateleiras, niveis)` — bulk create em `@atomic`
- `mover_item(unidade_ou_lote, nivel_destino, user)` — atualiza FK + cria `MovimentacaoEstoque(TRANSFERENCIA)`
- `ocupacao_nivel(nivel_id)` → `{total_unidades, total_lotes, lista}`
- `ocupacao_armazem(armazem_id)` → resumo agregado por rua
- `endereco_completo(nivel)` → `"G1-R03-P02-N4"`

### 4.2 — `EntradaEstoqueService`
- `entrada_manual_peca(peca_canonica_id, valor, nivel_id, user, motivo, produto_peca_id=None)` — cria `UnidadeFisica` + `MovimentacaoEstoque(ENTRADA_MANUAL)`
- `entrada_manual_lote(material_id, qtd, valor, nivel_id, user, motivo, produto_insumo_id=None)` — cria `LoteInsumo` + `MovimentacaoEstoque(ENTRADA_MANUAL)`
- `registrar_devolucao(unidade_fisica_id, nivel_destino, user, motivo)` — `status consumed→available` + `MovimentacaoEstoque(ENTRADA_DEVOLUCAO)`
- `NFeIngestaoService.criar_registros_estoque()` existente adaptado para gerar `MovimentacaoEstoque(ENTRADA_NF)`

### 4.3 — `SaidaEstoqueService`
- `registrar_perda(unidade_ou_lote, motivo, evidencia_file, user)` — cria `MovimentacaoEstoque(SAIDA_PERDA)`, status→lost. Requer aprovação MANAGER+.
- `ReservaUnidadeService` e `BaixaInsumoService` existentes adaptados para gerar `MovimentacaoEstoque(SAIDA_OS)`

### 4.4 — `ContagemService`
- `abrir_contagem(tipo, armazem_ou_rua, user)` — cria `ContagemInventario` + gera `ItemContagem` pré-populado com `quantidade_sistema`
- `registrar_contagem_item(item_id, quantidade_contada, user)` — atualiza `ItemContagem` + calcula divergência
- `finalizar_contagem(contagem_id, user)` — MANAGER+: gera `MovimentacaoEstoque(AJUSTE_INVENTARIO)` para cada divergência ≠ 0
- `cancelar_contagem(contagem_id, user, motivo)`

### 4.5 — `MovimentacaoService` (consulta)
- `historico_item(unidade_ou_lote)` → timeline de todas as movimentações
- `historico_posicao(nivel_id)` → tudo que entrou/saiu da posição
- `historico_os(ordem_servico_id)` → todas as movimentações vinculadas à OS
- `resumo_periodo(data_inicio, data_fim)` → KPIs: entradas, saídas, transferências, perdas

### 4.6 — `AprovacaoEstoqueService`
- `solicitar_aprovacao(movimentacao_id)` — cria pendência para MANAGER+
- `aprovar(movimentacao_id, user)` — MANAGER+: preenche `aprovado_por` + `aprovado_em`; executa a movimentação
- `rejeitar(movimentacao_id, user, motivo)` — soft_delete da movimentação pendente

---

## 5. Endpoints REST

### 5.1 — Localização (CRUD)
```
GET/POST    /api/v1/inventory/armazens/
GET/PUT/DEL /api/v1/inventory/armazens/{id}/
GET         /api/v1/inventory/armazens/{id}/ocupacao/
GET/POST    /api/v1/inventory/ruas/                     ?armazem={id}
GET/PUT/DEL /api/v1/inventory/ruas/{id}/
GET/POST    /api/v1/inventory/prateleiras/              ?rua={id}
GET/PUT/DEL /api/v1/inventory/prateleiras/{id}/
GET/POST    /api/v1/inventory/niveis/                   ?prateleira={id}
GET/PUT/DEL /api/v1/inventory/niveis/{id}/
GET         /api/v1/inventory/niveis/{id}/conteudo/
```

### 5.2 — Produto Comercial
```
GET/POST    /api/v1/inventory/produtos-peca/
GET/PUT/DEL /api/v1/inventory/produtos-peca/{id}/
GET/POST    /api/v1/inventory/produtos-insumo/
GET/PUT/DEL /api/v1/inventory/produtos-insumo/{id}/
GET/POST    /api/v1/inventory/tipos-peca/
GET/PUT/DEL /api/v1/inventory/tipos-peca/{id}/
GET/POST    /api/v1/inventory/categorias-produto/
GET/PUT/DEL /api/v1/inventory/categorias-produto/{id}/
GET/POST    /api/v1/inventory/categorias-insumo/
GET/PUT/DEL /api/v1/inventory/categorias-insumo/{id}/
```

### 5.3 — Entrada Manual
```
POST        /api/v1/inventory/entrada/peca/
POST        /api/v1/inventory/entrada/lote/
POST        /api/v1/inventory/devolucao/{unidade_id}/
```

### 5.4 — Movimentação
```
POST        /api/v1/inventory/transferir/
POST        /api/v1/inventory/perda/
GET         /api/v1/inventory/movimentacoes/            ?tipo=&periodo=&item=&os=&usuario=
GET         /api/v1/inventory/movimentacoes/{id}/
```

### 5.5 — Aprovações
```
GET         /api/v1/inventory/aprovacoes/pendentes/
POST        /api/v1/inventory/aprovacoes/{id}/aprovar/
POST        /api/v1/inventory/aprovacoes/{id}/rejeitar/
```

### 5.6 — Contagem de Inventário
```
GET/POST    /api/v1/inventory/contagens/
GET         /api/v1/inventory/contagens/{id}/
PATCH       /api/v1/inventory/contagens/{id}/itens/{item_id}/
POST        /api/v1/inventory/contagens/{id}/finalizar/
POST        /api/v1/inventory/contagens/{id}/cancelar/
```

---

## 6. Permissões RBAC

| Operação | Mínimo |
|---|---|
| Consultar estoque / posições | CONSULTANT |
| Entrada manual / Bipagem / Transferir | STOREKEEPER |
| Registrar devolução | STOREKEEPER |
| Registrar perda (solicitar) | STOREKEEPER |
| Aprovar perda / Ajuste de inventário | MANAGER |
| Abrir contagem / Registrar itens | STOREKEEPER |
| Finalizar contagem (gera ajustes) | MANAGER |
| CRUD Armazém / Rua / Prateleira / Nível | MANAGER |
| CRUD Produto Comercial / TipoPeca / Categorias | MANAGER |
| Forçar reserva mais cara (A6) | ADMIN |

---

## 7. Integração com OS

### 7.1 — Adaptações em services existentes
- **`ReservaUnidadeService.reservar()`**: após reservar, cria `MovimentacaoEstoque(SAIDA_OS)` com `nivel_origem` + `ordem_servico` + `realizado_por`
- **`BaixaInsumoService.baixar()`**: idem, cria `MovimentacaoEstoque(SAIDA_OS)` para cada `ConsumoInsumo`
- **`NFeIngestaoService.criar_registros_estoque()`**: gera `MovimentacaoEstoque(ENTRADA_NF)` para cada unidade/lote criado

### 7.2 — Devolução
- Peça consumida que volta: `status consumed→available`, atribui `nivel_destino`
- Cria `MovimentacaoEstoque(ENTRADA_DEVOLUCAO)` com vínculo à OS de origem

### 7.3 — Aba "Estoque" na OS Detail (MANAGER+)
- Bipagem inline: input de barcode → reservar peça diretamente na OS
- Tabela custo vs valor cobrado por peça/insumo com margem (verde = lucro, vermelho = prejuízo)
- Resumo: custo total, valor cobrado, margem total
- Timeline de movimentações vinculadas à OS (quem, quando, de onde, tipo)

### 7.4 — Origem do custo e valor cobrado
- **Custo**: `valor_nf` da `UnidadeFisica` ou `valor_unitario_na_baixa` do `ConsumoInsumo`
- **Valor cobrado**: `valor_peca` da `OSIntervencao` (motor) ou `sale_price` do `ServiceOrderPart` (legado)

---

## 8. Rastreio de Custo de Insumos (FIFO)

O modelo `LoteInsumo` já implementa FIFO. O que muda:

### 8.1 — Visibilidade no frontend
Mostrar claramente na tela de lotes:
- "3L sobrando a R$43/L (lote de 10/03)"
- "48L chegando a R$44/L (lote de 28/04)"
- Custo médio ponderado do estoque atual

### 8.2 — Na OS
Cada `ConsumoInsumo` já grava `valor_unitario_na_baixa` (snapshot). A aba "Estoque" da OS mostra o custo real que foi usado (pode variar de OS pra OS conforme o lote consumido).

### 8.3 — Margem por insumo
Mesma lógica das peças: custo (snapshot FIFO) vs valor cobrado na OS → margem real.

---

## 9. Frontend

### 9.1 — Estrutura de Páginas

```
app/(app)/estoque/
├── page.tsx                        Dashboard com KPIs + links submódulos
├── armazens/
│   ├── page.tsx                    Lista de armazéns (cards visuais)
│   └── [id]/page.tsx               Detalhe: árvore Rua → Prateleira → Nível
├── produtos/
│   ├── pecas/page.tsx              Lista ProdutoComercialPeca + ProdutoDialog
│   └── insumos/page.tsx            Lista ProdutoComercialInsumo + InsumoDialog
├── unidades/
│   └── page.tsx                    REESCRITA: tabela + ações (reservar, transferir, etiqueta)
├── lotes/
│   └── page.tsx                    REESCRITA: tabela + ações (baixar, transferir, etiqueta)
├── entrada/
│   └── page.tsx                    Formulário entrada manual (peça ou lote) + seletor posição
├── movimentacoes/
│   └── page.tsx                    Log completo: filtros tipo/período/usuário/OS
├── aprovacoes/
���   └── page.tsx                    MANAGER+: pendências de perda/ajuste com evidência
├── contagens/
│   ├── page.tsx                    Lista contagens + abrir nova
│   └── [id]/page.tsx               Detalhe: itens, registrar quantidades, finalizar
├── nfe-recebida/                   (já existe — melhorias)
│   ├── page.tsx
│   └── [id]/page.tsx
├── categorias/
│   └── page.tsx                    CRUD CategoriaProduto + CategoriaInsumo + TipoPeca
```

### 9.2 — Sidebar (seção ESTOQUE)
11 itens com ícones Lucide:
- Visão Geral (LayoutDashboard)
- Armazéns (Warehouse)
- Produtos — Peças (Package)
- Produtos — Insumos (FlaskConical)
- Unidades Físicas (Barcode)
- Lotes de Insumo (Layers)
- Entrada Manual (PackagePlus)
- Movimentações (ArrowLeftRight)
- Aprovações (CheckCircle) — badge com contagem de pendentes
- Contagens (ClipboardList)
- NF-e de Entrada (FileText)
- Categorias (Tag)

### 9.3 — Dashboard (`/estoque`)
4 KPI cards (StatCard com label-mono):
- Peças disponíveis (count de UnidadeFisica status=available)
- Valor em estoque (sum de valor_nf das disponíveis, formatCurrency compact)
- Reservadas para OS (count de status=reserved)
- Aprovações pendentes (count, badge vermelho)

Grid de submódulos com cards de navegação.

### 9.4 — Detalhe do Armazém (`/estoque/armazens/[id]`)
- Breadcrumb: Estoque › Armazéns › Nome
- Header com código (label-mono) + contadores (ruas, prateleiras, níveis)
- Botões: + Rua, + Prateleira, + Nível
- Árvore colapsável (`ArmazemTree`):
  - Rua: código + descrição + % ocupação
  - Prateleira: código + capacidade
  - Nível: endereço completo (badge #cc4444) + contagem de itens + status (OCUPADO/VAZIO/RESERVADO)

### 9.5 — Aba "Estoque" na OS Detail
- BarcodeScanInput para bipagem inline
- Tabela: Peça/Insumo | SKU | Posição | Custo | Cobrado | Margem (MargemBadge)
- 3 cards resumo: Custo total, Valor cobrado, Margem total
- MovimentacaoTimeline vinculada à OS

### 9.6 — Componentes Reutilizáveis

| Componente | Descrição |
|---|---|
| `PosicaoSelector` | 4 selects cascata: Armazém → Rua → Prateleira → Nível |
| `ArmazemTree` | Árvore colapsável com badges de ocupação |
| `BarcodeScanInput` | Input para leitor USB ou digitação, resolve P{hex}/L{hex} |
| `MovimentacaoTimeline` | Timeline vertical de movimentações (item, posição ou OS) |
| `MargemBadge` | Badge verde (lucro) / vermelho (prejuízo) |
| `ProdutoDialog` | Sheet lateral: cadastro peça com tabs |
| `InsumoDialog` | Sheet lateral: cadastro insumo |
| `EvidenciaUpload` | Upload de foto/evidência para perdas e ajustes |

---

## 10. Design System

Segue **estritamente** o design system fintech-red dark existente:

- **Backgrounds:** `bg-white/5`, `bg-white/[0.03]`
- **Borders:** `border-white/10`, `border-white/5`
- **Text:** `text-white/90` (primário), `text-white/60` (secundário), `text-white/40` (muted)
- **Labels:** `label-mono` (10px, monospace, #cc4444, uppercase, tracking 0.14em)
- **Dividers:** `section-divider` (label + line)
- **Tables:** `bg-white/[0.03]` header, `label-mono text-white/40` headers, `border-white/5` rows
- **Cards:** `bg-white/5 border border-white/10 rounded-md p-card-padding`
- **StatCard:** icon `bg-white/[0.06]`, value `font-mono`, label `label-mono`
- **Badges:** `bg-{color}-500/10 border-{color}-500/20 text-{color}-400` (nunca fundo sólido light)
- **Forms:** constantes de `@paddock/utils/form-styles.ts` (FORM_LABEL, FORM_INPUT, etc.)
- **Status:** `success-*` (verde), `warning-*` (amarelo), `error-*` (vermelho), `info-*` (azul)
- **Cores proibidas:** `neutral-*`, `bg-white` (sólido), `emerald-*`, `indigo-*`

---

## 11. Armadilhas e Padrões

| Código | Regra |
|---|---|
| P1 | Valores NF sempre COM impostos embutidos |
| P4 | Barcode determinístico: `P{hex}` peça, `L{hex}` lote |
| P5 | `select_for_update(skip_locked=True)` em toda reserva/baixa |
| P6 | Impressão SEMPRE via Celery (nunca síncrono) |
| P7 | `forcar_mais_caro=True` → log obrigatório + ADMIN+ |
| P8 | `valor_unitario_na_baixa` = snapshot imutável no consumo |
| P10 | `estoque_gerado=True` = flag de idempotência na NF-e |
| A2 | `custo_base` inclui RESERVED (custo de reposição real) |
| WMS-1 | `MovimentacaoEstoque` é IMUTÁVEL — save() bloqueia update |
| WMS-2 | Perdas e ajustes SEMPRE requerem aprovação MANAGER+ + evidência |
| WMS-3 | Toda movimentação tem `realizado_por` — NUNCA nullable |
| WMS-4 | `endereco_completo` é computed, não stored — evita desync |
| WMS-5 | Peças e insumos são models SEPARADOS — nunca misturar |

---

## 12. Fora do Escopo (sprints futuras)

- Dashboard de margem com KPIs por seguradora/categoria/período
- Alertas automáticos de estoque mínimo (notification/task)
- Inventário com leitor mobile (app Expo)
- Integração com compras (sugestão de reposição automática)
- Relatórios de giro de estoque
