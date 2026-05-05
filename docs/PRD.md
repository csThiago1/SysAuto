# PRD — DS Car ERP

> **Documento único de produto.** Define o que o sistema é, para quem é, o que entra no MVP e o que fica fora. É a fonte da verdade do escopo. Qualquer mudança de escopo passa por revisão deste documento antes de virar código.
>
> **Versão:** 1.0 · **Data:** 2026-05-05 · **Autor:** Paddock Solutions · **Cliente:** DS Car Centro Automotivo (Manaus, AM)

---

## 1. Visão e contexto

### 1.1 Problema

DS Car opera hoje com um sistema legado (Box Empresa) para gestão de Ordens de Serviço, estoque e fiscal. O legado é limitado, lento e não suporta:

- Apontamento de execução com fotos no pátio (mecânico, funileiro, pintor)
- Vistorias com assinatura digital e marca d'água em fotos
- Importação automática de sinistros via API
- Mobile/tablet para operação em campo

A Paddock Solutions desenvolve um ERP customizado para substituir o legado, com paridade funcional e ganhos operacionais em apontamento, vistoria e fiscal.

### 1.2 Cliente

- **Razão social:** D S CAR CENTRO AUTOMOTIVO LTDA
- **Localidade:** Manaus, AM
- **Atividade:** Centro automotivo (funilaria, pintura, polimento, lavagem) com forte volume de seguradoras
- **Volume estimado:** ~10.000 OS no histórico legado · 7.000 clientes
- **Equipe:** 30 funcionários
- **Mix de atendimento:** ~50% sinistros de seguradora · ~50% particular

### 1.3 Estado atual do sistema

- Backend Django, frontend Next.js e mobile React Native **em desenvolvimento, não em produção**
- Toda a operação real continua no sistema legado
- Múltiplos módulos foram construídos parcialmente (motor de precificação, inbox omnichannel, lojas) — todos estão **fora do escopo MVP** e listados no item **§9**
- Substituição do legado é o objetivo do MVP

### 1.4 Definição de sucesso do MVP

> **DS Car opera 100% no novo sistema, com todas as notas fiscais sendo emitidas pelo ERP, e o legado é desligado.**

---

## 2. Personas

### 2.1 Consultor

**Quem:** atende o cliente na recepção. Porta de entrada de toda OS.

**O que faz no sistema:**
- Abre OS por 3 caminhos (ver §3.3)
- Conduz vistoria inicial junto com chefe de oficina
- Acompanha o status da OS no Kanban
- Comunica cliente (autorização, peças, pronto)

**Volume estimado:** 3–5 consultores ativos.

### 2.2 Chefe de oficina

**Quem:** coordena a equipe de pátio. **É a persona central do app mobile/tablet no MVP.**

**O que faz no sistema:**
- Aponta no app/tablet quem fez cada etapa (mecânico, funileiro, pintor, polidor, lavador)
- Anexa fotos de execução com marca d'água
- Conduz vistorias (entrada, saída, inicial, final) junto com consultor
- Coleta assinatura digital do cliente nas vistorias
- Não cria OS — apenas executa e aponta

**Volume estimado:** 1–2 chefes de oficina.

### 2.3 Equipe de pátio (executores)

**Quem:** mecânicos, funileiros, pintores, polidores, lavadores.

**O que fazem no sistema:** **nada diretamente no MVP.** São apontados pelo chefe de oficina. Aparecem no sistema como recurso (cadastro de funcionário) e nos registros de execução, mas não logam.

**Volume estimado:** ~20–25 executores.

### 2.4 Administrativo / financeiro

**Quem:** responsável pelo fechamento financeiro da OS.

**O que faz no sistema:**
- Emite NF-e, NFS-e, NFC-e (ver §5.5)
- Registra recebimentos
- Marca OS como faturada e quitada
- Acompanha contas a pagar/receber básicas

**Volume estimado:** 1–2 pessoas (inicialmente o próprio fundador).

### 2.5 Setor de compras / estoque

