# Pipeline Completa da OS — Grupo DS Car

> Documento de referência para melhorias no ERP web e app mobile.
> Gerado em: 2026-05-08 | Fonte: backend/core/apps/service_orders/ + apps/dscar-web + apps/mobile

---

## 1. Abertura da OS (Status: `reception`)

### Campos obrigatórios — Backend vs Frontend

| Campo | Backend (API) | Frontend Web (NewOS Form) | Mobile (4 Steps) |
|-------|:---:|:---:|:---:|
| `customer_name` | Opcional* | **Obrigatório** | **Obrigatório** |
| `plate` | **Obrigatório** | **Obrigatório** (7-8 chars) | **Obrigatório** |
| `customer_type` | Opcional | **Obrigatório** | **Obrigatório** |
| `customer_id` (Person FK) | Opcional | **Obrigatório** | Opcional (busca) |
| `make` | Opcional | **Obrigatório** | Auto (API placa) |
| `model` | Opcional | **Obrigatório** | Auto (API placa) |
| `insurer` (se seguradora) | **Obrigatório** | **Obrigatório** | **Obrigatório** |
| `insured_type` (se seguradora) | **Obrigatório** | **Obrigatório** | **Obrigatório** |

*Backend aceita `customer_name` blank, mas auto-popula via Person FK se disponível.

### Campos gerados automaticamente na abertura:
- `number` — MAX+1 (lock de linha)
- `consultant` — auto-atribuído ao usuário que abriu (se não informado)
- `status` — sempre `reception`
- `opened_at` — auto_now_add

### Campos de seguradora (quando `customer_type = "insurer"`):
| Campo | Descrição | Obrigatório |
|-------|-----------|:-----------:|
| `insurer` | FK para seguradora | Sim |
| `insured_type` | `insured` (segurado) ou `third` (terceiro) | Sim |
| `casualty_number` | Número do sinistro | Não |
| `deductible_amount` | Valor da franquia (só para segurado) | Não |
| `broker_name` | Nome do corretor | Não |
| `expert` | FK para perito | Não |
| `expert_date` | Data de visita do perito | Não |
| `survey_date` | Data da vistoria da seguradora | Não |

### Campos de particular (quando `customer_type = "private"`):
| Campo | Descrição | Obrigatório |
|-------|-----------|:-----------:|
| `quotation_date` | Data de orçamentação | Não |

---

## 2. Os 17 Status do Kanban

| # | Status | Label PT | Terminal? |
|---|--------|----------|:---------:|
| 1 | `reception` | Recepção | |
| 2 | `initial_survey` | Vistoria Inicial | |
| 3 | `budget` | Orçamento | |
| 4 | `waiting_auth` | Aguardando Autorização | |
| 5 | `authorized` | Autorizada | |
| 6 | `waiting_parts` | Aguardando Peças | |
| 7 | `repair` | Reparo | |
| 8 | `mechanic` | Mecânica | |
| 9 | `bodywork` | Funilaria | |
| 10 | `painting` | Pintura | |
| 11 | `assembly` | Montagem | |
| 12 | `polishing` | Polimento | |
| 13 | `washing` | Lavagem | |
| 14 | `final_survey` | Vistoria Final | |
| 15 | `ready` | Pronto para Entrega | |
| 16 | `delivered` | Entregue | Sim |
| 17 | `cancelled` | Cancelada | Sim |

---

## 3. Mapa de Transições Válidas

```
reception          → initial_survey, cancelled
initial_survey     → budget, waiting_auth
budget             → waiting_parts, repair, waiting_auth
waiting_auth       → authorized, cancelled
authorized         → waiting_parts, repair
waiting_parts      → repair
repair             → mechanic, bodywork, polishing, budget
mechanic           → bodywork, polishing, budget
bodywork           → painting, budget
painting           → assembly, budget
assembly           → polishing, budget
polishing          → washing, budget
washing            → final_survey, budget
final_survey       → ready
ready              → delivered
delivered          → (nenhuma)
cancelled          → (nenhuma)
```

### Fluxo visual (caminho feliz — seguradora):

