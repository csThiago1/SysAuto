# OS UX Redesign — Design Spec

## Objetivo

Redesenhar três superfícies do ERP DS Car para reduzir scroll, eliminar campos grandes desnecessários e tornar o fluxo dos consultores mais rápido:

1. **Criação de OS** — de página separada para drawer lateral
2. **Aba Abertura (edição de OS)** — de coluna única com seções empilhadas para layout duas colunas compacto
3. **Cadastro inline de cliente** — chip de seleção sem duplicata de nome, campos obrigatórios claros

---

## Superfície 1 — Drawer "Nova OS"

### Estrutura

- Substitui a rota `/service-orders/new` como página separada
- Abre como **drawer lateral** (desliza da direita, ~400px de largura)
- Overlay escuro preserva contexto do Kanban/lista ao fundo
- A rota `/service-orders/new` continua existindo mas redireciona para `/os` com o drawer aberto
- Fecha com ESC, clique no overlay ou botão ✕

### Campos obrigatórios vs opcionais

**Obrigatórios** (botão "Criar OS" só ativa quando todos preenchidos):

| Seção | Campos |
|-------|--------|
| Tipo | Particular ou Seguradora |
| Seguradora (se tipo=seguradora) | Seguradora + Segurado/Terceiro toggle |
| Cliente | Nome, CPF, Telefone, E-mail |
| Veículo | Placa, Montadora, Modelo |

**Opcionais** (visíveis, sem bloqueio):

| Seção | Campos |
|-------|--------|
| Cliente | Nascimento, Endereço (separado) |
| Veículo | Versão, Ano, Cor, Combustível, Chassi, FIPE, KM |
| Seguradora | Sinistro, Corretor, Franquia, Perito, datas — ficam para edição da OS |

### Layout interno do drawer

```
┌─────────────────────────────────┐
│ Nova OS                       ✕ │  ← header fixo
│ * campos obrigatórios           │
├─────────────────────────────────┤
│ [scroll body]                   │
│                                 │
│ TIPO DE ATENDIMENTO *           │
│ [Particular] [Seguradora]  [OS▾]│  ← pill toggle + tipo OS na mesma linha
│                                 │
│ CLIENTE                         │
│ 🔍 Buscar...              [+Novo]│  ← busca com botão novo
│  ↓ (quando +Novo clicado)       │
│ ┌─ Novo cliente ──────────────┐ │
│ │ Nome *                      │ │
│ │ CPF *      │ Telefone *     │ │
│ │ E-mail *                    │ │
│ │ Nascimento │ Endereço       │ │
│ │              [Cadastrar]    │ │
│ └─────────────────────────────┘ │
│                                 │
│ VEÍCULO                         │
│ Placa *  [ABC1D23]              │
│ Montadora * │ Modelo *          │
│ Ano    │ Cor     │ Combustível  │
│                                 │
├─────────────────────────────────┤
│            [Cancelar] [Criar OS]│  ← footer fixo
└─────────────────────────────────┘
```

### Toggle Particular/Seguradora

- Pill toggle compacto (substitui os 2 cards grandes atuais)
- `Particular` selecionado por padrão
- Ao selecionar `Seguradora`: aparece select de seguradora + toggle `Segurado / Terceiro` logo abaixo do tipo
- Demais campos de seguradora (sinistro, corretor, perito, datas) ficam **só na edição** da OS

### Formulário inline de novo cliente

- Expandido dentro do drawer quando "+ Novo" clicado
- Nome (full width, obrigatório)
- Grid 2 colunas: CPF * | Telefone *
- E-mail * (full width)
- Grid 2 colunas: Nascimento | Endereço (ambos opcionais)
- Botão "Cadastrar" (desabilitado se nome/CPF/telefone/email vazios)
- "← Voltar" fecha o form e volta à busca

### Validação de CPF e email no cadastro inline