**Quem:** equipe dedicada que negocia com fornecedores e controla entrada/saída de peças.

**O que faz no sistema:**
- Cadastra peças no estoque a partir de NF-e XML ou recibo manual
- Reserva peças para OS específicas
- Aciona compra sob demanda quando peça não tem em estoque
- Não emite NF (responsabilidade do administrativo)

**Volume estimado:** 2–3 pessoas.

---

## 3. Conceitos fundamentais

### 3.1 Ordem de Serviço (OS)

Unidade central do sistema. Representa um veículo em atendimento na DS Car, do momento em que entra (ou é cadastrado) até estar entregue, faturado e quitado.

Toda OS tem:
- **Cliente** (PF ou PJ)
- **Veículo** (placa + marca/modelo/ano via FIPE)
- **Origem** (particular, sinistro, ou cadastro direto)
- **Status** (1 dos 9 — ver §3.4)
- **Itens de peça** (cada uma com fornecimento — ver §3.5)
- **Itens de serviço**
- **Vistorias e checklists** (ver §3.6)
- **Apontamentos de execução** (livre — texto + foto + executor)
- **Documentos fiscais** (NF-e / NFS-e / NFC-e)

### 3.2 Definição de "OS fechada"

Uma OS está **fechada** se e somente se as **três** condições forem verdadeiras simultaneamente:

1. **Entregue** — veículo retirado pelo cliente
2. **Faturada** — todas as NFs aplicáveis emitidas
3. **Quitada** — todos os pagamentos recebidos

Faltando qualquer uma das três, a OS está em outro status (entregue mas não faturada, faturada mas não quitada, etc.).

### 3.3 Tipos de OS (origem)

OS pode nascer por **3 caminhos**:

| Origem | Pré-requisito | Quem aprova |
|---|---|---|
| **Sinistro de seguradora** | Importação automática (Cilia) ou manual | Seguradora autoriza via API ou e-mail |
| **Orçamento particular** | Orçamento gerado e enviado ao cliente | Cliente autoriza (verbal ou digital) |
| **Cadastro direto** | Apenas dados de veículo + cliente | Não exige autorização — usado para histórico/cadastro |

### 3.4 Status da OS (9 estados)

```
Em vistoria
   ↓
Aguardando autorização
   ↓
Autorizado
   ↓
Aguardando peças          ← (após cotação/compra)
   ↓
Aguardando cliente        ← (cliente precisa estar presente para algo)
   ↓
Em serviço                ← (apontamentos livres por etapa)
   ↓
Carro pronto
   ↓
Carro entregue
   ↓
OS fechada                ← (entregue + faturada + quitada)
```

**Regras de transição:**
- Avanço sequencial é o caminho feliz
- Retornos a status anterior são permitidos quando justificado (ex.: nova peça necessária → volta para "aguardando peças")
- "OS fechada" é absorvente — não admite saída
- "Cancelada" existe como status terminal alternativo (não está no fluxo principal)

### 3.5 Fornecimento de peças

**Regra crítica:** `fornecimento` é atributo do **item de peça**, não da OS inteira.

Em uma única OS, peças podem ter fornecimentos diferentes:

| Fornecimento | Quem paga a peça | Destinatário da NF-e da peça |
|---|---|---|
| **Oficina** | DS Car (compra e revende) | Cliente (PF/PJ) ou seguradora dependendo do tipo da OS |
| **Seguradora** | Seguradora (DS Car só intermedeia) | Seguradora |

Implicação: o sistema precisa decidir o destinatário da NF-e **por peça**, não por OS.

### 3.6 Vistorias e checklists

**Quatro momentos** de registro durante a vida da OS:

| Momento | Quando | Quem | Saída |
|---|---|---|---|
| **Vistoria inicial** | Antes de "aguardando autorização" | Consultor + chefe de oficina | Fotos + assinatura digital do cliente |
| **Checklist de entrada** | No início da execução | Chefe de oficina | Fotos + checklist de itens |
| **Acompanhamento** | Durante "em serviço" | Chefe de oficina | Texto livre + fotos + executor (livre, sem etapas pré-definidas) |
| **Vistoria final + checklist de saída** | Antes de "carro pronto" | Consultor + chefe de oficina | Fotos + assinatura digital do cliente |

