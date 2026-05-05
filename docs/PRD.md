# PRD — DS Car ERP

> **Documento de produto.** Define o que o sistema é, para quem é, o que entra no MVP e o que fica fora.
> Qualquer mudança de escopo passa por revisão deste documento antes de virar código.
>
> **Versão:** 2.0 · **Data:** 2026-05-04 · **Autor:** Paddock Solutions · **Cliente:** DS Car Centro Automotivo (Manaus, AM)

---

## 1. Visão e contexto

### 1.1 Problema

DS Car opera com um sistema legado (Box Empresa) limitado, lento e sem:
- Apontamento de execução com fotos no pátio (mecânico, funileiro, pintor)
- Vistorias com assinatura digital e marca d'água em fotos
- Importação automática de sinistros via API
- Mobile/tablet para operação em campo

### 1.2 Cliente

- **Razão social:** D S CAR CENTRO AUTOMOTIVO LTDA
- **Localidade:** Manaus, AM
- **Atividade:** Centro automotivo (funilaria, pintura, polimento, lavagem)
- **Volume:** ~10.000 OS no histórico legado · 7.000 clientes · 30 funcionários
- **Mix:** ~50% sinistros de seguradora · ~50% particular

### 1.3 Estado atual

- Backend Django, frontend Next.js e mobile React Native **em desenvolvimento**
- Operação real continua no legado
- Múltiplos módulos foram construídos além do MVP (motor de precificação, inbox, lojas) — listados em §9

### 1.4 Definição de sucesso

> **DS Car opera 100% no novo sistema, com todas as notas fiscais emitidas pelo ERP, e o legado é desligado.**

---

## 2. Personas

### 2.1 Consultor
Atende o cliente na recepção. Abre OS, conduz vistoria inicial, acompanha Kanban, comunica cliente.
**Volume:** 3–5 ativos.

### 2.2 Chefe de oficina
Coordena equipe de pátio. **Persona central do app mobile/tablet.**
Aponta execução (quem fez cada etapa), anexa fotos com marca d'água, conduz vistorias, coleta assinatura digital.
**Volume:** 1–2.

### 2.3 Equipe de pátio (executores)
Mecânicos, funileiros, pintores, polidores, lavadores. **Não logam no MVP.** São apontados pelo chefe de oficina.
**Volume:** ~20–25.

### 2.4 Administrativo / financeiro
Emite NF-e, NFS-e, NFC-e. Registra recebimentos. Marca OS como faturada/quitada.
**Volume:** 1–2.

### 2.5 Setor de compras / estoque
Cadastra peças (NF-e XML ou recibo manual), reserva peças para OS, aciona compra sob demanda.
**Volume:** 2–3.

---

## 3. Conceitos fundamentais

### 3.1 Ordem de Serviço (OS)

Unidade central. Representa um veículo em atendimento do momento que entra até estar entregue, faturado e quitado.

Toda OS tem: Cliente (PF/PJ) · Veículo (placa + FIPE) · Origem · Status · Itens de peça · Itens de serviço · Vistorias/checklists · Apontamentos de execução · Documentos fiscais.

### 3.2 Definição de "OS fechada"

Uma OS está **fechada** se e somente se **três condições** simultâneas:
1. **Entregue** — veículo retirado
2. **Faturada** — todas as NFs emitidas
3. **Quitada** — todos os pagamentos recebidos

### 3.3 Origens da OS

| Origem | Pré-requisito | Quem aprova |
|---|---|---|
| **Sinistro de seguradora** | Importação Cilia ou manual | Seguradora via API/e-mail |
| **Orçamento particular** | Orçamento gerado e enviado | Cliente (verbal ou digital) |
| **Cadastro direto** | Veículo + cliente | Não exige autorização |

### 3.4 Status da OS (17 estados)

O sistema usa 17 estados que refletem as etapas reais da operação da DS Car:

```
reception (Recepção)
  ↓
initial_survey (Vistoria Inicial)
  ↓
budget (Orçamento)
  ↓
waiting_auth (Aguardando Autorização)
  ↓
authorized (Autorizada)
  ↓
waiting_parts (Aguardando Peças)
  ↓
repair (Reparo)
  ↓
mechanic (Mecânica)
  ↓
bodywork (Funilaria)
  ↓
painting (Pintura)
  ↓
assembly (Montagem)
  ↓
polishing (Polimento)
  ↓
washing (Lavagem)
  ↓
final_survey (Vistoria Final)
  ↓
ready (Pronto para Entrega)
  ↓
delivered (Entregue)

cancelled (Cancelada — terminal)
```

**Regras de transição:**
- Etapas de pátio (repair → washing) podem retornar ao budget quando necessário
- `delivered` e `cancelled` são terminais — sem saída
- Transições validadas no frontend (VALID_TRANSITIONS) E no backend (dupla proteção)
- Chefe de oficina avança status etapa a etapa conforme execução real