- CPF e email tornam-se **obrigatórios** quando criado via OS (validação frontend)
- Backend: `UnifiedCustomerCreateSerializer` já exige `phone`; adicionar `cpf` e `email` como required no contexto de criação via OS (pode ser flag `source=os` ou validação separada no proxy)

---

## Superfície 2 — Aba Abertura (edição de OS)

### Layout geral

```
┌─────────────────────────────────────────────────────────────────┐
│ [BARRA TIPO — full width, 1 linha]                              │
│ Atendimento: [Particular][Seguradora] | Tipo OS: [Chap▾] |      │
│ Consultor: [Maria▾]                         Orçamento: [data]  │
├──────────────────────────┬──────────────────────────────────────┤
│ COLUNA ESQUERDA          │ COLUNA DIREITA                       │
│                          │                                       │
│ ┌─ Dados do Cliente ──┐  │ ┌─ Dados do Veículo ──────────────┐ │
│ │ [chip: João Silva ✕]│  │ │ [🚗 slot logo] [placa destaque] │ │
│ │ ou buscar outro     │  │ │ Montadora | Modelo | Versão      │ │
│ │ ─────────────────── │  │ │ Ano | Cor | Combustível          │ │
│ │ CPF    | Telefone   │  │ │ Chassi          | FIPE           │ │
│ │ E-mail | Nascimento │  │ └─────────────────────────────────┘ │
│ │ ─── Endereço ─────  │  │                                       │
│ │ CEP | Rua     | Nº  │  │ ┌─ Prazos e Entrega ──────────────┐ │
│ │ Complemento | Bairro│  │ │ Dias reparo | Previsão entrega  │ │
│ │ Cidade          | UF│  │ │ Vistoria final | Entrega cliente │ │
│ └─────────────────────┘  │ └─────────────────────────────────┘ │
│                          │                                       │
│ ┌─ Entrada ───────────┐  │                                       │
│ │ Data | KM | Local   │  │                                       │
│ │ Aut. serviço | Agend.│  │                                       │
│ └─────────────────────┘  │                                       │
└──────────────────────────┴──────────────────────────────────────┘
```

### Barra de tipo (topo, full width)

Uma única linha compacta com:
- Toggle pill: `Particular` / `Seguradora`
- Separador `|`
- Select: Tipo OS (Chapeação, Mecânica, etc.)
- Separador `|`
- Select: Consultor
- (à direita) Data de Orçamento — só visível quando tipo=Particular

### Coluna esquerda

**Seção: Dados do Cliente**

- **Sem cliente selecionado**: campo busca (🔍) + botão "+ Novo"
- **Com cliente selecionado**: chip verde `[Nome da Silva ✕]` + link "buscar outro"
- Ao selecionar cliente, campos aparecem populados (readonly, `bg-neutral-50`):
  - Linha 1: CPF | Telefone
  - Linha 2: E-mail | Nascimento
  - Bloco Endereço:
    - CEP (72px) | Rua (flex) | Nº (52px)
    - Complemento | Bairro
    - Cidade | UF (44px)
- CPF, telefone, email, nascimento e endereço são todos readonly (vêm de `useCustomerDetail`)
- "Nome na OS" como campo separado é **removido** — o nome aparece apenas no chip

**Seção: Seguradora** (visível só quando tipo=Seguradora, inserida entre Cliente e Entrada)

- Logo da seguradora (padrão `InsurerLogo`) à esquerda
- Grid direito:
  - Linha 1: Select Seguradora (flex) | Toggle `Segurado / Terceiro`
  - Linha 2: Sinistro | Corretor | Franquia (condicional)
  - Linha 3: Perito (col-span-2) | Data visita perito
  - Linha 4: Data vistoria | Data autorização

**Seção: Entrada**

- Grid 3 colunas: Data entrada | KM entrada | Localização
- Grid 2 colunas: Autorização serviço | Agendamento

### Coluna direita

**Seção: Dados do Veículo**