**Decisão de design:** acompanhamento durante "em serviço" é **livre**, não há máquina de estados de etapas (desmontagem → pintura → polimento). O chefe registra o que julgar relevante. Isso simplifica o modelo e reflete a operação real.

---

## 4. Fluxos principais

### 4.1 Fluxo: OS particular

```
1. Cliente chega ou liga
2. Consultor cria orçamento particular no sistema
3. Sistema gera link/PDF do orçamento
4. Cliente autoriza (verbal ou aceite digital)
5. Orçamento → vira OS (status: Em vistoria)
6. Vistoria inicial com cliente e chefe de oficina (fotos + assinatura)
7. → Aguardando peças (cotação/compra) OU Em serviço
8. Apontamentos livres durante execução
9. → Carro pronto → cliente avisado
10. Vistoria final + checklist de saída + assinatura
11. → Carro entregue
12. Administrativo emite NF-e (peças) + NFS-e (serviços)
13. Pagamento recebido → OS fechada
```

### 4.2 Fluxo: OS de seguradora

```
1. Sinistro importado (Cilia API → MVP)
2. Sistema cria OS preliminar (status: Aguardando autorização)
3. Seguradora autoriza (Cilia API atualiza status)
4. → Autorizado → agendamento de entrada
5. Veículo entra → vistoria inicial
6. → Aguardando peças (separação entre fornecimento oficina e fornecimento seguradora)
7. → Em serviço (apontamentos livres)
8. → Carro pronto
9. Vistoria final
10. → Carro entregue
11. Administrativo emite:
    - NF-e de peças com fornecimento oficina (destinatário: seguradora)
    - NF-e de peças com fornecimento seguradora (não emite — seguradora já cobriu)
    - NFS-e de serviços (destinatário: seguradora)
    - NFC-e de franquia (destinatário: segurado, se aplicável)
12. Recebimento da seguradora → OS fechada
```

### 4.3 Fluxo: cadastro direto

```
1. Consultor cria OS apenas para registro de veículo + cliente
2. Status pode ser fechado imediatamente sem fluxo operacional
3. Útil para histórico, consulta posterior, ou orçamento futuro
```

### 4.4 Fluxo: compra de peças

```
1. Após autorização, consultor identifica peças necessárias
2. Setor de compras consulta estoque
3. Em estoque → reserva para a OS
4. Sem estoque → compra sob demanda do fornecedor
5. Recebimento da peça:
   - Com NF-e XML → importação automática + entrada no estoque
   - Sem NF-e (recibo) → entrada manual
6. Peça reservada → liberação para execução
```

### 4.5 Fluxo: apontamento de execução

```
1. OS está em "Em serviço"
2. Chefe de oficina abre OS no app/tablet
3. Para cada etapa relevante:
   - Seleciona executor (mecânico João, funileiro Pedro, etc.)
   - Tira fotos (com marca d'água automática)
   - Escreve descrição livre
4. Registros ficam visíveis no histórico da OS
5. Sem máquina de estados — apontamento é livre
```

---

## 5. Requisitos funcionais

### 5.1 Gestão de OS

- **RF-OS-01** Criar OS pelos 3 caminhos (sinistro, particular, cadastro direto)
- **RF-OS-02** Numeração automática sequencial (formato existente do legado deve ser preservado se possível)
- **RF-OS-03** Visualização Kanban com os 9 status
- **RF-OS-04** Histórico imutável de mudanças de status (auditoria)
- **RF-OS-05** Histórico de alterações em campos editáveis (cliente, veículo, prazos)
- **RF-OS-06** Edição de cliente, veículo e datas durante a vida da OS
- **RF-OS-07** Suporte a OS de cliente PF e PJ
- **RF-OS-08** Cálculo de totais: peças, serviços, descontos, total geral
- **RF-OS-09** Bloqueio de edição financeira após faturamento