### 3.5 Fornecimento de peças

`fornecimento` é atributo do **item de peça**, não da OS inteira.

| Fornecimento | Quem paga | Destinatário NF-e |
|---|---|---|
| **Oficina** | DS Car (compra e revende) | Cliente ou seguradora |
| **Seguradora** | Seguradora intermedeia | Seguradora |

O sistema decide o destinatário da NF-e **por peça**, não por OS.

### 3.6 Vistorias, checklists e apontamentos

| Momento | Quando | Quem | Saída |
|---|---|---|---|
| **Vistoria inicial** | Antes de budget/waiting_auth | Consultor + chefe | Fotos + assinatura cliente |
| **Checklist de entrada** | Início da execução | Chefe de oficina | Fotos + itens (OK/Atenção/Crítico) |
| **Apontamento** | Durante etapas de pátio | Chefe de oficina | Texto + fotos + executor + timestamp |
| **Vistoria final** | Antes de "ready" | Consultor + chefe | Fotos + assinatura cliente |

### 3.7 Assinaturas digitais

| Quem | Como | Quando |
|---|---|---|
| **Cliente** | Canvas no tablet/mobile OU link remoto | Vistorias inicial e final |
| **CEO/Dono da oficina** | Assinatura salva uma vez no cadastro | Aparece automaticamente em documentos sobre "DS CAR Centro Automotivo" |
| **Funcionários** | Assinatura salva no cadastro (RH) | Aparece automaticamente quando fazem apontamento/vistoria |

Apenas o cliente assina repetidamente. CEO e funcionários têm assinaturas pré-salvas.

---

## 4. Fluxos principais

### 4.1 Fluxo: OS particular

```
1. Cliente chega ou liga
2. Consultor cria orçamento no sistema
3. Sistema gera link/PDF
4. Cliente autoriza
5. Orçamento → OS (status: reception → initial_survey)
6. Vistoria inicial (fotos + assinatura cliente)
7. → waiting_parts (cotação/compra) OU direto para repair
8. Execução: repair → mechanic → bodywork → painting → assembly → polishing → washing
   (chefe avança conforme etapas reais, apontando em cada)
9. → final_survey → ready → cliente avisado
10. Vistoria final + assinatura cliente
11. → delivered
12. Administrativo emite NF-e (peças) + NFS-e (serviços)
13. Pagamento recebido → OS fechada
```

### 4.2 Fluxo: OS de seguradora

```
1. Sinistro importado (Cilia API)
2. OS criada em waiting_auth
3. Seguradora autoriza (Cilia atualiza status)
4. → authorized → agendamento
5. Veículo entra → initial_survey (vistoria + assinatura)
6. → waiting_parts (separação fornecimento oficina/seguradora)
7. → Etapas de pátio com apontamentos
8. → final_survey → ready → delivered
9. Emissão fiscal:
   - NF-e peças fornecimento oficina (dest: seguradora)
   - NFS-e serviços (dest: seguradora)
   - NFC-e franquia (dest: segurado PF, se aplicável)
10. Recebimento → OS fechada
```

### 4.3 Fluxo: compra de peças

```
1. Consultor identifica peças necessárias
2. Setor de compras consulta estoque (WMS)
3. Em estoque → reserva (UnidadeFisica bloqueada para OS)
4. Sem estoque → PedidoCompra → OrdemCompra (aprovação MANAGER+)
5. Recebimento:
   - Com NF-e XML → NFeIngestaoService + MovimentacaoEstoque(ENTRADA_NF)
   - Sem NF-e → entrada manual + MovimentacaoEstoque(ENTRADA_MANUAL)
6. Peça reservada → liberada para execução
```

---

## 5. Requisitos funcionais

### 5.1 Gestão de OS

- **RF-OS-01** Criar OS pelos 3 caminhos (sinistro, particular, cadastro direto)
- **RF-OS-02** Numeração automática sequencial
- **RF-OS-03** Kanban com 17 status e transições válidas
- **RF-OS-04** Histórico imutável de mudanças de status
- **RF-OS-05** Histórico de alterações em campos editáveis
- **RF-OS-06** Edição de cliente, veículo e datas durante a vida da OS
- **RF-OS-07** Suporte a OS de cliente PF e PJ
- **RF-OS-08** Cálculo de totais: peças, serviços, descontos, total geral
- **RF-OS-09** Bloqueio de edição financeira após faturamento

### 5.2 Vistorias, checklists e assinaturas