- Slot visual (56×56px, borda dashed): placeholder `🚗 logo` — futuro: logo montadora
- Placa em destaque (`font-mono`, `font-bold`, border-2)
- Grid 3 colunas: Montadora | Modelo | Versão ← **campo novo**
- Grid 3 colunas: Ano | Cor | Combustível
- Grid 2 colunas: Chassi (col-span-2) | FIPE

**Seção: Prazos e Entrega**

- Grid 2 colunas: Dias de reparo | Previsão de entrega
- Grid 2 colunas: Vistoria final | Entrega ao cliente

### Inputs compactos

- Altura: `h-8` (32px) — substitui `h-9` em todas as seções da Abertura
- Labels: `text-[9px] font-bold uppercase tracking-wide text-neutral-400`
- Campos readonly (dados do cliente): `bg-neutral-50 border-neutral-100 cursor-default select-all`
- Campos editáveis: `bg-white border-input`

---

## Superfície 3 — CustomerSearch (componente compartilhado)

Usado tanto no drawer quanto na aba Abertura.

### Estados

**Vazio (sem cliente)**
```
[🔍 Buscar por nome, CPF ou telefone...]  [+ Novo]
```

**Digitando (dropdown aberto)**
```
[🔍 João...]                              [+ Novo]
└─ João da Silva      ***-12 · ****-1234
└─ João Pereira       ***-45 · ****-5678
└─ [+ Cadastrar "João"]
```

**Selecionado (chip)**
```
[✓ João da Silva  ✕]  ou buscar outro
```
- Chip: `bg-green-50 border-green-300 text-green-800`
- ✕ limpa a seleção e volta ao estado vazio
- "buscar outro" = atalho para focar no campo de busca sem precisar limpar primeiro

**Criando novo (form inline)**
```
← Voltar
👤 Novo cliente
Nome completo *      [________________]
CPF *     [_______]  Telefone *  [____]
E-mail *             [________________]
Nascimento [___]     Endereço    [____]
                              [Cadastrar]
```

### Comportamento do chip no contexto da aba Abertura

- Chip aparece no lugar do campo de busca
- Abaixo do chip, os campos do cliente (CPF, telefone, email, etc.) aparecem automaticamente via `useCustomerDetail(id)`
- ✕ no chip: limpa seleção, todos os campos readonly desaparecem, campo de busca reaparece

---

## Mudanças de Backend

### 1. `UnifiedCustomer` — endereço separado

Migração que substitui `address: CharField(max_length=300)` por campos individuais:

```python
zip_code    = models.CharField(max_length=9,   blank=True, default="", verbose_name="CEP")
street      = models.CharField(max_length=200,  blank=True, default="", verbose_name="Rua / Av.")
street_number = models.CharField(max_length=20, blank=True, default="", verbose_name="Número")
complement  = models.CharField(max_length=100,  blank=True, default="", verbose_name="Complemento")
neighborhood = models.CharField(max_length=100, blank=True, default="", verbose_name="Bairro")
city        = models.CharField(max_length=100,  blank=True, default="", verbose_name="Cidade")
state       = models.CharField(max_length=2,    blank=True, default="", verbose_name="UF")
```

- Manter `address` como `property` computada (`f"{street}, {street_number} — {neighborhood}"`) para backward compat com código legado
- `UnifiedCustomerDetailSerializer`: adicionar os 7 novos campos
- `UnifiedCustomerCreateSerializer`: adicionar os 7 novos campos (opcionais)
- Migration: `0004_unifiedcustomer_address_split`

### 2. `ServiceOrder` — campo versão

```python
vehicle_version = models.CharField(max_length=50, blank=True, default="", verbose_name="Versão")
```

- Migration: `0005_serviceorder_vehicle_version` (ou número correto da sequência)
- Serializers de criação e update: adicionar `vehicle_version`
- Schema Zod frontend: adicionar `vehicle_version?: string`