### 5.2 Vistorias e checklists

- **RF-VIS-01** 4 momentos definidos (§3.6) com templates específicos
- **RF-VIS-02** Captura de fotos pelo mobile/tablet com marca d'água automática (data + OS#)
- **RF-VIS-03** Assinatura digital do cliente nas vistorias inicial e final
- **RF-VIS-04** Apontamento livre durante "em serviço" (texto + foto + executor)
- **RF-VIS-05** Fotos imutáveis após captura (evidência) — apenas soft delete
- **RF-VIS-06** Checklist de itens (faróis, retrovisores, pneus, etc.) com 3 estados (OK / atenção / crítico)
- **RF-VIS-07** Operação offline no mobile com sync ao reconectar

### 5.3 Estoque e compras

- **RF-EST-01** Cadastro de peças com código, descrição, NCM, custo, preço
- **RF-EST-02** Entrada de estoque via NF-e XML (parser automático)
- **RF-EST-03** Entrada manual quando não há NF-e (recibo)
- **RF-EST-04** Reserva de peça por OS (peça reservada não disponível para outra OS)
- **RF-EST-05** Saldo nunca negativo (constraint em banco)
- **RF-EST-06** Distinção entre fornecimento oficina e fornecimento seguradora (atributo do item)
- **RF-EST-07** Histórico de movimentação por peça (entrada / saída / reserva)
- **RF-EST-08** Aviso quando peça em OS está sem reserva

### 5.4 Apontamento de execução

- **RF-APO-01** Apontamento livre durante "em serviço": executor + descrição + fotos + timestamp
- **RF-APO-02** Cadastro de funcionários com função (mecânico, funileiro, etc.)
- **RF-APO-03** Selecionar executor a partir de lista filtrada por função
- **RF-APO-04** Histórico cronológico de apontamentos visível na OS

### 5.5 Emissão fiscal

- **RF-FISC-01** Emissão de **NF-e** (modelo 55) — peças
- **RF-FISC-02** Emissão de **NFS-e Manaus** — serviços
- **RF-FISC-03** Emissão de **NFC-e** (modelo 65) — franquia paga pelo segurado
- **RF-FISC-04** Emissão em qualquer momento após entrega (decisão do administrativo, não automática)
- **RF-FISC-05** Destinatário correto por peça (oficina/seguradora) — não por OS
- **RF-FISC-06** Armazenamento do XML autorizado (S3 ou equivalente)
- **RF-FISC-07** Geração de DANFE / DANFE NFC-e em PDF
- **RF-FISC-08** Cancelamento dentro do prazo legal
- **RF-FISC-09** Manifestação de NF-e recebidas (ciência, confirmação)
- **RF-FISC-10** Configuração fiscal espelhando cadastro SEFAZ (regime, IE, IM, razão social exata)

### 5.6 Importação de sinistros

- **RF-IMP-01** Integração com **Cilia** (API) — fluxo principal MVP
- **RF-IMP-02** Importação cria OS em status "Aguardando autorização"
- **RF-IMP-03** Atualização de status quando seguradora autoriza via Cilia
- **RF-IMP-04** Vínculo com cadastro de seguradora local
- **RF-IMP-05** Importação de Soma (Porto, Azul, Itaú, Mitsui via XML) — **fora do MVP** (fase 2)
- **RF-IMP-06** Importação HDI (HTML scraping) — **fora do MVP** (fase 3)

### 5.7 Cadastros

- **RF-CAD-01** Clientes (PF/PJ) com LGPD: CPF, e-mail, telefone encriptados
- **RF-CAD-02** Veículos vinculados a cliente, busca por placa via FIPE (placa-fipe.apibrasil.com.br)
- **RF-CAD-03** Seguradoras com logo, cor, abreviação, dados fiscais
- **RF-CAD-04** Funcionários (executores) com função
- **RF-CAD-05** Catálogo de peças
- **RF-CAD-06** Catálogo de serviços com preço sugerido