- **RF-VIS-01** 4 momentos (§3.6) com templates específicos
- **RF-VIS-02** Fotos com marca d'água automática (data + OS#) no device
- **RF-VIS-03** Assinatura digital do cliente via canvas ou link remoto
- **RF-VIS-04** Assinaturas pré-salvas do CEO e funcionários (aparecem automaticamente)
- **RF-VIS-05** Apontamento durante etapas de pátio (texto + foto + executor)
- **RF-VIS-06** Fotos imutáveis (evidência) — apenas soft delete
- **RF-VIS-07** Checklist de itens com 3 estados (OK / Atenção / Crítico)
- **RF-VIS-08** Operação offline no mobile com sync

### 5.3 Estoque e compras (WMS completo)

- **RF-EST-01** Localização física hierárquica (Armazém → Rua → Prateleira → Nível)
- **RF-EST-02** Produtos comerciais separados: ProdutoComercialPeca + ProdutoComercialInsumo
- **RF-EST-03** Entrada via NF-e XML (parser + MovimentacaoEstoque automática)
- **RF-EST-04** Entrada manual (quando não há NF-e)
- **RF-EST-05** Reserva de peça por OS (UnidadeFisica bloqueada, select_for_update)
- **RF-EST-06** Saldo nunca negativo (CHECK constraint)
- **RF-EST-07** Distinção fornecimento oficina/seguradora por item
- **RF-EST-08** Movimentação imutável e auditável (7 tipos)
- **RF-EST-09** Contagem de inventário (cíclica por rua / total por armazém)
- **RF-EST-10** Pedido de Compra → Ordem de Compra com aprovação MANAGER+
- **RF-EST-11** Perdas/ajustes requerem aprovação MANAGER+ + evidência

### 5.4 Emissão fiscal

- **RF-FISC-01** NF-e (modelo 55) — peças
- **RF-FISC-02** NFS-e Manaus — serviços (LC116, IBGE 1302603)
- **RF-FISC-03** NFC-e (modelo 65) — franquia do segurado
- **RF-FISC-04** Emissão em qualquer momento após entrega (decisão do administrativo)
- **RF-FISC-05** Destinatário correto por peça (fornecimento oficina vs seguradora)
- **RF-FISC-06** XML autorizado armazenado no S3
- **RF-FISC-07** DANFE / DANFE NFC-e em PDF
- **RF-FISC-08** Cancelamento dentro do prazo legal
- **RF-FISC-09** Manifestação de NF-e recebidas
- **RF-FISC-10** Configuração fiscal espelhando cadastro SEFAZ

### 5.5 Importação de sinistros

- **RF-IMP-01** Integração Cilia (API) — fluxo principal MVP
- **RF-IMP-02** Importação cria OS em waiting_auth
- **RF-IMP-03** Atualização de status quando seguradora autoriza
- **RF-IMP-04** Vínculo com cadastro de seguradora local
- **RF-IMP-05** Importação Soma (Porto, Azul, Itaú, Mitsui via XML) — **fase 2**
- **RF-IMP-06** Importação HDI (HTML scraping) — **fase 3**

### 5.6 Cadastros

- **RF-CAD-01** Clientes (PF/PJ) com LGPD
- **RF-CAD-02** Veículos (busca por placa via FIPE)
- **RF-CAD-03** Seguradoras (logo, cor, abreviação, dados fiscais)
- **RF-CAD-04** Funcionários com função + assinatura digital salva
- **RF-CAD-05** Catálogo de peças
- **RF-CAD-06** Catálogo de serviços com preço sugerido

### 5.7 Financeiro básico (MVP)

- **RF-FIN-01** Contas a Receber (vinculada a OS)
- **RF-FIN-02** Contas a Pagar (fornecedores, folha)
- **RF-FIN-03** Registro de pagamentos/recebimentos
- **RF-FIN-04** Indicador de quitação na OS

---

## 6. Requisitos não-funcionais

### 6.1 LGPD e privacidade
- CPF, email, telefone: EncryptedField
- Logs sem PII
- Soft delete (anonimização, não deleção)
- Lookup por email_hash (SHA-256)

### 6.2 Auditoria
- Histórico imutável de status
- Histórico de alterações (quem, quando)
- MovimentacaoEstoque imutável

### 6.3 Mobile e offline
- Android + iOS + tablet Android
- Vistorias offline com sync
- Fotos com marca d'água local
- Assinatura via canvas
- Push notifications

### 6.4 Performance
- 30 usuários simultâneos
- Paginação 20 itens
- Busca placa/OS < 1s

### 6.5 Segurança
- Keycloak 24 (OIDC) em produção + dev-credentials em dev
- JWT RS256 (prod) / HS256 (dev)
- RBAC 5 níveis: OWNER > ADMIN > MANAGER > CONSULTANT > STOREKEEPER
- Erros de integração não vazam detalhes
- Uploads validados (extensão, tamanho, content-type)

---

## 7. Integrações

### 7.1 Cilia (sinistros) — MVP
- Direção: entrada (importação de sinistros)
- Já implementado: `apps.cilia` com OrcamentoCilia, ImportAttempt, parsers