```
RECEPTION → INITIAL_SURVEY → BUDGET → WAITING_AUTH → AUTHORIZED
                                                         │
                              ┌───────────────────────────┤
                              ▼                           ▼
                        WAITING_PARTS ──────────────► REPAIR
                                                         │
                  ┌──────────────────────┬───────────────┤
                  ▼                      ▼               ▼
              MECHANIC ──────────► BODYWORK          POLISHING
                                      │                  │
                                      ▼                  ▼
                                  PAINTING            WASHING
                                      │                  │
                                      ▼                  ▼
                                  ASSEMBLY          FINAL_SURVEY
                                      │                  │
                                      ▼                  ▼
                                  POLISHING           READY
                                      │                  │
                                      ▼                  ▼
                                   WASHING           DELIVERED
                                      │
                                      ▼
                                 FINAL_SURVEY → READY → DELIVERED
```

**Nota:** Da maioria dos status de oficina (`repair` até `washing`), é possível voltar para `budget` quando seguradora envia nova versão de orçamento.

---

## 4. Transições Automáticas (campo preenchido → status muda)

| Campo preenchido | De (status válidos) | Para | Caso de uso |
|-----------------|--------------------|----|-------------|
| `authorization_date` | `budget`, `waiting_auth` | `authorized` | Seguradora autoriza |
| `scheduling_date` | `reception` | `initial_survey` | Agendamento feito |
| `final_survey_date` | `washing` | `final_survey` | Vistoria final marcada |
| `client_delivery_date` | `ready` | `delivered` | Entrega ao cliente |
| `quotation_date` | `budget`, `initial_survey` | `waiting_auth` | Particular: orçamento feito |

### Auto-preenchimentos em transições manuais:

| Transição manual | Campo auto-preenchido |
|------------------|----------------------|
| → `initial_survey` | `entry_date` = agora (se vazio) |
| → `authorized` | `authorization_date` = agora (se vazio) |
| → `final_survey` | `final_survey_date` = agora (se vazio) |
| → `delivered` | `client_delivery_date` = agora, `delivered_at` = agora |

### Transição por importação (Cilia/XML):

1. Chega nova versão de orçamento (API Cilia, HDI HTML, XML Porto/Azul/Itaú)
2. Cria `ServiceOrderVersion` com `version_number` incremental
3. Salva `previous_status` = status atual da OS
4. Move OS automaticamente para `budget`
5. Ao **aprovar a versão**, OS retorna ao `previous_status`

---

## 5. Detalhamento por Fase

### RECEPÇÃO (`reception`)
- **Ação:** Abrir OS com dados mínimos (placa + cliente)
- **Preencher idealmente:** tipo de atendimento, seguradora/particular, dados veículo, consultor
- **Saída:** arrastar para `initial_survey` OU preencher `scheduling_date`

### VISTORIA INICIAL (`initial_survey`)
- **Ação:** Fotografar veículo (pasta `vistoria_inicial`), preencher checklist entrada
- **Checklist:** 7 categorias × status (ok/atenção/crítico/pendente)
- **Fotos mobile:** 12 slots obrigatórios + extras ilimitados
- **Saída:** arrastar para `budget` ou `waiting_auth`

### ORÇAMENTO (`budget`)
- **Ação:** Adicionar peças e serviços (manual ou importação Cilia/XML)
- **Versões:** Cada importação cria `ServiceOrderVersion` com itens detalhados
- **`previous_status`:** Salva de onde veio; ao aprovar versão, retorna
- **Saída:** arrastar para `waiting_parts`, `repair`, ou `waiting_auth`

### AGUARDANDO AUTORIZAÇÃO (`waiting_auth`)
- **Seguradora:** Aguarda parecer (concordado/autorizado/correção/negado)
- **Particular:** Aguarda cliente aprovar orçamento
- **Saída:**
  - Preencher `authorization_date` → auto para `authorized`
  - Aprovar `ServiceOrderVersion` → volta ao `previous_status`
  - Cancelar → `cancelled`

### AUTORIZADA (`authorized`)
- **Ação:** Iniciar logística de peças ou reparo direto
- **Saída:** arrastar para `waiting_parts` ou `repair`

### AGUARDANDO PEÇAS (`waiting_parts`)
- **Ação:** Acompanhar status de cada peça (bloqueada, cotação, comprada, recebida...)
- **4 origens de peça:** estoque, compra, seguradora, manual
- **Saída:** arrastar para `repair` quando peças prontas

### REPARO (`repair`) → MECÂNICA → FUNILARIA → PINTURA → MONTAGEM → POLIMENTO → LAVAGEM
- **Ação:** Execução dos trabalhos. Apontar horas (`ApontamentoHoras`)
- **Fluxo típico:** repair → bodywork → painting → assembly → polishing → washing
- **Variações:** pode pular etapas ou voltar para `budget`