### 3. Validação CPF/email obrigatórios na criação via OS

- Frontend: ao criar cliente no inline form da OS, CPF e email são required (validação Zod)
- Backend: sem alteração no serializer principal (CPF e email continuam opcionais no cadastro admin)

---

## Mudanças de Frontend

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/app/(app)/service-orders/_components/NewOSDrawer.tsx` | Criar — drawer que envolve o form de criação |
| `src/app/(app)/service-orders/new/page.tsx` | Modificar — redireciona para /os com drawer aberto |
| `src/app/(app)/service-orders/page.tsx` | Modificar — adiciona botão "Nova OS" que abre drawer |
| `src/app/(app)/service-orders/kanban/page.tsx` | Modificar — idem |
| `src/app/(app)/service-orders/[id]/_components/shared/CustomerSearch.tsx` | Modificar — chip state, "buscar outro", remoção "Nome na OS" |
| `src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx` | Modificar — chip, campos endereço separados, sem "Nome na OS" |
| `src/app/(app)/service-orders/[id]/_components/sections/VehicleSection.tsx` | Modificar — slot visual logo, versão, inputs h-8 |
| `src/app/(app)/service-orders/[id]/_components/tabs/OpeningTab.tsx` | Modificar — layout duas colunas |
| `src/app/(app)/service-orders/[id]/_hooks/useCustomerSearch.ts` | Modificar — CustomerDetail com campos de endereço separados |
| `src/app/(app)/service-orders/[id]/_schemas/service-order.schema.ts` | Modificar — adicionar vehicle_version |
| `src/app/(app)/service-orders/new/_schemas/new-os.schema.ts` | Modificar — adicionar vehicle_version, validação obrigatória CPF/email |

### Novo componente: `NewOSDrawer`

```tsx
// Wraps o NewOSForm num Sheet (shadcn/ui) deslizando da direita
// Props: open: boolean, onOpenChange: (v: boolean) => void
// Usado em: /os page, /os/kanban page
// Largura: 420px (sm:420px)
```

### OpeningTab — nova estrutura duas colunas

```tsx
<div className="space-y-3 py-4">
  {/* Barra tipo — full width */}
  <TypeBar form={form} />

  {/* Duas colunas */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {/* Esquerda */}
    <div className="space-y-3">
      <CustomerSection form={form} />
      {customerType === "insurer" && <InsurerSection form={form} />}
      <EntrySection form={form} />
    </div>
    {/* Direita */}
    <div className="space-y-3">
      <VehicleSection form={form} />
      <SchedulingSection form={form} />  {/* renomear para PrazosSection */}
    </div>
  </div>
</div>
```

### CustomerSearch — estado chip

```tsx
// Quando value !== null:
// - Mostrar chip verde com nome e botão ✕
// - "ou buscar outro" linka para focar no input de busca
// - Remover campo readOnly com nome do cliente no input principal
// Quando value === null:
// - Mostrar input de busca normal + botão "+ Novo"
```

---

## Decisões e Não-Escopo

| Decisão | Justificativa |
|---------|---------------|
| Drawer não dialog | Usuário preferiu drawer (mais itens, menos largura, compacto) |
| Duas colunas na Abertura | Elimina scroll e aproveita widescreen dos consultores |
| Toggle pill no lugar de cards | Cards grandes desperdiçam espaço pra informação simples |
| Slot visual do veículo (56px) | Reserva espaço para logo da montadora futura — sem implementar integração agora |
| `address` como `property` e não remoção | Backward compat com código que usa `address` string |
| CPF/email obrigatórios só no frontend | Backend permanece flexível para uso admin |
| FinalSurveySection | Movida pra dentro de PrazosSection (Prazos e Entrega) na coluna direita |
| SchedulingSection | Renomeada PrazosSection, absorve EntrySection de datas de entrega |
| `PrivateSection` | Removida — quotation_date vai para barra de tipo (condicional a Particular) |