---

## 6. Requisitos não-funcionais

### 6.1 LGPD e privacidade

- **RNF-LGPD-01** CPF, e-mail, telefone armazenados encriptados (`EncryptedField`)
- **RNF-LGPD-02** Logs nunca contêm PII em texto claro
- **RNF-LGPD-03** Soft delete para clientes (anonimização, não deleção)
- **RNF-LGPD-04** Lookup de cliente por hash (SHA-256) de e-mail
- **RNF-LGPD-05** Body de requisições não é logado em proxy/middleware

### 6.2 Auditoria

- **RNF-AUD-01** Histórico de mudanças de status em OS (imutável)
- **RNF-AUD-02** Histórico de alterações em campos relevantes (cliente, veículo, datas)
- **RNF-AUD-03** Identificação de quem fez cada alteração e quando

### 6.3 Mobile e offline

- **RNF-MOB-01** App roda em celular Android e iOS, e em tablet Android
- **RNF-MOB-02** Vistorias funcionam offline e sincronizam ao reconectar
- **RNF-MOB-03** Fotos com marca d'água gerada localmente no device
- **RNF-MOB-04** Assinatura digital capturada no device (canvas → imagem)
- **RNF-MOB-05** Push notification em eventos relevantes (status de OS, autorização)

### 6.4 Performance e capacidade

- **RNF-PERF-01** Suporta 30 usuários simultâneos no pico
- **RNF-PERF-02** Listagem de OS com paginação (20 itens por página padrão)
- **RNF-PERF-03** Busca por placa ou OS retorna em < 1s

### 6.5 Segurança

- **RNF-SEG-01** Autenticação via login + senha (e-mail + senha)
- **RNF-SEG-02** Tokens de sessão expiram em prazo configurável
- **RNF-SEG-03** RBAC com 4 níveis: OWNER / ADMIN / MANAGER / CONSULTANT (chefe de oficina = MANAGER no MVP)
- **RNF-SEG-04** Mensagens de erro de integração externa não vazam detalhes internos para o cliente
- **RNF-SEG-05** Uploads validados (extensão, tamanho, content-type)

---

## 7. Integrações

### 7.1 Cilia (sinistros) — **MVP**

- **Direção:** entrada
- **Protocolo:** API REST (web service)
- **Uso:** importação de sinistros e atualizações de autorização
- **Status:** já existe app `apps.cilia` com integração — validar e formalizar no MVP

### 7.2 Focus NF-e — **MVP**

- **Direção:** saída
- **Protocolo:** API REST
- **Uso:** emissão de NF-e, NFS-e Manaus, NFC-e
- **Cuidado:** payload Focus v2 é flat (não aninhado) — ver `CLAUDE.md` armadilhas

### 7.3 placa-fipe.apibrasil.com.br — **MVP**

- **Direção:** saída
- **Protocolo:** POST público sem chave
- **Uso:** consulta de placa para preencher marca/modelo/ano
- **Substitui:** API Sieve (descontinuada)

### 7.4 Integrações fora do MVP

- Soma (Porto / Azul / Itaú / Mitsui) — XML — **fase 2**
- HDI — HTML scraping — **fase 3** (mais frágil, deixar por último)
- Asaas (cobrança) — **fase 2**
- Evolution API (WhatsApp) — **fora do MVP**
- Keycloak (SSO) — **fora do MVP**

---

## 8. Stack tecnológica

### 8.1 Backend

- Django 5 + Django REST Framework
- PostgreSQL 16
- Celery 5 + Redis 7 (filas e tasks)
- Django Channels (websocket — apenas se necessário no MVP)
- Python 3.12 com type hints obrigatórios

### 8.2 Frontend web

- Next.js 15 (App Router)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- TanStack Query v5 (server state)
- React Hook Form + Zod (formulários)
- next-auth v5 (autenticação simples)