### VISTORIA FINAL (`final_survey`)
- **Ação:** Fotografar veículo pronto, checklist de saída
- **Saída:** arrastar para `ready`

### PRONTO PARA ENTREGA (`ready`)
- **Ação:** Emitir NF-e/NFS-e, preparar documentação
- **NF obrigatória para particular:** `nfe_key` ou `nfse_number`
- **Saída:** formulário de entrega (mileage_out, notes, fiscal)

### ENTREGUE (`delivered`) — TERMINAL
- OS fechada. Peças/serviços imutáveis
- Cria `BudgetSnapshot` (trigger: delivery)
- Cria `ReceivableDocument` automaticamente
- `delivered_at` e `client_delivery_date` preenchidos

### CANCELADA (`cancelled`) — TERMINAL
- Só de `reception` ou `waiting_auth`

---

## 6. Entidades Relacionadas

| Entidade | Descrição | Quando |
|----------|-----------|--------|
| `ServiceOrderPart` | Peça da OS | Orçamento / importação |
| `ServiceOrderLabor` | Serviço / mão de obra | Orçamento / importação |
| `ServiceOrderPhoto` | Foto imutável | Vistorias, checklists |
| `ChecklistItem` | Item de checklist textual | Entrada/acomp./saída |
| `BudgetSnapshot` | Snapshot imutável do orçamento | Import/save/entrega |
| `ServiceOrderVersion` | Versão orçamento (seguradora) | Importação Cilia/XML |
| `ServiceOrderVersionItem` | Item de uma versão | Com a versão |
| `StatusTransitionLog` | Log de transição | Automático |
| `ServiceOrderActivityLog` | Histórico detalhado | Automático |
| `ServiceOrderEvent` | Timeline universal | Automático |
| `ServiceOrderParecer` | Parecer seguradora/interno | Importação/manual |
| `ApontamentoHoras` | Tempo do técnico | Fases de reparo |
| `ImpactAreaLabel` | Labels de áreas de impacto | Importação |

---

## 7. Campos de Data e seus Efeitos

| Campo | Significado | Efeito automático |
|-------|------------|-------------------|
| `opened_at` | Data de abertura | auto_now_add |
| `entry_date` | Entrada do veículo | Auto-preenchido ao ir para `initial_survey` |
| `scheduling_date` | Agendamento | `reception` → `initial_survey` |
| `authorization_date` | Autorização seguradora | `budget`/`waiting_auth` → `authorized` |
| `quotation_date` | Orçamento (particular) | `budget`/`initial_survey` → `waiting_auth` |
| `service_authorization_date` | Autorização do serviço | Informativo |
| `repair_days` | Dias estimados de reparo | Calcula `estimated_delivery_date` |
| `estimated_delivery_date` | Previsão de entrega | Auto: `entry_date + repair_days` |
| `final_survey_date` | Vistoria final | `washing` → `final_survey` |
| `client_delivery_date` | Entrega ao cliente | `ready` → `delivered` |
| `delivery_date` | Data/hora de entrega | Informativo |
| `delivered_at` | KPI de entrega | Auto-preenchido na entrega |

---

## 8. Kanban — Web vs Mobile

### Web (17 colunas individuais, 5 grupos visuais):
| Grupo | Colunas |
|-------|---------|
| **Entrada** | reception, initial_survey, budget, waiting_auth, authorized |
| **Produção** | waiting_parts, repair, mechanic, bodywork, painting, assembly |
| **Acabamento** | polishing, washing, final_survey |
| **Saída** | ready, delivered |
| **Canceladas** | cancelled |

### Mobile (7 colunas agrupadas):
| Coluna | Status agrupados |
|--------|-----------------|
| Recepção | reception, initial_survey |
| Orçamento | budget, waiting_auth |
| Autorizado | authorized, waiting_parts |
| Em Reparo | repair, mechanic, bodywork, painting, assembly |
| Vistoria | polishing, washing, final_survey |
| Pronto | ready |
| Entregue | delivered |

---

## 9. Assinaturas Digitais (Mobile)

| Tipo | Quando | Quem assina |
|------|--------|-------------|
| `OS_OPEN` | Abertura da OS | Cliente |
| `VISTORIA_ENTRADA` | Vistoria de entrada | Cliente |
| `BUDGET_APPROVAL` | Aprovação de orçamento | Cliente |
| `COMPLEMENT_APPROVAL` | Aprovação de complemento | Cliente |
| `INSURANCE_ACCEPTANCE` | Aceite de seguradora | Cliente |
| `OS_DELIVERY` | Entrega do veículo | Cliente |