### 7.2 Focus NF-e — MVP
- Direção: saída (emissão NF-e, NFS-e, NFC-e)
- Payload flat (Focus v2) — não aninhado
- Já implementado: `apps.fiscal` com builders + polling

### 7.3 placa-fipe.apibrasil.com.br — MVP
- POST público sem chave
- Consulta placa → marca/modelo/ano

### 7.4 Fora do MVP
- Soma (XML) — fase 2
- HDI (HTML scraping) — fase 3
- Asaas (cobrança) — fase 2
- Evolution API (WhatsApp) — fase 3

---

## 8. Stack tecnológica

Definida em detalhes no `CLAUDE.md`. Resumo:

| Camada | Stack |
|--------|-------|
| Backend | Django 5 + DRF + PostgreSQL 16 + Celery + Redis |
| Frontend web | Next.js 15 + TypeScript + Tailwind + shadcn/ui |
| Mobile | React Native + Expo SDK 52 + WatermelonDB |
| Auth | Keycloak 24 (prod) + dev-credentials (dev) via next-auth v5 |
| Infra | AWS (S3, ECS) + Coolify (VPS) + GitHub Actions |
| Multitenancy | django-tenants (schema-per-tenant) — mantida |

---

## 9. Fora do escopo do MVP

Módulos construídos parcialmente que **não fazem parte do MVP**. Não deletar — manter inativos.
Detalhes em `docs/backlog.md`.

| Módulo | Justificativa |
|---|---|
| Motor de precificação (MO-1 a MO-9) | DS Car precifica manualmente. Avaliar pós-MVP com IA |
| Inbox omnichannel | WhatsApp/Instagram não é prioridade |
| Lojas (peças, vidros, estética) | Feature nova, não substituição do legado |
| Hub SSO / portal multi-cliente | Sem 2º cliente |
| RH completo (folha, ponto, metas, vales) | Não é prioridade do legado |
| Financeiro avançado (DRE, balanço, fluxo de caixa) | MVP precisa só de AP/AR básico |
| Benchmark IA + ingestão PDF | Depende do motor |

**Critério para reativar:** MVP validado em produção + pedido explícito do cliente.

---

## 10. Critérios de aceitação do MVP

### Funcionais
- [ ] OS criada pelos 3 caminhos (particular, sinistro Cilia, cadastro direto)
- [ ] Kanban com 17 status e transições reais
- [ ] Chefe de oficina aponta execução com foto + executor no mobile
- [ ] Vistorias com marca d'água + assinatura do cliente (canvas/link)
- [ ] Assinaturas de CEO/funcionários pré-salvas e inseridas automaticamente
- [ ] Estoque WMS com reserva por OS e distinção fornecimento
- [ ] NF-e, NFS-e e NFC-e emitidas pelo sistema
- [ ] Importação Cilia com vínculo à seguradora
- [ ] OS só fecha quando entregue + faturada + quitada

### Operacionais
- [ ] DS Car 100% no novo sistema (legado desligado)
- [ ] 30 funcionários cadastrados
- [ ] Histórico do legado migrado (10k OS, 7k clientes)
- [ ] Mobile offline funcional
- [ ] Backups diários

### Fiscais
- [ ] Emissão em produção SEFAZ-AM
- [ ] NF-e, NFS-e e NFC-e válidas
- [ ] Manifestação de NF-e recebidas
- [ ] Cancelamento no prazo legal

---

## 11. Roadmap

### Fase 1 — MVP (substituir o legado)
Gestão de OS (17 status) + Vistorias + Assinaturas + Apontamento + Estoque WMS + Compras + Fiscal (NF-e/NFS-e/NFC-e) + Cilia + Cadastros + Mobile offline + AP/AR básico + Migração legado

### Fase 2 — Expansão
Importação Soma (XML) + Asaas (cobrança) + Relatórios financeiros + Refinamentos do MVP

### Fase 3 — Funcionalidades avançadas
Motor de precificação (com IA) + HDI + Inbox omnichannel

### Fase 4 — Plataforma multi-cliente
Reativação de multitenancy completa + Hub SSO + 2º cliente

---

## 12. Glossário

| Termo | Definição |
|---|---|
| **OS** | Ordem de Serviço |
| **OS fechada** | Entregue + faturada + quitada |
| **Fornecimento** | Atributo da peça: "oficina" ou "seguradora" |
| **Vistoria** | Registro fotográfico + assinatura |
| **Checklist** | Conferência de itens (OK/Atenção/Crítico) |
| **Apontamento** | Registro de execução (executor + foto + texto) |
| **Franquia** | Valor pago pelo segurado à oficina → NFC-e |
| **Cilia** | Plataforma de sinistros multi-seguradora |
| **WMS** | Warehouse Management System |