### 8.3 Mobile / tablet

- React Native + Expo SDK 52
- Expo Router v4
- WatermelonDB (offline)
- expo-camera (captura de fotos)
- expo-image-manipulator (marca d'água local)
- Componente custom de assinatura (canvas)

### 8.4 Infraestrutura

- AWS S3 (storage de fotos e XMLs fiscais)
- Hospedagem inicial: Coolify em VPS (a confirmar) ou AWS ECS
- CI/CD: GitHub Actions
- Monitoramento: Sentry

### 8.5 Decisões deliberadas de simplificação no MVP

| Item | Decisão MVP | Decisão pós-MVP |
|---|---|---|
| **Multitenancy** | Single tenant (1 cliente: DS Car) | Manter `django-tenants` no código mas sem schemas adicionais. Reativar quando entrar 2º cliente |
| **Auth** | Login simples (email + senha) no Django | Keycloak / SSO se houver mais de 1 sistema |
| **Pagamentos online** | Não | Asaas em fase 2 |
| **Motor de precificação** | Não — preço de serviço é manual ou de catálogo | Avaliar em fase 3 |

---

## 9. Fora de escopo do MVP

Os módulos abaixo **estão construídos parcialmente no código** mas **não fazem parte do MVP**. **Não devem ser deletados**, apenas marcados como fora de escopo. A decisão sobre arquivar / desligar / manter inativos será tomada em PR separado após aprovação deste PRD.

| Módulo | Estado atual | Justificativa de exclusão |
|---|---|---|
| **Motor de precificação (MO-1 a MO-9)** | 9 sprints implementadas | DS Car precifica serviços manualmente hoje. Motor é otimização futura, não substituição do legado |
| **Inbox omnichannel** | Especificado, parcialmente implementado | WhatsApp / Instagram / Facebook não são prioridade da DS Car no MVP |
| **Loja de peças** | Stub | Não é substituição do legado — é feature nova |
| **Loja de vidros** | Stub | Idem |
| **Loja de estética** | Stub | Idem |
| **Hub SSO / portal multi-cliente** | Stub | Sem 2º cliente, não tem função |
| **Importação Soma (XML)** | Não implementada | Cilia cobre os principais. Soma entra em fase 2 |
| **Importação HDI (HTML)** | Não implementada | Frágil, só vale a pena após validar fluxo principal |
| **WMS estoque físico completo** | Implementado | Excesso de granularidade vs. necessidade real. Manter modelo mais simples no MVP |
| **Benchmark IA + ingestão PDF** | Implementado | Depende do motor — junto na fase 3 |
| **Capacidade + variâncias + auditoria do motor** | Implementado | Idem |
| **Ficha técnica versionada** | Implementado | Idem |
| **Catálogo técnico (pricing_catalog)** | Implementado | Idem |
| **Multi-empresa fiscal** | Implementado | DS Car só tem 1 CNPJ ativo no MVP |
| **Módulo financeiro completo (DRE, balanço, fluxo de caixa)** | Implementado | MVP precisa só de AP/AR básico para acompanhar quitação. DRE/balanço entra em fase 2 |
| **RH completo (folha, ponto, metas, vales)** | Implementado | Não é prioridade da substituição do legado. Avaliar em fase 2/3 |

**Critério para reativar um módulo:** validação operacional do MVP em produção + pedido explícito do cliente.

---

## 10. Critérios de aceitação do MVP

### 10.1 Funcionais

- [ ] Consultor abre OS pelos 3 caminhos (particular, sinistro Cilia, cadastro direto)
- [ ] Kanban exibe os 9 status reais e transições válidas
- [ ] Chefe de oficina aponta execução com foto + executor + descrição no mobile
- [ ] Vistorias inicial e final geram fotos com marca d'água + assinatura do cliente
- [ ] Estoque distingue fornecimento oficina e seguradora por peça
- [ ] Administrativo emite NF-e, NFS-e e NFC-e pelo sistema
- [ ] Importação Cilia cria OS com vínculo correto à seguradora
- [ ] OS só fecha quando entregue + faturada + quitada

### 10.2 Operacionais

- [ ] DS Car opera 100% no novo sistema (legado desligado)
- [ ] Todos os 30 funcionários cadastrados
- [ ] Histórico do legado migrado (10k OS, 7k clientes — paridade)
- [ ] Mobile funciona offline em rede 4G fraca da oficina
- [ ] Backups automáticos diários

### 10.3 Fiscais

- [ ] Emissão em ambiente de produção SEFAZ-AM autorizada
- [ ] NF-e, NFS-e e NFC-e válidas (XML autorizado armazenado)
- [ ] Manifestação de NF-e recebidas funcionando
- [ ] Cancelamento dentro do prazo legal funcionando

---

## 11. Roadmap em fases

### Fase 1 — MVP (substituir o legado)

**Objetivo:** DS Car operando 100% no novo sistema.

**Inclui:**
- Gestão de OS (3 origens, 9 status, Kanban)
- Vistorias e checklists (4 momentos)
- Apontamento de execução (livre)
- Estoque e compras (entrada NF-e XML + manual, reserva)
- Emissão fiscal (NF-e, NFS-e, NFC-e)
- Importação Cilia
- Cadastros (clientes, veículos, seguradoras, funcionários, peças, serviços)
- Mobile (vistorias, fotos com marca d'água, assinatura, offline)
- Web (consultor + administrativo)
- Migração de dados do legado

**Não inclui:** todos os itens listados em §9.

### Fase 2 — Expansão de integrações e refinamentos

- Importação Soma (XML)
- Asaas (cobrança automatizada)
- AP/AR mais robustos (relatórios)
- Refinamentos baseados em uso real do MVP

### Fase 3 — Funcionalidades avançadas

- Importação HDI (se demanda persistir)
- Motor de precificação (se houver caso de negócio claro)
- Inbox omnichannel
- Lojas (peças, vidros, estética) — quando houver demanda

### Fase 4 — Plataforma multi-cliente

- Reativação de multitenancy
- Hub SSO
- Onboarding de cliente n.º 2

---

## 12. Glossário

| Termo | Definição |
|---|---|
| **OS** | Ordem de Serviço — unidade central do sistema |
| **OS fechada** | OS entregue **+** faturada **+** quitada simultaneamente |
| **Particular** | OS aberta por cliente final (sem seguradora) |
| **Sinistro** | OS aberta por seguradora |
| **Fornecimento** | Atributo da peça: "oficina" (DS Car paga) ou "seguradora" (seguradora paga) |
| **Vistoria** | Registro fotográfico + assinatura em momento de transferência (entrada ou saída do veículo) |
| **Checklist** | Conferência de itens (faróis, retrovisores, etc.) com OK / atenção / crítico |
| **Apontamento** | Registro livre de execução durante "em serviço" |
| **Franquia** | Valor pago pelo segurado à oficina (não pela seguradora) — gera NFC-e |
| **NF-e** | Nota Fiscal Eletrônica modelo 55 — peças/produtos |
| **NFS-e** | Nota Fiscal de Serviço Eletrônica — serviços (Manaus) |
| **NFC-e** | Nota Fiscal de Consumidor Eletrônica modelo 65 — franquia |
| **Cilia** | Plataforma que centraliza sinistros de múltiplas seguradoras via API |
| **SEFAZ-AM** | Secretaria da Fazenda do Amazonas (homologa NF-e) |
| **MVP** | Minimum Viable Product — escopo mínimo que substitui o legado e gera valor real |

---

## 13. Aprovação

**Aprovado por:** ___________________________ **Data:** ___ / ___ / _____

> Mudanças no escopo deste PRD (incluir um item de §9 no MVP, alterar persona, mudar definição de OS fechada, etc.) **devem ser feitas via revisão deste documento**, não diretamente em código. PRD aprovado é a fonte da verdade do MVP.