---

## 10. Análise de Gaps e Oportunidades de Melhoria

### A. VALIDAÇÕES AUSENTES NAS TRANSIÇÕES

**Problema atual:** A transição de status hoje valida APENAS se a transição está no `VALID_TRANSITIONS`. Não valida pré-requisitos de negócio.

| Transição | Validação que FALTA | Impacto |
|-----------|--------------------|---------|
| `reception` → `initial_survey` | Nenhum dado de veículo preenchido (make/model) | OS sem dados mínimos avança |
| `initial_survey` → `budget` | Sem fotos de vistoria inicial | Perde evidência para seguradora |
| `initial_survey` → `budget` | Sem checklist de entrada | Sem registro de estado do veículo |
| `budget` → `waiting_auth` | Sem peças E sem serviços | Orçamento vazio aguardando aprovação |
| `waiting_auth` → `authorized` | Sem valor de franquia (segurado) | Autoriza sem saber quanto cobrar |
| `authorized` → `repair` | Sem peças quando `waiting_parts` era necessário | Pode iniciar reparo sem peças |
| `washing` → `final_survey` | Sem fotos de acompanhamento | Sem registro do processo |
| `final_survey` → `ready` | Sem checklist de saída | Entrega sem verificação |
| `final_survey` → `ready` | Sem fotos de vistoria final | Sem evidência do resultado |
| `ready` → `delivered` | Sem NF-e/NFS-e (particular) | Já validada ✅ (única que existe) |
| `ready` → `delivered` | Sem assinatura do cliente | Entrega sem comprovante |

### B. GAPS WEB vs MOBILE

| Funcionalidade | Web | Mobile | Gap |
|----------------|:---:|:------:|-----|
| Abertura de OS | ✅ Completo (9 tabs) | ✅ 4 steps | Web mais completo |
| Kanban drag-and-drop | ✅ @dnd-kit | ❌ Tap only | Mobile sem drag |
| Transição de status | ✅ Dropdown + Kanban | ✅ Hook useUpdateOSStatus | OK |
| Fotos de vistoria | ✅ Upload por pasta | ✅ 12 slots + extras | Mobile mais estruturado |
| Checklist textual | ✅ Bulk save | ⚠️ Limitado | Expandir no mobile |
| Assinatura digital | ❌ Não implementado | ✅ Canvas + fullscreen | **Falta no web** |
| Apontamento de horas | ⚠️ Básico | ⚠️ LaborTab | Sem timer real-time |
| Marca d'água em foto | ❌ | ✅ Consultor + data | **Falta no web** |
| Offline | ❌ | ✅ WatermelonDB + MMKV | N/A (web = online) |
| Versões/Cilia import | ✅ Completo | ❌ | **Falta no mobile** |
| Resumo financeiro | ✅ Completo | ⚠️ Básico | Expandir no mobile |
| Fechamento/entrega | ✅ Tab dedicada | ⚠️ Limitado | Expandir no mobile |
| Emissão NF-e/NFS-e | ✅ | ❌ | **Falta no mobile** |
| Complemento particular | ✅ | ❌ | **Falta no mobile** |
| Histórico detalhado | ✅ Timeline rica | ❌ | **Falta no mobile** |

### C. MELHORIAS PROPOSTAS DE VALIDAÇÃO

#### Nível 1 — Warnings (não bloqueia, mas alerta)
- `reception → initial_survey`: avisar se veículo sem marca/modelo
- `budget → waiting_auth`: avisar se orçamento vazio (0 peças + 0 serviços)
- `authorized → repair`: avisar se há peças com status `aguardando_cotacao` ou `em_cotacao`
- `final_survey → ready`: avisar se sem fotos de vistoria final

#### Nível 2 — Soft blocks (bloqueia com opção de override por MANAGER+)
- `initial_survey → budget`: exigir pelo menos 1 foto de vistoria inicial
- `initial_survey → budget`: exigir checklist de entrada com pelo menos 50% preenchido
- `final_survey → ready`: exigir checklist de saída
- `ready → delivered`: exigir assinatura do cliente (quando mobile disponível)

#### Nível 3 — Hard blocks (bloqueia sempre)
- `ready → delivered` (particular): NF-e ou NFS-e obrigatória ✅ (já existe)
- `waiting_auth → authorized` (seguradora): exigir `authorization_date`
- Não permitir `delivered` se `parts_total + services_total = 0` sem confirmação

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
